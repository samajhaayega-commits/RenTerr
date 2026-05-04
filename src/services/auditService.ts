import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLog } from '../types';

export const createAuditLog = async (
  action: AuditLog['action'], 
  description: string, 
  userId?: string, 
  metadata: Record<string, any> = {}
) => {
  try {
    const logData: Omit<AuditLog, 'id'> = {
      userId,
      action,
      description,
      metadata,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      // IP detection usually happens server-side, but we can log client context
    };
    await addDoc(collection(db, 'audit_logs'), logData);
  } catch (error) {
    console.error("Critical: Audit logging failed", error);
  }
};

export const logSecurityEvent = async (
  type: 'CRITICAL' | 'WARNING' | 'INFO',
  category: 'FRAUD' | 'SYSTEM' | 'SECURITY',
  message: string,
  targetUserId?: string
) => {
  try {
    await addDoc(collection(db, 'security_alerts'), {
      type,
      category,
      message,
      targetUserId,
      isResolved: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Security logging failed", error);
  }
};
