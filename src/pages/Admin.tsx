import { useState, useEffect, useMemo, ReactNode } from 'react';
import { 
  collection, getDocs, doc, updateDoc, query, orderBy, 
  addDoc, serverTimestamp, where, limit, deleteDoc, getDoc, onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Booking, RentableItem, UserProfile, Dispute, AdminActivityLog, SecurityAlert, AuditLog, SystemBackup 
} from '../types';
import { 
  ShieldCheck, AlertCircle, CheckCircle2, XCircle, Search, 
  Database, Package, ListFilter, Users, BarChart3, 
  MessageSquare, Bell, Wallet, Clock, ArrowUpRight, 
  ArrowDownRight, Settings, Trash2, Ban, UserCheck, 
  ExternalLink, IndianRupee, BrainCircuit, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { triggerSystemBackup, getLatestBackup } from '../services/backupService';

type AdminTab = 'dashboard' | 'users' | 'listings' | 'bookings' | 'disputes' | 'payments' | 'analytics' | 'notifications' | 'security' | 'audit' | 'recovery' | 'logs';

export default function Admin() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Automated Backup Check
  useEffect(() => {
     if (!user) return;
     const checkBackup = async () => {
        try {
           const latest = await getLatestBackup();
           if (!latest) {
              await triggerSystemBackup('SYSTEM_AUTO');
              return;
           }
           
           const lastDate = latest.timestamp?.toDate();
           if (lastDate) {
              const hoursSince = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);
              if (hoursSince > 24) {
                 await triggerSystemBackup('SYSTEM_AUTO');
              }
           }
        } catch (e) {
           console.error("Auto-backup failed", e);
        }
     };
     checkBackup();
  }, [user]);
  
  // Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [items, setItems] = useState<RentableItem[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Security Gate
  useEffect(() => {
     if (profile && profile.role !== 'admin') {
       navigate('/');
     }
  }, [profile, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userSnap, bookingSnap, itemSnap, disputeSnap, logSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(50))),
        getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(collection(db, 'disputes'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'), limit(50))),
        getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(50)))
      ]);

      setUsers(userSnap.docs.map(d => ({ ...d.data() } as UserProfile)));
      setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      setItems(itemSnap.docs.map(d => ({ id: d.id, ...d.data() } as RentableItem)));
      setDisputes(disputeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Dispute)));
      setLogs(logSnap.docs.map(d => ({ id: d.id, ...d.data() } as AdminActivityLog)));
      setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (e) {
      console.error("Admin Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createLog = async (action: string, targetId: string, targetType: AdminActivityLog['targetType'], details: string) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'admin_logs'), {
        adminId: profile.uid,
        adminName: profile.displayName,
        action,
        targetId,
        targetType,
        details,
        timestamp: serverTimestamp()
      });
    } catch (e) { console.error("Log Error:", e); }
  };

  const updateUserStatus = async (userId: string, isRestricted: boolean) => {
    await updateDoc(doc(db, 'users', userId), { isRestricted });
    setUsers(users.map(u => u.uid === userId ? { ...u, isRestricted } : u));
    createLog(isRestricted ? 'RESTRICT_USER' : 'UNRESTRICT_USER', userId, 'user', `${isRestricted ? 'Restricted' : 'Unrestricted'} user access`);
  };

  const updateItemStatus = async (itemId: string, status: RentableItem['status']) => {
    await updateDoc(doc(db, 'items', itemId), { status });
    setItems(items.map(i => i.id === itemId ? { ...i, status } : i));
    createLog('UPDATE_ITEM_STATUS', itemId, 'item', `Set item status to ${status}`);
    if (status === 'active') alert("Item approved and live!");
  };

  const resolveDispute = async (disputeId: string, status: Dispute['status'], decision: string) => {
    await updateDoc(doc(db, 'disputes', disputeId), { 
      status, 
      adminDecision: decision,
      resolvedAt: serverTimestamp() 
    });
    setDisputes(disputes.map(d => d.id === disputeId ? { ...d, status, adminDecision: decision } : d));
    createLog('RESOLVE_DISPUTE', disputeId, 'dispute', `Resolved dispute as ${status}: ${decision}`);
    alert(`Dispute ${status} successfully.`);
  };

  const Stats = useMemo(() => {
    const totalRevenue = bookings.reduce((acc, b) => acc + (b.totalCost || 0), 0);
    const platformFee = Math.round(totalRevenue * 0.1);
    return {
      users: users.length,
      rentals: bookings.filter(b => b.status === 'active').length,
      pending: bookings.filter(b => b.status === 'request_sent').length,
      disputes: disputes.filter(d => d.status === 'pending').length,
      revenue: totalRevenue,
      fees: platformFee
    };
  }, [users, bookings, disputes]);

  const seedData = async () => {
    setLoading(true);
    try {
      // 1. Create Mock Disputes
      const disputeData = {
        bookingId: 'mock-booking-id',
        itemId: 'item-123',
        renterId: 'renter-456',
        ownerId: 'owner-789',
        ownerClaim: 'Broken handle on the Bosch drill. Seems like it was dropped.',
        damageLevel: 'minor',
        penaltyAmount: 500,
        status: 'pending',
        imagesPre: ['https://images.unsplash.com/photo-1504148455328-c376907d081c'],
        imagesPost: ['https://images.unsplash.com/photo-1540103359328-c376907d081c'],
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'disputes'), disputeData);

      // 2. Create Initial Activity Logs
      await addDoc(collection(db, 'admin_logs'), {
        adminId: profile?.uid,
        adminName: profile?.displayName,
        action: 'SYSTEM_BOOT',
        targetId: 'system',
        targetType: 'user',
        details: 'Admin panel initialized with sample data',
        timestamp: serverTimestamp()
      });

      alert("Mock operational data seeded!");
      fetchData();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: AdminTab, label: string, icon: any }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
        activeTab === id 
          ? 'bg-gray-900 text-white shadow-xl shadow-gray-200' 
          : 'text-gray-400 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} />
      <span className="hidden lg:block">{label}</span>
    </button>
  );

  if (loading) return <AdminLoading />;

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r border-gray-100 p-6 flex flex-col gap-8 bg-gray-50/30">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 lg:w-12 h-10 lg:h-12 bg-gray-900 rounded-[18px] flex items-center justify-center text-white shadow-xl shadow-gray-200">
             <ShieldCheck size={24} />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-xl font-black text-gray-900 leading-none">RenTer</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Admin Console</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <SidebarItem id="dashboard" label="Mission Control" icon={BarChart3} />
          <SidebarItem id="users" label="Neighbors" icon={Users} />
          <SidebarItem id="listings" label="Inventory" icon={Package} />
          <SidebarItem id="bookings" label="Operations" icon={ListFilter} />
          <SidebarItem id="disputes" label="Resolution" icon={AlertCircle} />
          <SidebarItem id="payments" label="Financials" icon={Wallet} />
          <SidebarItem id="analytics" label="Growth" icon={Activity} />
          <SidebarItem id="notifications" label="Alerts" icon={Bell} />
          <SidebarItem id="security" label="Security" icon={ShieldCheck} />
          <SidebarItem id="audit" label="Audit" icon={ListFilter} />
          <SidebarItem id="recovery" label="Recovery" icon={Database} />
        </div>

        <div className="pt-6 border-t border-gray-100 flex flex-col gap-2">
           <button 
             onClick={seedData}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
           >
             <Database size={16} />
             <span className="hidden lg:block">Seed Data</span>
           </button>
           <SidebarItem id="logs" label="Access Logs" icon={Clock} />
           <button 
             onClick={() => navigate('/')}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all"
           >
             <XCircle size={18} />
             <span className="hidden lg:block">Exit</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 lg:h-24 border-b border-gray-50 flex items-center justify-between px-8 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
           <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-gray-900 tracking-tight capitalize">{activeTab}</h2>
              <div className="h-6 w-px bg-gray-100" />
              <div className="hidden md:flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                 <Clock size={12} /> {format(new Date(), 'HH:mm')}
              </div>
           </div>

           <div className="flex items-center gap-6">
              <div className="relative group hidden sm:block">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                 <input 
                   type="text" 
                   placeholder="Search nodes..."
                   className="bg-gray-50 border-none rounded-full py-2.5 pl-11 pr-6 text-xs font-bold focus:ring-2 focus:ring-gray-100 transition-all w-64"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
                 <img src={profile?.photoURL} className="w-8 h-8 rounded-xl object-cover shadow-sm" alt="" />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">{profile?.displayName}</span>
              </div>
           </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-hide">
           <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <TabDashboard stats={Stats} />}
              {activeTab === 'users' && <TabUsers users={users} loading={loading} search={search} onUpdate={updateUserStatus} />}
              {activeTab === 'listings' && <TabListings items={items} loading={loading} search={search} onUpdate={updateItemStatus} />}
              {activeTab === 'bookings' && <TabBookings bookings={bookings} search={search} />}
             {activeTab === 'disputes' && <TabDisputes disputes={disputes} onResolve={resolveDispute} />}
             {activeTab === 'security' && <TabSecurity />}
             {activeTab === 'audit' && <TabAudit />}
             {activeTab === 'recovery' && <TabRecovery />}
             {activeTab === 'payments' && <TabPayments bookings={bookings} transactions={transactions} />}
              {activeTab === 'notifications' && <TabNotifications />}
              {activeTab === 'analytics' && <TabAnalytics bookings={bookings} />}
           </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

