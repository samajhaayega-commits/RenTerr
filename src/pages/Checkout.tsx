import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, limit, updateDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { RentableItem } from '../types';
import { ChevronLeft, Calendar, CreditCard, Lock, AlertCircle, ShieldCheck, Clock, ShieldAlert, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { format, addDays, addHours, addMinutes, addMonths } from 'date-fns';

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  
  const [item, setItem] = useState<RentableItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Parse duration from URL
  const queryParams = new URLSearchParams(location.search);
  const durationValue = parseInt(queryParams.get('value') || '1');
  const durationUnit = (queryParams.get('unit') || 'days') as 'minutes' | 'hours' | 'days' | 'months';

  const startDate = new Date();
  let endDate = new Date();
  if (durationUnit === 'minutes') endDate = addMinutes(startDate, durationValue);
  else if (durationUnit === 'hours') endDate = addHours(startDate, durationValue);
  else if (durationUnit === 'days') endDate = addDays(startDate, durationValue);
  else if (durationUnit === 'months') endDate = addMonths(startDate, durationValue);

  useEffect(() => {
    async function fetchItem() {
      if (!id) return;
      try {
        const itemDoc = await getDoc(doc(db, 'items', id));
        if (itemDoc.exists()) {
          setItem({ id: itemDoc.id, ...itemDoc.data() } as RentableItem);
        }
      } catch (error) {
        console.error("Error fetching item:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id]);

  const [selectedPayment, setSelectedPayment] = useState('upi');

  const handleBooking = async () => {
    if (!user || !item) return;
    setBookingLoading(true);
    const path = 'bookings';
    const totalRent = item.price * durationValue;
    const platformFee = Math.round(totalRent * 0.10); // Reduced to 10% for RenTer app
    try {
      const bookingData = {
        itemId: item.id,
        renterId: user.uid,
        ownerId: item.ownerId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationValue,
        durationUnit,
        totalCost: totalRent,
        depositHeld: item.deposit,
        platformFee,
        status: 'request_sent',
        paymentMethod: selectedPayment,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, path), bookingData);
      
      // Notify Chat with Widget
      // Find or create conversation
      const q = query(
        collection(db, 'conversations'), 
        where('itemId', '==', item.id), 
        where('participants', 'array-contains', user.uid),
        limit(1)
      );
      const snapshot = await getDocs(q);
      let convId = '';
      
      if (!snapshot.empty) {
        convId = snapshot.docs[0].id;
        await updateDoc(doc(db, 'conversations', convId), { 
          bookingId: docRef.id,
          lastMessage: 'New Booking Request',
          updatedAt: serverTimestamp()
        });
      } else {
        const newConv = await addDoc(collection(db, 'conversations'), {
          participants: [user.uid, item.ownerId],
          itemId: item.id,
          bookingId: docRef.id,
          itemTitle: item.title,
          itemImage: item.images[0],
          lastMessage: 'New Booking Request',
          updatedAt: serverTimestamp()
        });
        convId = newConv.id;
      }

      // Send the widget message
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        senderId: user.uid,
        text: `Interested in renting ${item.title}`,
        type: 'widget',
        widgetType: 'booking_request',
        metadata: {
          duration: `${durationValue} ${durationUnit}`,
          price: totalRent,
          bookingId: docRef.id
        },
        createdAt: serverTimestamp()
      });

      navigate(`/booking-success/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!item) return <div className="p-10 text-center">Item not found</div>;

  const totalRent = item.price * durationValue;
  const platformFee = Math.round(totalRent * 0.10);
  const totalAmount = totalRent + platformFee + item.deposit;

  return (
    <div className="min-h-screen bg-gray-50 pb-32 max-w-lg mx-auto">
      <header className="bg-white p-6 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-gray-900 bg-gray-50 p-2 rounded-xl">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Review Request</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Item Summary */}
        <div className="bg-white p-4 rounded-[32px] flex gap-4 shadow-sm border border-gray-100">
          <img src={item.images[0]} className="w-24 h-24 rounded-[22px] object-cover shadow-sm" alt="" />
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{item.title}</h3>
            <div className="flex items-center gap-2">
               <div className="flex items-center gap-1 text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded uppercase tracking-wider">
                 <ShieldCheck size={12} />
                 Verified
               </div>
               {item.depositType === 'no_deposit' && (
                 <div className="flex items-center gap-1 text-[10px] font-black text-secondary-600 bg-secondary-50 px-2 py-0.5 rounded uppercase tracking-wider">
                   No Deposit
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Date Selection Info */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
             <Clock size={80} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Duration Summary</h2>
          <div className="flex items-center justify-between bg-gray-50 p-6 rounded-[24px] relative z-10">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Pick up</p>
              <p className="font-black text-sm text-gray-900">{format(startDate, 'MMM dd, HH:mm')}</p>
            </div>
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
               <ChevronLeft className="rotate-180 text-gray-300" size={16} />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Return</p>
              <p className="font-black text-sm text-gray-900">{format(endDate, 'MMM dd, HH:mm')}</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs font-bold text-primary-600 bg-primary-50 py-2 rounded-xl">
             Total: {durationValue} {durationUnit}
          </p>
        </div>

        {/* Payment Summary */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Payment Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Base Rent</span>
              <span className="font-black text-gray-900">₹{totalRent}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Platform Fee</span>
              <span className="font-black text-gray-900">₹{platformFee}</span>
            </div>
            <div className="flex justify-between items-center text-sm pb-4 border-b border-gray-50">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Deductible Deposit</span>
              <span className="font-black text-gray-900">₹{item.deposit}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-900 font-black uppercase tracking-widest text-xs">Estimated Total</span>
              <span className="text-2xl font-black text-primary-600 tracking-tighter">₹{totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Double Confirmation Info */}
        <div className="bg-indigo-50 p-6 rounded-[32px] flex gap-4 border border-indigo-100 relative overflow-hidden group">
           <div className="bg-white p-3 rounded-2xl shadow-sm text-indigo-600 shrink-0">
              <ShieldCheck size={24} />
           </div>
           <div>
              <p className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">Double Confirmation</p>
              <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
                Owner must accept your request first. You will only pay once both parties confirm the deal.
              </p>
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-gray-50 z-50">
        <button
          onClick={handleBooking}
          disabled={bookingLoading}
          className="w-full bg-gray-900 text-white py-5 rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-gray-300 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {bookingLoading ? 'Sending...' : 'Send Rental Request'}
          {!bookingLoading && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
}
