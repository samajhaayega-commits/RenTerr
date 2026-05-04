import { useState, useEffect, ReactNode } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, getDoc, serverTimestamp, increment, addDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Booking, RentableItem, DamageLevel, RentalBill } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, CheckCircle2, Clock, AlertCircle, ChevronRight, X, MessageSquare, Info, ShieldCheck, ArrowRight, PlusCircle, Package, Edit3, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const DAMAGE_RATES: Record<DamageLevel, number> = {
  none: 0,
  minor: 0.15, // 15% of deposit
  medium: 0.5, // 50%
  major: 1.0,  // 100%
  missing_parts: 0.3 // 30% per part (simplified)
};

import { processRefund } from '../services/paymentService';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'requests' | 'rentals' | 'items' | 'earnings'>('requests');
  const [bookings, setBookings] = useState<(Booking & { item?: RentableItem })[]>([]);
  const [myItems, setMyItems] = useState<RentableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking & { item?: RentableItem } | null>(null);
  
  // Inspection State
  const [showInspector, setShowInspector] = useState(false);
  const [damageLevel, setDamageLevel] = useState<DamageLevel>('none');
  const [missingParts, setMissingParts] = useState<string[]>([]);
  const [postPhotos, setPostPhotos] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch Bookings
        const q = query(
          collection(db, 'bookings'), 
          where('ownerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const bookingData = await Promise.all(snapshot.docs.map(async (d) => {
          const booking = { id: d.id, ...d.data() } as Booking;
          const itemDoc = await getDoc(doc(db, 'items', booking.itemId));
          return { ...booking, item: itemDoc.exists() ? { id: itemDoc.id, ...itemDoc.data() } as RentableItem : undefined };
        }));
        setBookings(bookingData);

        // Fetch My Items
        const itemsQuery = query(collection(db, 'items'), where('ownerId', '==', user.uid));
        const itemsSnap = await getDocs(itemsQuery);
        setMyItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as RentableItem)));

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const earningsData = {
    total: bookings.filter(b => b.status === 'completed').reduce((acc, b) => acc + (b.totalCost || 0), 0),
    pending: bookings.filter(b => ['active', 'confirmed', 'handover_done', 'return_requested', 'inspecting'].includes(b.status)).reduce((acc, b) => acc + (b.totalCost || 0), 0),
    count: bookings.filter(b => b.status === 'completed').length
  };

  const updateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      const b = bookings.find(x => x.id === bookingId);
      if (!b) return;

      await updateDoc(doc(db, 'bookings', bookingId), { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });

      // Notify Chat
      const convQuery = query(collection(db, 'conversations'), where('bookingId', '==', bookingId), limit(1));
      const convSnap = await getDocs(convQuery);
      if (!convSnap.empty) {
        const convId = convSnap.docs[0].id;
        
        let systemText = `Booking status updated: ${newStatus.replace(/_/g, ' ')}`;
        let widgetProps: any = null;

        if (newStatus === 'accepted_by_owner') {
          systemText = "✅ Owner has accepted your request. Please complete the payment to lock the deal.";
          widgetProps = {
            type: 'widget',
            widgetType: 'payment_trigger' as any,
            metadata: { 
              amount: b.totalCost + b.platformFee + b.depositHeld, 
              itemName: b.item?.title 
            }
          };
        }

        if (newStatus === 'rejected_by_owner' || newStatus === 'disputed') {
          systemText = "❌ This request has been declined or disputed by the owner.";
        }

        await addDoc(collection(db, 'conversations', convId, 'messages'), {
          senderId: user!.uid,
          text: systemText,
          type: widgetProps ? 'widget' : 'system',
          ...widgetProps,
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'conversations', convId), {
           lastMessage: systemText,
           updatedAt: serverTimestamp()
        });
      }

      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setSelectedBooking(null);
    } catch (e) {
      console.error(e);
    }
  };

  const processReturn = async () => {
    if (!selectedBooking) return;
    
    let penalty = 0;
    if (damageLevel === 'minor') penalty = selectedBooking.depositHeld * 0.15;
    else if (damageLevel === 'medium') penalty = selectedBooking.depositHeld * 0.5;
    else if (damageLevel === 'major') penalty = selectedBooking.depositHeld * 1.5; // Damage > Deposit
    else if (damageLevel === 'missing_parts') penalty = selectedBooking.depositHeld * 0.3;

    try {
      const outstandingBalance = Math.max(0, penalty - selectedBooking.depositHeld);
      const isSevere = damageLevel === 'major' || outstandingBalance > 0;
      const refundAmount = Math.max(0, selectedBooking.depositHeld - penalty);

      // Trigger Razorpay Refund for deposit
      if (refundAmount > 0) {
        const txQuery = query(collection(db, 'transactions'), where('bookingId', '==', selectedBooking.id), limit(1));
        const txSnap = await getDocs(txQuery);
        if (!txSnap.empty) {
          const tx = txSnap.docs[0].data();
          await processRefund(tx.razorpayPaymentId, refundAmount, {
            reason: `Deposit refund for booking ${selectedBooking.id}`,
            bookingId: selectedBooking.id
          });
          
          await addDoc(collection(db, 'transactions'), {
            bookingId: selectedBooking.id,
            userId: selectedBooking.renterId,
            amount: -refundAmount, // Negative for refund
            razorpayPaymentId: `REF_${tx.razorpayPaymentId}`,
            status: 'SUCCESS',
            type: 'REFUND',
            createdAt: serverTimestamp()
          });

          await addDoc(collection(db, 'audit_logs'), {
             type: 'REFUND',
             userId: user!.uid,
             details: `Refund of ₹${refundAmount} initiated for booking ${selectedBooking.id}`,
             metadata: { paymentId: tx.razorpayPaymentId },
             timestamp: serverTimestamp()
          });
        }
      }

      const billData: RentalBill = {
        bookingId: selectedBooking.id,
        renterId: selectedBooking.renterId,
        ownerId: selectedBooking.ownerId,
        itemTitle: selectedBooking.item?.title || 'Item',
        duration: `${selectedBooking.durationValue} ${selectedBooking.durationUnit}`,
        totalRent: selectedBooking.totalCost,
        deposit: selectedBooking.depositHeld,
        platformFee: selectedBooking.platformFee,
        totalAmount: selectedBooking.totalCost + selectedBooking.platformFee + penalty,
        damageCharge: penalty,
        refundAmount: refundAmount,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'bookings', selectedBooking.id), {
        status: 'bill_generated',
        damageLevel,
        penaltyAmount: penalty,
        damagePhotosPost: postPhotos,
        bill: billData,
        updatedAt: serverTimestamp()
      });

      // Notify Chat with Return Widgets
      const convQuery = query(collection(db, 'conversations'), where('bookingId', '==', selectedBooking.id), limit(1));
      const convSnap = await getDocs(convQuery);
      if (!convSnap.empty) {
        const convId = convSnap.docs[0].id;
        
        if (damageLevel !== 'none') {
           await addDoc(collection(db, 'conversations', convId, 'messages'), {
             senderId: user!.uid,
             text: `Damage assessment completed: ${damageLevel}`,
             type: 'widget',
             widgetType: 'return_form',
             metadata: { damageLevel, penalty },
             createdAt: serverTimestamp()
           });
        }

        await addDoc(collection(db, 'conversations', convId, 'messages'), {
          senderId: user!.uid,
          text: `Final settlement generated. Refund processed: ₹${refundAmount}`,
          type: 'widget',
          widgetType: 'bill_summary',
          metadata: { bill: billData },
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'conversations', convId), {
           lastMessage: 'Final Bill Generated',
           updatedAt: serverTimestamp()
        });
      }

      // Update user balances and status
      const renterRef = doc(db, 'users', selectedBooking.renterId);
      await updateDoc(renterRef, {
         trustScore: increment(damageLevel === 'none' ? 2 : -15),
         outstandingBalance: increment(outstandingBalance),
         isRestricted: isSevere
      });

      if (isSevere) {
         // Log for admin
         await addDoc(collection(db, 'disputes'), {
            bookingId: selectedBooking.id,
            itemId: selectedBooking.itemId,
            renterId: selectedBooking.renterId,
            ownerId: selectedBooking.ownerId,
            ownerClaim: `Severe damage reported (${damageLevel}). Balance: ₹${outstandingBalance}`,
            damageLevel: damageLevel,
            penaltyAmount: penalty,
            status: 'pending',
            createdAt: serverTimestamp()
         });
      }

      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'completed', penaltyAmount: penalty } : b));
      setShowInspector(false);
      setSelectedBooking(null);
      
      let message = penalty > 0 
        ? `Return processed. Penalty of ₹${penalty} applied.` 
        : "Return processed successfully. Full deposit refunded.";
      if (outstandingBalance > 0) message += `\nUser has been restricted due to ₹${outstandingBalance} pending balance.`;
      
      alert(message);
    } catch (e) {
      console.error(e);
    }
  };

  const requests = bookings.filter(b => b.status === 'request_sent');
  const activeRentals = bookings.filter(b => ['accepted_by_owner', 'awaiting_payment', 'confirmed', 'out_for_handover', 'handover_done', 'active', 'return_requested', 'inspecting'].includes(b.status));

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-lg mx-auto">
      <header className="bg-white p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Provider Hub</h1>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Manage your assets</p>
        </div>
      </header>

      <div className="p-4">
        {/* Tabs */}
        <div className="flex bg-white p-1.5 rounded-[24px] border border-gray-100 mb-6 font-black text-[9px] uppercase tracking-widest overflow-x-auto no-scrollbar">
          {[
            { id: 'requests', label: `Requests (${requests.length})` },
            { id: 'rentals', label: 'Rentals' },
            { id: 'items', label: 'Listings' },
            { id: 'earnings', label: 'Earnings' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-fit px-4 py-3.5 rounded-[20px] transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-gray-900 text-white shadow-xl shadow-gray-200' : 'text-gray-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-[32px]" />)}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <EmptyState icon={<Clock size={40} />} title="No new requests" sub="Requests from neighbors will appear here" />
            ) : (
              requests.map(b => (
                <div key={b.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="flex gap-5 mb-6">
                    <img src={b.item?.images[0]} className="w-20 h-20 rounded-[24px] object-cover shadow-sm" alt="" />
                    <div className="flex-1">
                      <h3 className="font-black text-gray-900 text-lg leading-tight mb-1">{b.item?.title}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mb-2">{format(new Date(b.startDate), 'MMM dd')} - {format(new Date(b.endDate), 'MMM dd')}</p>
                      <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                        EARNING ₹{b.totalCost}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => updateBookingStatus(b.id, 'accepted_by_owner')}
                      className="flex-1 bg-gray-900 text-white py-4 rounded-[20px] text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-gray-200"
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => updateBookingStatus(b.id, 'disputed')} 
                      className="px-6 bg-red-50 text-red-600 rounded-[20px] flex items-center justify-center active:scale-95 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'rentals' ? (
          <div className="space-y-4">
             {activeRentals.length === 0 ? (
               <EmptyState icon={<ShieldCheck size={40} />} title="No active deals" sub="Accepted requests that are in progress" />
             ) : (
               activeRentals.map(b => (
                <div key={b.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col gap-5">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <img src={b.item?.images[0]} className="w-20 h-20 rounded-[24px] object-cover shadow-sm" alt="" />
                      <div>
                        <h3 className="font-black text-gray-900 mb-1">{b.item?.title}</h3>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.status} />
                          <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider">ID: {b.id.substring(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-[24px] border border-white shadow-inner">
                    {b.status === 'accepted_by_owner' && (
                       <p className="text-[11px] text-gray-500 font-bold text-center italic">Waiting for neighbor to complete payment...</p>
                    )}
                    {b.status === 'confirmed' && (
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] text-primary-600 font-black uppercase tracking-widest">Paid & Ready</p>
                        <button 
                          onClick={() => updateBookingStatus(b.id, 'out_for_handover')}
                          className="bg-gray-900 text-white px-5 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-gray-200"
                        >
                          Start Handover <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                    {b.status === 'out_for_handover' && (
                      <div className="flex items-center justify-center gap-3">
                         <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                         <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">Handover in progress...</p>
                      </div>
                    )}
                    {b.status === 'active' && (
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                         <p className="text-[11px] text-gray-600 font-black uppercase tracking-widest">Item is with Borrower</p>
                      </div>
                    )}
                    {(b.status === 'return_requested' || b.status === 'inspecting') && (
                      <div className="flex justify-between items-center">
                        <div>
                           <p className="text-xs text-blue-900 font-black uppercase tracking-widest">Action Required</p>
                           <p className="text-[10px] text-blue-600 font-bold">Item returned for inspection</p>
                        </div>
                        <button 
                          onClick={() => { setSelectedBooking(b); setShowInspector(true); }}
                          className="bg-gray-900 text-white px-6 py-3.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-200"
                        >
                          Inspect Item
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
             )}
          </div>
        ) : activeTab === 'items' ? (
          <div className="space-y-4">
             <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">My Assets</h3>
                <button 
                  onClick={() => navigate('/add-item')}
                  className="text-primary-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"
                >
                  <PlusCircle size={14} /> Add New
                </button>
             </div>
             {myItems.length === 0 ? (
               <EmptyState icon={<Package size={40} />} title="No items listed" sub="Put your idle tools to work" />
             ) : (
               myItems.map(item => (
                 <div key={item.id} className="bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4">
                   <img src={item.images[0]} className="w-16 h-16 rounded-[20px] object-cover" alt="" />
                   <div className="flex-1">
                     <h4 className="font-bold text-sm text-gray-900">{item.title}</h4>
                     <p className="text-[10px] text-emerald-600 font-bold">₹{item.pricePerDay}/day</p>
                   </div>
                   <div className="flex gap-2">
                     <button 
                       onClick={() => navigate(`/edit-item/${item.id}`)}
                       className="p-2.5 bg-gray-50 text-gray-400 rounded-xl active:bg-gray-100"
                     >
                       <Edit3 size={16} />
                     </button>
                   </div>
                 </div>
               ))
             )}
          </div>
        ) : (
          <div className="space-y-6">
             <div className="bg-gray-900 p-8 rounded-[40px] text-white overflow-hidden relative shadow-2xl shadow-gray-400">
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 mb-2">Total Earnings</p>
                   <h2 className="text-4xl font-black">₹{earningsData.total.toLocaleString()}</h2>
                   <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur">
                         <p className="text-[9px] font-black uppercase tracking-widest text-primary-200 mb-1">Deals Done</p>
                         <p className="text-lg font-black">{earningsData.count}</p>
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur">
                         <p className="text-[9px] font-black uppercase tracking-widest text-primary-200 mb-1">In Pipeline</p>
                         <p className="text-lg font-black">₹{earningsData.pending.toLocaleString()}</p>
                      </div>
                   </div>
                </div>
                <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12">
                   <Wallet size={120} />
                </div>
             </div>

             <div className="bg-white rounded-[40px] border border-gray-100 p-6 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 px-2">Completed Transactions</h3>
                <div className="space-y-4">
                   {bookings.filter(b => b.status === 'completed').map(b => (
                     <div key={b.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                              <ShieldCheck size={18} />
                           </div>
                           <div>
                              <p className="text-xs font-bold text-gray-900">{b.item?.title}</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{format(new Date(b.updatedAt as any || 0), 'MMM dd, yyyy')}</p>
                           </div>
                        </div>
                        <p className="text-sm font-black text-emerald-600">+₹{b.totalCost}</p>
                     </div>
                   ))}
                   {bookings.filter(b => b.status === 'completed').length === 0 && (
                     <p className="text-center py-10 text-[11px] text-gray-400 font-bold uppercase tracking-widest">No earnings yet</p>
                   )}
                </div>
             </div>
          </div>
        )}
      </div>


      {/* Return Inspection Modal */}
      <AnimatePresence>
        {showInspector && selectedBooking && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex items-end"
            onClick={() => setShowInspector(false)}
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[32px] p-6 max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-1">Return Inspection</h2>
              <p className="text-sm text-gray-500 mb-6">Inspect {selectedBooking.item?.title}</p>
              
              <div className="space-y-6">
                 <div>
                   <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                     <AlertCircle size={18} className="text-primary-600" />
                     Damage Status
                   </h3>
                   <div className="grid grid-cols-2 gap-3">
                      {(['none', 'minor', 'medium', 'major', 'missing_parts'] as DamageLevel[]).map(level => (
                        <button
                          key={level}
                          onClick={() => setDamageLevel(level)}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            damageLevel === level ? 'border-primary-600 bg-primary-50' : 'border-gray-100'
                          }`}
                        >
                          <p className="text-xs font-bold capitalize">{level.replace('_', ' ')}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {level === 'none' ? 'Perfect condition' : `Penalty: ₹${Math.round(selectedBooking.depositHeld * DAMAGE_RATES[level])}`}
                          </p>
                        </button>
                      ))}
                   </div>
                 </div>

                 <div>
                    <h3 className="text-sm font-bold mb-3">Verification Photos</h3>
                    <div className="grid grid-cols-3 gap-3">
                       {[0,1,2].map(i => (
                         <div key={i} className="aspect-square bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                           <Camera size={24} />
                         </div>
                       ))}
                    </div>
                 </div>

                 <button 
                  onClick={processReturn}
                  className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary-100 active:scale-95 transition-all"
                 >
                   Complete Inspection & Refund
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    request_sent: 'bg-amber-50 text-amber-700 border-amber-100',
    accepted_by_owner: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    awaiting_payment: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    pending_approval: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    confirmed: 'bg-green-50 text-green-700 border-green-100',
    out_for_handover: 'bg-orange-50 text-orange-700 border-orange-100',
    handover_done: 'bg-blue-50 text-blue-700 border-blue-100',
    active: 'bg-primary-50 text-primary-700 border-primary-100',
    return_requested: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    inspecting: 'bg-purple-50 text-purple-700 border-purple-100',
    completed: 'bg-gray-50 text-gray-700 border-gray-100',
    disputed: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function EmptyState({ icon, title, sub }: { icon: ReactNode, title: string, sub: string }) {
  return (
    <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-gray-200">
      <div className="text-gray-200 mb-4 flex justify-center">{icon}</div>
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