// Sub-Tab Components
function TabDashboard({ stats }: { stats: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Users" value={stats.users} icon={Users} trend="+12" />
          <StatCard title="Active Deals" value={stats.rentals} icon={Activity} trend="+4" color="bg-emerald-500" />
          <StatCard title="Total Revenue" value={`₹${stats.revenue}`} icon={IndianRupee} trend="+₹8k" color="bg-primary-500" />
          <StatCard title="Pending Review" value={stats.pending} icon={Clock} trend="-2" color="bg-amber-500" />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-900 border border-white/10 rounded-[40px] p-8 text-white relative overflow-hidden group">
             <div className="relative z-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-8">Revenue Momentum</h3>
                <div className="h-64 flex items-end gap-2 px-4">
                   {[40, 70, 45, 90, 65, 80, 50, 100, 85, 95].map((h, i) => (
                      <div key={i} className="flex-1 bg-primary-600 rounded-t-xl group-hover:bg-primary-400 transition-all cursor-pointer" style={{ height: `${h}%` }}>
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center pt-2">
                            <span className="text-[8px] font-black font-mono">₹{h * 20}</span>
                         </div>
                      </div>
                   ))}
                </div>
                <div className="flex justify-between mt-6 px-4">
                   {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => <span key={d} className="text-[10px] font-black text-gray-600">{d}</span>)}
                </div>
             </div>
             <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
                <IndianRupee size={160} />
             </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-sm flex flex-col">
             <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-8 flex items-center gap-2">
                <BrainCircuit size={16} className="text-primary-600" /> AI Insights
             </h3>
             <div className="space-y-6 flex-1">
                <InsightRow icon={AlertCircle} color="text-amber-600" bg="bg-amber-50" title="Risk Score Alert" sub="User 'Deepak-82' triggered risk threshold (3 bans)." />
                <InsightRow icon={ArrowUpRight} color="text-emerald-600" bg="bg-emerald-50" title="Demand Surge" sub="Power Drills demand increased by 40% in Noida." />
                <InsightRow icon={XCircle} color="text-red-600" bg="bg-red-50" title="Damage Trend" sub="Dyson Vacuums report 12% higher damage rates." />
             </div>
             <button className="mt-8 w-full py-4 bg-gray-50 border border-gray-100 rounded-[20px] text-[10px] font-black uppercase tracking-widest text-gray-900 hover:bg-gray-900 hover:text-white transition-all">
                Generate Full Audit
             </button>
          </div>
       </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon: Icon, trend, color = 'bg-gray-900' }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm group hover:shadow-xl hover:shadow-gray-100 transition-all">
       <div className="flex justify-between items-start mb-6">
          <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
             <Icon size={24} />
          </div>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{trend}</span>
       </div>
       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">{title}</p>
       <h4 className="text-3xl font-black text-gray-900 tracking-tight">{value}</h4>
    </div>
  );
}

