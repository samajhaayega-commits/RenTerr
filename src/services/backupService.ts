import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createAuditLog } from './auditService';
import { SystemBackup } from '../types';

const CORE_COLLECTIONS = ['users', 'items', 'bookings', 'security_alerts'];

export const triggerSystemBackup = async (adminId: string = 'SYSTEM') => {
  try {
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const colName of CORE_COLLECTIONS) {
      const snapshot = await getDocs(collection(db, colName));
      backupData[colName] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      totalDocs += snapshot.docs.length;
    }

    const backupRecord: Omit<SystemBackup, 'id'> = {
      triggeredBy: adminId,
      timestamp: serverTimestamp(),
      collections: CORE_COLLECTIONS,
      dataSize: totalDocs,
      status: 'SUCCESS'
    };

    // Store the backup record and the snapshot separately for scalability
    const backupRef = await addDoc(collection(db, 'system_backups'), backupRecord);
    
    // Store actual data in a subcollection to avoid single document limit
    await addDoc(collection(db, `system_backups/${backupRef.id}/snapshots`), {
      content: JSON.stringify(backupData),
      createdAt: serverTimestamp()
    });

    await createAuditLog('ADMIN_ACTION', `System Backup Completed: ${totalDocs} documents`, adminId);
    return backupRef.id;
  } catch (error) {
    console.error("Backup failed", error);
    await createAuditLog('SYSTEM_RESTART', `CRITICAL: Backup Failed`, adminId, { error });
    throw error;
  }
};

export const getLatestBackup = async () => {
    const q = query(collection(db, 'system_backups'), orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SystemBackup;
};
