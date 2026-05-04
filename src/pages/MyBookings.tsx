import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Booking, RentableItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, CheckCircle2, Clock, AlertCircle, ChevronRight, X, MessageSquare, ShieldCheck, History } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<(Booking & { item?: RentableItem })[]>([]);
  const [lendingBookings, setLendingBookings] = useState<(Booking & { item?: RentableItem })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking & { item?: RentableItem } | null>(null);
  const [activeTab, setActiveTab] = useState<'borrowing' | 'lending'>('borrowing');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    async function fetchBookings() {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch Borrowings
        const q = query(
          collection(db, 'bookings'), 
          where('renterId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const borrowingData = await Promise.all(snapshot.docs.map(async (d) => {
          const booking = { id: d.id, ...d.data() } as Booking;
          const itemDoc = await getDoc(doc(db, 'items', booking.itemId));
          return { ...booking, item: itemDoc.exists() ? { id: itemDoc.id, ...itemDoc.data() } as RentableItem : undefined };
        }));
        setBookings(borrowingData);

        // Fetch Lendings
        const lq = query(
          collection(db, 'bookings'), 
          where('ownerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const lSnap = await getDocs(lq);
        const lendingData = await Promise.all(lSnap.docs.map(async (d) => {
          const booking = { id: d.id, ...d.data() } as Booking;
          const itemDoc = await getDoc(doc(db, 'items', booking.itemId));
          return { ...booking, item: itemDoc.exists() ? { id: itemDoc.id, ...itemDoc.data() } as RentableItem : undefined };
        }));
        setLendingBookings(lendingData);

      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [user]);

  const getFilteredBookings = (data: (Booking & { item?: RentableItem })[]) => {
    switch(filter) {
      case 'active': return data.filter(b => !['completed', 'disputed'].includes(b.status));
      case 'completed': return data.filter(b => b.status === 'completed');
      case 'cancelled': return data.filter(b => b.status === 'disputed'); // Assuming dispute/reject as cancelled for now
      default: return data;
    }
  };

  const currentBookings = getFilteredBookings(activeTab === 'borrowing' ? bookings : lendingBookings);

  const [uploading, setUploading] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  const capturePhoto = (index: number) => {
    // Open file picker instead of simulating
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        const newPhotos = [...capturedPhotos];
        newPhotos[index] = url;
        setCapturedPhotos(newPhotos);
      }
    };
    input.click();
  };

  const updateStatus = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setSelectedBooking(null);
    } catch (error) {
      console.error(error);
    }
  };

  const confirmHandover = async () => {
    if (!selectedBooking) return;
    setUploading(true);
    try {
      await updateDoc(doc(db, 'bookings', selectedBooking.id), { 
        status: 'active',
        checklistVerificationPre: selectedBooking.item?.checklist.map(() => true) || []
      });
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'active' } : b));
      setSelectedBooking(null);
      alert("Rental started! Please take care of the tool.");
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pb-32 pt-6 px-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Rent History</h1>
        <div className="flex bg-gray-100 p-1 rounded-xl font-black text-[9px] uppercase tracking-widest">
           <button 
             onClick={() => setActiveTab('borrowing')}
             className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'borrowing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
           >
             Borrowed
           </button>
           <button 
             onClick={() => setActiveTab('lending')}
             className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'lending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
           >
             Lent
           </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
         {['all', 'active', 'completed', 'cancelled'].map((f) => (
           <button
             key={f}
             onClick={() => setFilter(f as any)}
             className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
               filter === f ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200' : 'bg-white text-gray-400 border-gray-100'
             }`}
           >
             {f}
           </button>
         ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="bg-gray-100 h-32 rounded-[32px] animate-pulse" />)}
        </div>
      ) : currentBookings.length > 0 ? (
        <div className="space-y-4">
          {currentBookings.map((booking) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm flex gap-4 cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => setSelectedBooking(booking)}
            >
              <img src={booking.item?.images[0]} className="w-20 h-20 rounded-2xl object-cover shadow-sm" alt="" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h3 className="font-black text-xs text-gray-900 truncate">{booking.item?.title}</h3>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider mb-2">
                  {format(new Date(booking.startDate), 'MMM dd')} - {format(new Date(booking.endDate), 'MMM dd')}
                </p>
                <div className="flex justify-between items-center">
                   <span className="text-secondary-600 font-black text-sm">₹{booking.totalCost}</span>
                   <div className="px-3 py-1.5 bg-gray-50 rounded-xl flex items-center gap-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                     Details <ChevronRight size={10} />
                   </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-10 bg-white rounded-[40px] border border-dashed border-gray-200">
           <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
              <History size={32} />
           </div>
           <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">No history found</p>
           {activeTab === 'borrowing' && (
             <button onClick={() => navigate('/')} className="mt-4 text-primary-600 font-black text-[10px] uppercase tracking-widest">Start Exploring Tools</button>
           )}
        </div>
      )}

      {/* Booking Details Drawer */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[60] flex items-end"
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full bg-white rounded-t-[40px] p-8 max-w-lg mx-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-8" />
              
              <div className="flex items-center gap-4 mb-8">
                <img src={selectedBooking.item?.images[0]} className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-gray-100" alt="" />
                <div>
                  <h2 className="text-xl font-bold">{selectedBooking.item?.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedBooking.status} />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">#{selectedBooking.id.substring(0, 8)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Workflow Card */}
                <div className="p-5 border-2 border-gray-50 bg-gray-50/30 rounded-[32px]">
                   {selectedBooking.status === 'request_sent' && (
                     <div className="text-center py-4">
                        <Clock className="mx-auto text-amber-500 mb-3" size={28} />
                        <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest">Request Sent</h4>
                        <p className="text-[11px] text-gray-500 mt-2 font-medium">Waiting for owner to accept...</p>
                     </div>
                   )}

                   {selectedBooking.status === 'accepted_by_owner' && (
                     <div className="text-center py-4">
                        <ShieldCheck className="mx-auto text-green-600 mb-3" size={28} />
                        <h4 className="font-black text-green-900 text-xs uppercase tracking-widest">Deal Accepted!</h4>
                        <p className="text-[11px] text-green-700 mt-2 mb-6 font-medium">Proceed to payment to confirm.</p>
                        <button 
                          onClick={() => updateStatus(selectedBooking.id, 'confirmed')}
                          className="w-full bg-gray-900 text-white py-4 rounded-[20px] font-black uppercase tracking-widest text-[10px] shadow-lg shadow-gray-200"
                        >
                          Pay ₹{selectedBooking.totalCost + (selectedBooking.item?.deposit || 0)}
                        </button>
                     </div>
                   )}
                   
                   {selectedBooking.status === 'confirmed' && (
                     <div className="text-center py-4">
                        <CheckCircle2 className="mx-auto text-primary-600 mb-3" size={28} />
                        <h4 className="font-black text-primary-900 text-xs uppercase tracking-widest">Paid & Confirmed</h4>
                        <p className="text-[11px] text-primary-700 mt-2 font-medium">Ready for handover. Coordinate with owner.</p>
                     </div>
                   )}

                   {selectedBooking.status === 'out_for_handover' && (
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 text-orange-600">
                           <AlertCircle size={20} />
                           <h4 className="font-bold text-sm">Confirm Item Details</h4>
                        </div>
                        <div className="bg-white p-4 rounded-2xl space-y-3">
                           <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Parts Checklist</p>
                           {selectedBooking.item?.checklist.map((part, i) => (
                             <div key={i} className="flex items-center gap-3 text-sm">
                               <div className="w-5 h-5 rounded-md border-2 border-primary-500 bg-primary-50 flex items-center justify-center">
                                  <CheckCircle2 size={12} className="text-primary-600" />
                               </div>
                               <span className="text-gray-700">{part}</span>
                             </div>
                           ))}
                        </div>
                        <button 
                          onClick={confirmHandover}
                          className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary-200"
                        >
                          Confirm Handover & Start Rent
                        </button>
                     </div>
                   )}

                   {selectedBooking.status === 'active' && (
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 text-primary-600">
                           <Clock size={20} />
                           <h4 className="font-bold text-sm">Rental in Progress</h4>
                        </div>
                        <p className="text-xs text-primary-700">Please return the tool on time to maintain your Trust Score.</p>
                        <button 
                          onClick={() => updateStatus(selectedBooking.id, 'return_requested')}
                          className="w-full bg-white border-2 border-primary-600 text-primary-600 py-4 rounded-2xl font-bold shadow-sm"
                        >
                          Initiate Return
                        </button>
                     </div>
                   )}

                   {selectedBooking.status === 'return_requested' && (
                     <div className="text-center py-2">
                        <Clock className="mx-auto text-indigo-600 mb-2" size={24} />
                        <h4 className="font-bold text-indigo-900 text-sm">Return Requested</h4>
                        <p className="text-xs text-indigo-700 mt-1">Please drop off the item. Owner will inspect and complete the rental.</p>
                     </div>
                   )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                     <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Deposit</p>
                     <p className="text-sm font-bold">₹{selectedBooking.depositHeld}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                     <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Rental Total</p>
                     <p className="text-sm font-bold">₹{selectedBooking.totalCost}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => navigate(`/chat/new?bookingId=${selectedBooking.id}`)}
                    className="flex-1 bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                  >
                    <MessageSquare size={18} />
                    Chat
                  </button>
                  <button className="flex-1 bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                    Support
                  </button>
                </div>
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