function InsightRow({ icon: Icon, color, bg, title, sub }: any) {
  return (
    <div className="flex gap-4 group">
       <div className={`w-10 h-10 ${bg} ${color} rounded-xl flex items-center justify-center shrink-0`}>
          <Icon size={18} />
       </div>
       <div>
          <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">{title}</p>
          <p className="text-[11px] text-gray-500 font-medium leading-tight mt-1">{sub}</p>
       </div>
    </div>
  );
}

function TabUsers({ users, search, onUpdate }: any) {
  const filtered = users.filter((u: any) => u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.uid.includes(search));
  return (
     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-gray-50/50 border-b border-gray-50">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Identity</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Trust Score</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Risk Profile</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Operations</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                 {filtered.map((u: any) => (
                    <tr key={u.uid} className="hover:bg-gray-50/30 transition-all group">
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <img src={u.photoURL} className="w-12 h-12 rounded-[18px] object-cover shadow-sm" alt="" />
                             <div>
                                <p className="text-sm font-black text-gray-900">{u.displayName}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.email}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                             <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full" style={{ width: `${u.trustScore || 50}%` }} />
                             </div>
                             <span className="text-xs font-black text-emerald-600">{u.trustScore || 50}</span>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          {u.isRestricted ? (
                             <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 w-fit">
                                <Ban size={12} /> Restricted
                             </span>
                          ) : (
                             <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 w-fit">
                                <UserCheck size={12} /> Active
                             </span>
                          )}
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => onUpdate(u.uid, !u.isRestricted)}
                               className="p-3 bg-gray-50 rounded-2xl text-gray-600 hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                             >
                                {u.isRestricted ? <UserCheck size={16} /> : <Ban size={16} />}
                             </button>
                             <button className="p-3 bg-gray-50 rounded-2xl text-primary-600 hover:bg-primary-600 hover:text-white transition-all shadow-sm">
                                <ExternalLink size={16} />
                             </button>
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
     </motion.div>
  );
}

function TabListings({ items, search, onUpdate }: any) {
  const filtered = items.filter((i: any) => i.title?.toLowerCase().includes(search.toLowerCase()));
  return (
     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((item: any) => (
           <div key={item.id} className="bg-white border border-gray-100 rounded-[40px] p-6 shadow-sm group hover:shadow-xl transition-all">
              <div className="relative mb-6">
                 <img src={item.images[0]} className="w-full h-48 rounded-[32px] object-cover shadow-sm" alt="" />
                 <div className="absolute top-4 left-4">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl ${
                       item.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                       {item.status}
                    </span>
                 </div>
              </div>
              <h4 className="text-lg font-black text-gray-900 mb-2 leading-tight">{item.title}</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">{item.category} • {item.ownerName}</p>
              
              <div className="flex gap-2">
                 {item.status === 'pending_approval' ? (
                    <button 
                       onClick={() => onUpdate(item.id, 'active')}
                       className="flex-1 py-4 bg-gray-900 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-300 active:scale-95 transition-all"
                    >
                       Approve Asset
                    </button>
                 ) : (
                    <button 
                       onClick={() => onUpdate(item.id, 'pending_approval')}
                       className="flex-1 py-4 bg-gray-50 text-gray-600 border border-gray-100 rounded-[20px] text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                       Flag for Review
                    </button>
                 )}
                 <button className="p-4 bg-red-50 text-red-500 rounded-[20px] active:scale-95 transition-all">
                    <Trash2 size={20} />
                 </button>
              </div>
           </div>
        ))}
     </motion.div>
  );
}

function TabBookings({ bookings, search }: { bookings: Booking[], search: string }) {
   const filtered = bookings.filter(b => b.id.toLowerCase().includes(search.toLowerCase()) || b.renterId.toLowerCase().includes(search.toLowerCase()));
   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
         {filtered.map(b => (
            <div key={b.id} className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-sm flex items-center gap-8 group hover:border-primary-100 transition-all">
               <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Package size={24} className="text-gray-400" />
               </div>
               <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                     <p className="text-sm font-black text-gray-900">ID: {b.id.substring(0, 8)}</p>
                     <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-black text-gray-400 rounded-md uppercase tracking-wider">{b.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Renter: {b.renterId.substring(0, 8)} • Value: ₹{b.totalCost}</p>
               </div>
               <div className="text-right">
                  <p className="text-xs font-black text-gray-900 uppercase">{format(new Date(b.createdAt?.seconds * 1000 || Date.now()), 'MMM d, HH:mm')}</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">Digital Trail Verified</p>
               </div>
               <button className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-900 hover:text-white transition-all">
                  <ExternalLink size={20} />
               </button>
            </div>
         ))}
      </motion.div>
   );
}

function TabDisputes({ disputes, onResolve }: { disputes: Dispute[], onResolve: (id: string, status: Dispute['status'], decision: string) => void }) {
   if (disputes.length === 0) return (
      <div className="text-center py-40 bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200">
         <ShieldCheck size={60} className="mx-auto text-gray-200 mb-6" />
         <h4 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300">Clean Slate: Zero Disputes</h4>
      </div>
   );

   return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {disputes.map(d => (
            <div key={d.id} className="bg-white border-2 border-red-50 rounded-[40px] p-8 shadow-sm">
               <div className="flex justify-between items-start mb-8">
                  <div>
                     <h4 className="text-lg font-black text-gray-900 mb-1">Damage Claim: ₹{d.penaltyAmount}</h4>
                     <p className="text-[10px] text-red-500 font-black uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full w-fit">Critical Arbitration</p>
                  </div>
                  <AlertCircle className="text-red-500" size={32} />
               </div>

               <div className="bg-gray-50 p-6 rounded-[28px] mb-8 space-y-4">
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-widest border-b border-gray-100 pb-2">
                     <span className="text-gray-400">Claimant (Owner)</span>
                     <span className="text-gray-900">UID: {d.ownerId.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed italic">"{d.ownerClaim}"</p>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Pre-Rental Inspection</p>
                     <div className="grid grid-cols-2 gap-1">
                        {d.imagesPre?.slice(0, 2).map((img, i) => <img key={i} src={img} className="w-full h-16 rounded-xl object-cover grayscale opacity-50" />)}
                     </div>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Damage Evidence</p>
                     <div className="grid grid-cols-2 gap-1">
                        {d.imagesPost?.slice(0, 2).map((img, i) => <img key={i} src={img} className="w-full h-16 rounded-xl object-cover border-2 border-red-200" />)}
                     </div>
                  </div>
               </div>

               <div className="flex gap-3">
                  <button 
                    onClick={() => onResolve(d.id, 'resolved', 'Upholding owner claim based on provided post-rental evidence.')}
                    className="flex-1 py-4 bg-gray-900 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-gray-300"
                  >
                    Uphold Claim
                  </button>
                  <button 
                    onClick={() => onResolve(d.id, 'rejected', 'Evidence insufficient to prove renter damage.')}
                    className="flex-1 py-4 bg-gray-50 text-gray-600 border border-gray-100 rounded-[20px] text-[10px] font-black uppercase tracking-widest"
                  >
                    Reject Case
                  </button>
               </div>
            </div>
         ))}
      </div>
   );
}

function TabPayments({ transactions, bookings }: { transactions: any[], bookings: Booking[] }) {
   const totalEscrow = transactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);
   const totalCommission = bookings.reduce((acc, b) => acc + (b.platformFee || 0), 0);
   const totalRefunded = transactions.filter(tx => tx.type === 'REFUND').reduce((acc, tx) => acc + Math.abs(tx.amount || 0), 0);

   return (
      <div className="space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-900 rounded-[32px] p-8 text-white">
               <p className="text-[10px] font-black uppercase tracking-widest text-primary-400 mb-2">Net Escrow</p>
               <h3 className="text-3xl font-black">₹{totalEscrow.toLocaleString()}</h3>
            </div>
            <div className="bg-emerald-600 rounded-[32px] p-8 text-white">
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-2">Commissions</p>
               <h3 className="text-3xl font-black">₹{totalCommission.toLocaleString()}</h3>
            </div>
            <div className="bg-orange-600 rounded-[32px] p-8 text-white">
               <p className="text-[10px] font-black uppercase tracking-widest text-orange-100 mb-2">Refunds Paid</p>
               <h3 className="text-3xl font-black">₹{totalRefunded.toLocaleString()}</h3>
            </div>
            <div className="bg-blue-600 rounded-[32px] p-8 text-white">
               <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-2">Total Events</p>
               <h3 className="text-3xl font-black">{transactions.length}</h3>
            </div>
         </div>

         <div className="bg-white border border-gray-100 rounded-[40px] overflow-hidden shadow-sm">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-50">
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Type</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Payment ID</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Booking</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Amount</th>
                     <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                  </tr>
               </thead>
               <tbody>
                  {transactions.map(tx => (
                     <tr key={tx.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/30">
                        <td className="px-8 py-6">
                           <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                              tx.type === 'REFUND' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'
                           }`}>
                              {tx.type || 'PAYMENT'}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-tighter">{tx.razorpayPaymentId}</td>
                        <td className="px-8 py-6 text-xs font-bold text-primary-600">#{tx.bookingId.substring(0, 8)}</td>
                        <td className={`px-8 py-6 text-xs font-black ${tx.amount < 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                           ₹{tx.amount}
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex flex-col">
                              <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg w-fit ${tx.type === 'DUMMY' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                 {tx.status} {tx.type === 'DUMMY' && '(TEST)'}
                              </span>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   );
}

function TabAnalytics({ bookings }: any) {
   return (
      <div className="space-y-12 pb-20">
         <div className="bg-gray-900 rounded-[40px] p-12 text-white relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
               <div>
                  <h3 className="text-4xl font-black tracking-tight mb-4">Enterprise Intelligence</h3>
                  <p className="text-gray-400 font-medium leading-relaxed max-w-sm mb-8">Platform-wide data correlation across 10+ operational vectors. Growth tracking enabled.</p>
                  <div className="flex gap-4">
                     <div className="bg-white/10 px-6 py-4 rounded-[24px] border border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary-400 mb-1">Dwell Time</p>
                        <p className="text-2xl font-black">4.2d</p>
                     </div>
                     <div className="bg-white/10 px-6 py-4 rounded-[24px] border border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Reputation</p>
                        <p className="text-2xl font-black">98.2%</p>
                     </div>
                  </div>
               </div>
               <div className="h-64 bg-white/5 rounded-[32px] border border-white/10 flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-8 border-primary-500 border-t-transparent animate-spin-slow flex items-center justify-center">
                     <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                        <BarChart3 size={32} />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatCard title="System Uptime" value="99.98%" icon={Settings} trend="0.0%" color="bg-indigo-500" />
            <StatCard title="Liquidity" value="₹124.5k" icon={Wallet} trend="+22%" color="bg-secondary-500" />
            <StatCard title="Ops Velocity" value="24 Rental/hr" icon={Activity} trend="+12" color="bg-emerald-500" />
         </div>
      </div>
   );
}

function TabSecurity() {
   const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
   
   useEffect(() => {
      const q = query(collection(db, 'security_alerts'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(q, (snapshot) => {
         setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SecurityAlert)));
      });
   }, []);

   return (
      <div className="space-y-6">
         <div className="flex items-center gap-4 p-8 bg-red-50 rounded-[40px] border border-red-100">
            <div className="w-16 h-16 bg-red-600 rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-red-200">
               <ShieldCheck size={32} />
            </div>
            <div>
               <h3 className="text-xl font-black text-red-900">Security Command Center</h3>
               <p className="text-sm text-red-600 font-medium lowercase">AI Monitoring for Fraud & Spikes active.</p>
            </div>
         </div>

         {alerts.map(a => (
            <div key={a.id} className="p-6 bg-white rounded-[32px] border border-gray-100 flex items-start gap-5 shadow-sm">
               <div className={`p-3 rounded-2xl ${a.type === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                  <ShieldCheck size={20} />
               </div>
               <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-gray-50 rounded-full text-gray-500">{a.category}</span>
                     <span className="text-[10px] text-gray-400 font-bold">{a.createdAt?.toDate().toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{a.message}</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest">Target UID: {a.targetUserId}</p>
               </div>
               <button className="text-xs font-black text-primary-600 uppercase tracking-widest hover:bg-primary-50 px-4 py-2 rounded-xl transition-all">Resolve</button>
            </div>
         ))}
      </div>
   );
}

function TabAudit() {
   const [logs, setLogs] = useState<AuditLog[]>([]);

   useEffect(() => {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
      return onSnapshot(q, (snapshot) => {
         setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
      });
   }, []);

   return (
      <div className="space-y-4">
         <h2 className="text-2xl font-black mb-6 px-2">Immutable Audit Trail</h2>
         <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Action</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Description</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">User</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Time</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {logs.map(l => (
                         <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                               <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-gray-100 rounded text-gray-900">
                                  {l.action}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-gray-600">{l.description}</td>
                            <td className="px-6 py-4 text-[10px] font-mono text-gray-400">{l.userId ? l.userId.substring(0, 8) : 'SYSTEM'}</td>
                            <td className="px-6 py-4 text-[10px] text-gray-400 font-bold whitespace-nowrap">
                               {l.timestamp?.toDate().toLocaleString()}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         </div>
      </div>
   );
}

function TabRecovery() {
   const { user } = useAuth();
   const [backups, setBackups] = useState<SystemBackup[]>([]);
   const [backingUp, setBackingUp] = useState(false);

   useEffect(() => {
      const q = query(collection(db, 'system_backups'), orderBy('timestamp', 'desc'), limit(20));
      return onSnapshot(q, (snapshot) => {
         setBackups(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemBackup)));
      });
   }, []);

   const handleManualBackup = async () => {
      setBackingUp(true);
      try {
         await triggerSystemBackup(user?.uid || 'ADMIN_MANUAL');
         alert("Disaster Recovery Snapshot Created Successfully.");
      } catch (e) {
         alert("Backup failed. See logs.");
      } finally {
         setBackingUp(false);
      }
   };

   return (
      <div className="space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="p-8 bg-gray-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                   <h3 className="text-xl font-black mb-2">Instant Recovery</h3>
                   <p className="text-sm text-gray-400 font-medium lowercase mb-6">Create an immutable snapshot of all platform data.</p>
                   <button 
                     onClick={handleManualBackup}
                     disabled={backingUp}
                     className={`px-8 py-4 bg-white text-gray-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-3 ${backingUp ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                      <Database size={16} />
                      {backingUp ? 'Capturing...' : 'Backup Now'}
                   </button>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-10">
                   <Database size={240} />
                </div>
             </div>

             <div className="p-8 bg-primary-600 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                   <h3 className="text-xl font-black mb-2">Disaster Plan</h3>
                   <p className="text-sm text-primary-100 font-medium lowercase mb-6">Restoration protocols for critical failure events.</p>
                   <div className="flex gap-4">
                      <div className="px-5 py-3 bg-primary-500 rounded-xl">
                         <p className="text-[10px] font-black uppercase tracking-widest text-primary-200">Daily Backups</p>
                         <p className="text-lg font-black mt-1">Enabled</p>
                      </div>
                      <div className="px-5 py-3 bg-primary-500 rounded-xl">
                         <p className="text-[10px] font-black uppercase tracking-widest text-primary-200">Region Sync</p>
                         <p className="text-lg font-black mt-1">ACTIVE</p>
                      </div>
                   </div>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-10">
                   <ShieldCheck size={240} />
                </div>
             </div>
         </div>

         <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
               <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Snapshot History</h3>
            </div>
            <div className="divide-y divide-gray-50">
               {backups.map(b => (
                  <div key={b.id} className="p-8 flex items-center justify-between hover:bg-gray-50/50 transition-all">
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                           <CheckCircle2 size={20} />
                        </div>
                        <div>
                           <p className="text-sm font-black text-gray-900 uppercase tracking-widest">{b.status}</p>
                           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                              {b.dataSize} Docs • By {b.triggeredBy.substring(0, 8)}
                           </p>
                        </div>
                     </div>
                     <div className="text-right flex items-center gap-6">
                        <div>
                           <p className="text-xs font-black text-gray-900">{b.timestamp?.toDate().toLocaleString()}</p>
                           <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">ID: {b.id.substring(0, 10)}</p>
                        </div>
                        <button className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all">Restore</button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}

function TabNotifications() {
   const [notif, setNotif] = useState({ title: '', body: '', type: 'all' });
   return (
      <div className="max-w-2xl mx-auto py-12">
         <div className="bg-white border border-gray-100 rounded-[40px] p-10 shadow-sm">
            <div className="flex items-center gap-4 mb-10">
               <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-[24px] flex items-center justify-center">
                  <Bell size={28} />
               </div>
               <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Notification Command</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">Broadcast alerts to the RenTer neighbor network.</p>
               </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Target Audience</label>
                  <select 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-gray-100 transition-all"
                    value={notif.type}
                    onChange={e => setNotif({...notif, type: e.target.value})}
                  >
                     <option value="all">All Active Neighbors</option>
                     <option value="owners">Owners Only</option>
                     <option value="high_risk">High Risk Users</option>
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Subject Header</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Security Update" 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-gray-100 transition-all"
                    value={notif.title}
                    onChange={e => setNotif({...notif, title: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Message Body</label>
                  <textarea 
                    rows={4} 
                    placeholder="Type your announcement..." 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-gray-100 transition-all resize-none"
                    value={notif.body}
                    onChange={e => setNotif({...notif, body: e.target.value})}
                  />
               </div>
               <button className="w-full py-5 bg-gray-900 text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-3">
                  <ArrowUpRight size={18} />
                  Transmit Broadcast
               </button>
            </div>
         </div>
      </div>
   );
}

function AdminLoading() {
  return (
    <div className="h-screen bg-white flex flex-col items-center justify-center gap-6">
       <div className="w-16 h-16 border-8 border-gray-100 border-t-gray-900 rounded-full animate-spin" />
       <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-900">Initializing Core</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 italic">Verifying Admin Session...</p>
       </div>
    </div>
  );
}
