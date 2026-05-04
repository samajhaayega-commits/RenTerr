/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  limit,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { BookingStatus, ChatMessage, Conversation, RentableItem, Booking, RentalBill } from '../types';
import { ChevronLeft, Send, Image as ImageIcon, Receipt, ShieldCheck, Clock, CheckCircle2, FileText, Star, Camera, X, AlertTriangle, ArrowRight, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import MitraAI from '../components/MitraAI';
import { loadRazorpayScript, createRazorpayOrder, verifyPayment, simulateDummyPayment } from '../services/paymentService';
import { createAuditLog } from '../services/auditService';

export default function Chat() {
  const { chatId: paramChatId } = useParams();
  const [searchParams] = useSearchParams();
  const itemIdParam = searchParams.get('itemId');
  const bookingIdParam = searchParams.get('bookingId');
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(paramChatId && paramChatId !== 'new' ? paramChatId : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [item, setItem] = useState<RentableItem | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  
  const totalPaymentAmount = booking ? (booking.totalCost + booking.platformFee + booking.depositHeld) : 0;

  const handleRazorpayPayment = async () => {
    if (!booking || !item || !user) return;
    setIsPaymentLoading(true);

    const isTestMode = import.meta.env.VITE_PAYMENT_MODE === 'test';

    try {
      if (isTestMode) {
        const response: any = await simulateDummyPayment(totalPaymentAmount, booking.id);
        
        await addDoc(collection(db, 'transactions'), {
          bookingId: booking.id,
          userId: user.uid,
          amount: totalPaymentAmount,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          status: 'SUCCESS',
          type: 'DUMMY',
          createdAt: serverTimestamp()
        });

        await updateBookingStatus('confirmed');
        await createAuditLog('PAYMENT', `Test Payment Success: ${response.razorpay_payment_id}`, user.uid, { bookingId: booking.id });
        return;
      }

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) throw new Error('Razorpay SDK failed to load');

      const order = await createRazorpayOrder({
        amount: totalPaymentAmount,
        currency: 'INR',
        receipt: `receipt_${booking.id}`,
        notes: { bookingId: booking.id, userId: user.uid }
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Renter Platform',
        description: `Payment for ${item.title}`,
        order_id: order.id,
        handler: async (response: any) => {
          const verification = await verifyPayment(response);
          if (verification.verified) {
            await addDoc(collection(db, 'transactions'), {
              bookingId: booking.id,
              userId: user.uid,
              amount: totalPaymentAmount,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              status: 'SUCCESS',
              createdAt: serverTimestamp()
            });

            await updateBookingStatus('confirmed');
            await createAuditLog('PAYMENT', `Razorpay Payment Success: ${response.razorpay_payment_id}`, user.uid, { bookingId: booking.id });
          } else {
            alert('Payment verification failed');
            await createAuditLog('FRAUD_DETECTED', 'Possible payment spoofing attempt', user.uid, { orderId: order.id });
          }
        },
        prefill: {
          name: user.displayName || '',
          email: user.email || '',
        },
        theme: { color: '#4F46E5' }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', async (response: any) => {
        console.error(response.error);
        await createAuditLog('PAYMENT', `Razorpay Payment Failed: ${response.error.code}`, user.uid, { bookingId: booking.id });
      });
      rzp.open();
    } catch (error: any) {
      console.error(error);
      alert('Payment initialization failed');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isBillGenerating, setIsBillGenerating] = useState(false);
  console.log(isBillGenerating); // Avoid unused warning if not used yet

  const isOwner = user?.uid === item?.ownerId;

  // Handle Conversation Initialization
  useEffect(() => {
    async function initChat() {
      if (!user) return;

      if (paramChatId && paramChatId !== 'new') {
        const convDoc = await getDoc(doc(db, 'conversations', paramChatId));
        if (convDoc.exists()) {
          const convData = { id: convDoc.id, ...convDoc.data() } as Conversation;
          setConversation(convData);
          setChatId(convDoc.id);
          
          const itemDoc = await getDoc(doc(db, 'items', convData.itemId));
          if (itemDoc.exists()) setItem({ id: itemDoc.id, ...itemDoc.data() } as RentableItem);

          if (convData.bookingId) {
             const bookingDoc = await getDoc(doc(db, 'bookings', convData.bookingId));
             if (bookingDoc.exists()) setBooking({ id: bookingDoc.id, ...bookingDoc.data() } as Booking);
          }
        } else {
          navigate('/inbox');
        }
        setLoading(false);
      } else if (bookingIdParam) {
        const q = query(collection(db, 'conversations'), where('bookingId', '==', bookingIdParam), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) navigate(`/chat/${snapshot.docs[0].id}`, { replace: true });
        else {
          const bookingDoc = await getDoc(doc(db, 'bookings', bookingIdParam));
          if (bookingDoc.exists()) {
            const b = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;
            const itemDoc = await getDoc(doc(db, 'items', b.itemId));
            const itemData = itemDoc.exists() ? itemDoc.data() as RentableItem : null;
            const newConvData = {
              participants: [b.renterId, b.ownerId],
              itemId: b.itemId,
              bookingId: bookingIdParam,
              itemTitle: itemData?.title || 'Unknown Item',
              itemImage: itemData?.images[0] || '',
              lastMessage: '',
              updatedAt: serverTimestamp(),
            };
            const newDocRef = await addDoc(collection(db, 'conversations'), newConvData);
            navigate(`/chat/${newDocRef.id}`, { replace: true });
          } else navigate('/');
        }
      } else if (itemIdParam) {
        const q = query(collection(db, 'conversations'), where('itemId', '==', itemIdParam), where('participants', 'array-contains', user.uid), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) navigate(`/chat/${snapshot.docs[0].id}`, { replace: true });
        else {
          const itemDoc = await getDoc(doc(db, 'items', itemIdParam));
          if (itemDoc.exists()) {
            const itemData = itemDoc.data() as RentableItem;
            const newConvData = {
              participants: [user.uid, itemData.ownerId],
              itemId: itemIdParam,
              itemTitle: itemData.title,
              itemImage: itemData.images[0] || '',
              lastMessage: '',
              updatedAt: serverTimestamp(),
            };
            const newDocRef = await addDoc(collection(db, 'conversations'), newConvData);
            navigate(`/chat/${newDocRef.id}`, { replace: true });
          } else navigate('/');
        }
      }
    }
    initChat();
  }, [paramChatId, itemIdParam, user, navigate, bookingIdParam]);

  // Listen for messages
  useEffect(() => {
    if (!chatId || !user) return;
    const q = query(collection(db, 'conversations', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [chatId, user]);

  // Listen for booking updates
  useEffect(() => {
    if (!conversation?.bookingId) return;
    const unsubscribe = onSnapshot(doc(db, 'bookings', conversation.bookingId), (docSnap) => {
      if (docSnap.exists()) setBooking({ id: docSnap.id, ...docSnap.data() } as Booking);
    });
    return () => unsubscribe();
  }, [conversation?.bookingId]);

  const sendMessage = async (e?: React.FormEvent, customData?: Partial<ChatMessage>) => {
    e?.preventDefault();
    if (!newMessage.trim() && !customData && !user || !chatId) return;

    const text = customData?.text || newMessage.trim();
    if (!text && !customData?.bill) return;
    
    setNewMessage('');

    try {
      const msgData = {
        senderId: user!.uid,
        text: text || '',
        createdAt: serverTimestamp(),
        ...customData
      };
      await addDoc(collection(db, 'conversations', chatId, 'messages'), msgData);
      await updateDoc(doc(db, 'conversations', chatId), {
        lastMessage: text || 'View Bill',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const generateBill = async () => {
     if (!booking || !item || !user) return;
     
     const bill: RentalBill = {
       bookingId: booking.id,
       renterId: booking.renterId,
       ownerId: booking.ownerId,
       totalRent: booking.totalCost,
       deposit: booking.depositHeld,
       platformFee: booking.platformFee,
       totalAmount: booking.totalCost + booking.depositHeld + booking.platformFee,
       itemTitle: item.title,
       duration: `${booking.durationValue} ${booking.durationUnit}`,
       createdAt: new Date().toISOString()
     };

     await sendMessage(undefined, {
        text: `Rental Bill Generated: ₹${bill.totalAmount}`,
        bill
     });
  };

  const updateBookingStatus = async (newStatus: BookingStatus, customUpdates: Partial<Booking> = {}) => {
    if (!booking) return;
    try {
      const updates = { status: newStatus, updatedAt: serverTimestamp(), ...customUpdates };
      await updateDoc(doc(db, 'bookings', booking.id), updates);
      
      let systemText = `Booking status updated to: ${newStatus.replace(/_/g, ' ')}`;
      let widgetProps: any = null;

      if (newStatus === 'accepted_by_owner') {
        systemText = "✅ Owner has accepted your request. Please complete the payment to lock the deal.";
        widgetProps = {
          type: 'widget',
          widgetType: 'payment_trigger',
          metadata: { amount: totalPaymentAmount, itemName: item?.title }
        };
      }
      
      if (newStatus === 'confirmed') {
        systemText = "💰 Payment confirmed! The item is now locked for you.";
        widgetProps = {
          type: 'widget',
          widgetType: 'handover_form',
          metadata: { step: 'awaiting_owner_photos' }
        };
      }

      if (newStatus === 'out_for_handover') {
         systemText = "📸 Owner uploaded handover photos. Please confirm receipt.";
         widgetProps = {
           type: 'widget',
           widgetType: 'handover_form',
           metadata: { step: 'awaiting_borrower_confirm', photos: customUpdates.damagePhotosPre }
         };
      }

      if (newStatus === 'active') systemText = "🤝 Handover confirmed! Your rental starts now.";
      if (newStatus === 'return_requested') systemText = "📦 Return initiated. Neighbor will inspect the item shortly.";
      
      if (newStatus === 'damage_reported') {
        systemText = "⚠️ Damage reported. Generating final settlement...";
        widgetProps = {
          type: 'widget',
          widgetType: 'return_form',
          metadata: { damageLevel: customUpdates.damageLevel, penalty: customUpdates.penaltyAmount }
        };
      }

      if (newStatus === 'bill_generated') {
         systemText = "🧾 Final bill generated.";
         widgetProps = {
           type: 'widget',
           widgetType: 'bill_summary',
           metadata: { bill: customUpdates.bill }
         };
      }

      await sendMessage(undefined, { 
        text: systemText,
        type: widgetProps ? 'widget' : 'system' as any,
        ...widgetProps
      });
      
      // Auto-update conversation last message
      await updateDoc(doc(db, 'conversations', chatId!), {
        lastMessage: systemText,
        updatedAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  };

  const handleStartHandover = async () => {
    setIsHandoverModalOpen(true);
  };

  const confirmHandoverPhotos = async (photos: string[]) => {
    await updateBookingStatus('out_for_handover' as any, {
      damagePhotosPre: photos
    } as any);
    setIsHandoverModalOpen(false);
  };

  const handleConfirmHandover = async () => {
    await updateBookingStatus('active' as any, {
      startDate: new Date().toISOString(),
      checklistVerificationPre: item?.checklist.map(() => true) // Borrower confirms all
    } as any);
  };

  const handleRequestReturn = async () => {
    await updateBookingStatus('return_requested' as any);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-white">
    <div className="flex flex-col items-center gap-4">
       <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
       <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading Secure Chat</p>
    </div>
  </div>;

  const renderWidget = (msg: ChatMessage) => {
    const isMe = msg.senderId === user?.uid;
    const { widgetType, metadata } = msg;

    if (widgetType === 'booking_request' && !isMe && isOwner) {
      return (
        <div className="bg-white border-2 border-gray-100 rounded-[32px] p-6 shadow-xl max-w-[280px]">
           <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
              <Clock size={20} />
           </div>
           <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">New Booking Request</p>
           <h3 className="text-lg font-black text-gray-900 mb-2 truncate">{item?.title}</h3>
           <div className="space-y-1 mb-6">
              <p className="text-[10px] font-bold text-gray-400">Duration: {metadata?.duration}</p>
              <p className="text-[10px] font-bold text-gray-400">Proposed: ₹{metadata?.price}</p>
           </div>
           <div className="flex flex-col gap-2">
              <button 
                onClick={() => updateBookingStatus('accepted_by_owner')}
                className="w-full bg-gray-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Accept
              </button>
              <button 
                onClick={() => updateBookingStatus('rejected_by_owner')}
                className="w-full bg-red-50 text-red-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Reject
              </button>
           </div>
        </div>
      );
    }

    if (widgetType === 'payment_trigger' && !isMe && !isOwner) {
       return (
         <div className="bg-primary-600 text-white rounded-[32px] p-6 shadow-2xl max-w-[280px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
               <Wallet size={80} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Action Required</p>
            <h3 className="text-xl font-black mb-4">Secure Payment</h3>
            <p className="text-[11px] font-medium leading-relaxed mb-6 opacity-90">Pay ₹{metadata?.amount} to confirm your booking for "{metadata?.itemName}". Funds are held in escrow.</p>
            <button 
              onClick={handleRazorpayPayment}
              disabled={isPaymentLoading}
              className={`w-full bg-white text-primary-600 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary-700/50 flex flex-col items-center justify-center gap-1 ${isPaymentLoading ? 'opacity-50' : ''}`}
            >
               <div className="flex items-center gap-2">
                 <ShieldCheck size={16} /> 
                 {isPaymentLoading ? 'Processing Request...' : 'Pay Now'}
               </div>
               {import.meta.env.VITE_PAYMENT_MODE === 'test' && !isPaymentLoading && (
                 <span className="text-[8px] opacity-70 font-bold uppercase tracking-widest">(Test Mode Enabled)</span>
               )}
            </button>
         </div>
       );
    }

    if (widgetType === 'handover_form') {
       const step = metadata?.step;
       return (
          <div className="bg-orange-50 border border-orange-100 rounded-[32px] p-6 max-w-[280px]">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center">
                   <Camera size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Handover Phase</p>
                   <p className="text-[10px] font-bold text-orange-900 opacity-60">Visual Evidence</p>
                </div>
             </div>
             {step === 'awaiting_owner_photos' ? (
                <div>
                   <p className="text-xs font-bold text-orange-900 mb-4">{isOwner ? 'Your turn: Upload photos to start handover.' : 'Waiting for owner to upload proof photos.'}</p>
                   {isOwner && (
                      <button 
                        onClick={handleStartHandover}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                         Take Photos
                      </button>
                   )}
                </div>
             ) : (
                <div>
                   <div className="grid grid-cols-2 gap-2 mb-4">
                      {metadata?.photos?.slice(0, 2).map((p: string, i: number) => (
                         <img key={i} src={p} className="w-full aspect-square rounded-xl object-cover" alt="" />
                      ))}
                   </div>
                   <p className="text-xs font-bold text-orange-900 mb-4">{!isOwner ? 'Confirm you have received the item in this condition.' : 'Waiting for borrower to confirm receipt.'}</p>
                   {!isOwner && (
                      <button 
                        onClick={handleConfirmHandover}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                         Confirm Receipt
                      </button>
                   )}
                </div>
             )}
          </div>
       );
    }

    if (widgetType === 'return_form') {
       return (
          <div className="bg-red-50 border border-red-100 rounded-[32px] p-6 max-w-[280px]">
             <div className="bg-red-600 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                <AlertTriangle size={20} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Damage Inspection</p>
             <h3 className="text-lg font-black text-red-900 mb-2 uppercase">{metadata?.damageLevel} Damage</h3>
             <p className="text-xs font-bold text-red-900/60 mb-6">A penalty of ₹{metadata?.penalty} has been calculated based on the inspection report.</p>
             <div className="p-3 bg-white rounded-xl border border-red-100 italic text-[10px] text-gray-500">
                Waiting for final settlement processing...
             </div>
          </div>
       );
    }

    if (widgetType === 'bill_summary') {
       const bill = metadata?.bill;
       return (
          <div className="w-full max-w-[280px] bg-gray-900 text-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden group border-2 border-primary-500/30">
            <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:scale-110 transition-transform">
               <Receipt size={120} />
            </div>
            <h3 className="text-xl font-black mb-1">Final Settlement</h3>
            <p className="text-[10px] text-primary-400 font-bold uppercase tracking-widest mb-8">Booking #{bill.bookingId.substring(0,8)}</p>
            <div className="space-y-3 mb-8">
               <div className="flex justify-between text-[11px] font-medium text-gray-400">
                  <span>Gross Rent</span>
                  <span className="text-white font-black">₹{bill.totalRent}</span>
               </div>
               <div className="flex justify-between text-[11px] font-medium text-gray-400">
                  <span>Damages</span>
                  <span className="text-red-400 font-black">₹{bill.damageCharge || 0}</span>
               </div>
               <div className="flex justify-between text-[11px] font-medium text-gray-400">
                  <span>Platform Fee</span>
                  <span className="text-white font-black">₹{bill.platformFee}</span>
               </div>
               <div className="flex justify-between text-[11px] font-medium text-gray-400 pt-3 border-t border-white/10 uppercase tracking-widest">
                  <span className="font-black text-primary-400">Refund Amount</span>
                  <span className="text-lg font-black text-white">₹{bill.refundAmount || 0}</span>
               </div>
            </div>
            <div className="bg-primary-500/20 text-primary-400 p-4 rounded-2xl flex items-center gap-3">
               <CheckCircle2 size={16} />
               <p className="text-[10px] font-black uppercase tracking-widest">Refund Processed</p>
            </div>
          </div>
       );
    }

    return (
      <div className="bg-gray-100 p-4 rounded-xl text-[10px] font-black uppercase text-gray-400">
         Interactive Widget: {widgetType}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white max-w-lg mx-auto shadow-2xl relative">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-50 p-6 sticky top-0 z-50 flex items-center gap-5">
        <button onClick={() => navigate('/inbox')} className="text-gray-900 bg-gray-50 p-3 rounded-2xl hover:bg-gray-100 transition-all active:scale-95">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 flex items-center gap-4">
          <div className="relative">
            <img src={conversation?.itemImage} className="w-12 h-12 rounded-[20px] object-cover border-2 border-white shadow-md" alt="" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white" />
          </div>
          <div>
            <h1 className="text-base font-black truncate max-w-[150px] text-gray-900 leading-tight">{conversation?.itemTitle}</h1>
            <div className="flex items-center gap-1">
               <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Neighbor Chat</span>
               <div className="w-1 h-1 bg-gray-200 rounded-full" />
               <div className="flex items-center gap-0.5 text-[10px] font-bold text-secondary-600">
                  <Star size={10} className="fill-secondary-600" />
                  <span>4.9</span>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Action Bar */}
      {booking && (
        <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-50 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-3">
           {isOwner && booking.status === 'request_sent' && (
             <button 
               onClick={() => updateBookingStatus('accepted_by_owner')}
               className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-200 active:scale-95 transition-all"
             >
               Accept Request
             </button>
           )}
           
           {!isOwner && booking.status === 'accepted_by_owner' && (
             <button 
               onClick={handleRazorpayPayment}
               disabled={isPaymentLoading}
               className="bg-primary-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-200 active:scale-95 transition-all flex items-center gap-2"
             >
               <ShieldCheck size={14} /> {isPaymentLoading ? 'Processing...' : 'Pay Now & Confirm'}
             </button>
           )}

           {isOwner && booking.status === 'confirmed' && (
             <button 
               onClick={handleStartHandover}
               className="bg-orange-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center gap-2"
             >
               <Camera size={14} /> Start Handover
             </button>
           )}

           {!isOwner && booking.status === 'out_for_handover' && (
             <button 
               onClick={handleConfirmHandover}
               className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center gap-2"
             >
               <CheckCircle2 size={14} /> Received Item
             </button>
           )}

           {!isOwner && booking.status === 'active' && (
             <button 
               onClick={handleRequestReturn}
               className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-200 active:scale-95 transition-all"
             >
               Request Return
             </button>
           )}

           {isOwner && (booking.status === 'return_requested' || booking.status === 'inspecting') && (
             <button 
               onClick={() => navigate('/owner-dashboard')}
               className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-2"
             >
               <ShieldCheck size={14} /> Inspect Item
             </button>
           )}

           <button 
             onClick={generateBill}
             className="bg-white border border-gray-100 text-gray-700 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95 transition-all"
           >
             <Receipt size={14} /> View Invoice
           </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white">
        <AnimatePresence>
          {booking?.status === 'confirmed' && isOwner && (
            <MitraAI 
              key="tip-handover"
              type="tip" 
              message="Pro tip: Take clear photos of the item from 4 angles before handing it over to avoid any damage disputes later." 
            />
          )}

          {booking?.status === 'request_sent' && !isOwner && (
            <MitraAI 
              key="tip-response"
              type="tip" 
              message="The owner usually responds within 2 hours. Keep your payment ready once they accept!" 
            />
          )}
          
          {item && item.price > 2000 && !isOwner && (
             <MitraAI 
               key="risk-high-value"
               type="risk" 
               message="This is a high-value item. Ensure you verify the condition checklist strictly during handover."
             />
          )}
        </AnimatePresence>

        <div className="p-6 space-y-6">
          {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.uid;
          const msgDate = msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000) : new Date();
          const showTime = idx === 0 || 
            (msg.createdAt && messages[idx-1].createdAt && 
             msg.createdAt.seconds - messages[idx-1].createdAt.seconds > 600);

          return (
            <React.Fragment key={msg.id}>
              {showTime && (
                <div className="text-center py-4">
                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] bg-gray-50 px-4 py-1.5 rounded-full">
                    {format(msgDate, 'EEEE, h:mm a')}
                  </span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${msg.type === 'system' ? 'justify-center w-full' : ''}`}
              >
                {msg.type === 'system' ? (
                   <div className="bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-400 px-6 py-2 rounded-full uppercase tracking-wider text-center max-w-[90%]">
                      {msg.text}
                   </div>
                ) : msg.type === 'widget' ? (
                   renderWidget(msg)
                ) : msg.bill ? (
                   <div className="w-full max-w-[280px] bg-gray-900 text-white rounded-[32px] p-6 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:scale-110 transition-transform">
                         <Receipt size={100} />
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <Receipt size={16} />
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">RenTer Official Invoice</span>
                      </div>
                      <p className="text-lg font-black mb-1">{msg.bill.itemTitle}</p>
                      <p className="text-[10px] text-gray-400 font-bold mb-6">{msg.bill.duration}</p>
                      
                      <div className="space-y-2 mb-6">
                         <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-gray-400 uppercase tracking-wider">Rent</span>
                            <span>₹{msg.bill.totalRent}</span>
                         </div>
                         <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-gray-400 uppercase tracking-wider">Deposit (Refundable)</span>
                            <span>₹{msg.bill.deposit}</span>
                         </div>
                         <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-gray-400 uppercase tracking-wider">Protection Fee</span>
                            <span>₹{msg.bill.platformFee}</span>
                         </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-white/10">
                         <span className="text-xs font-black uppercase tracking-widest text-primary-400">Total Charged</span>
                         <span className="text-2xl font-black tracking-tight">₹{msg.bill.totalAmount}</span>
                      </div>
                   </div>
                ) : (
                  <div className={`max-w-[85%] p-4 rounded-[24px] text-sm font-medium leading-relaxed shadow-sm ${
                    isMe 
                    ? 'bg-gray-900 text-white rounded-br-none shadow-gray-200' 
                    : 'bg-gray-50 text-gray-800 rounded-bl-none border border-gray-100'
                  }`}>
                    {msg.text}
                  </div>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}
        </div>
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-50 p-6 pb-12">
        <form onSubmit={sendMessage} className="flex gap-4 items-center bg-gray-50 p-2 rounded-[28px] border border-gray-100 focus-within:ring-2 focus-within:ring-gray-100 transition-all">
          <button type="button" className="w-12 h-12 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-900 transition-all">
            <ImageIcon size={20} />
          </button>
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Secure message..."
            className="flex-1 bg-transparent border-none px-2 py-3 text-sm font-bold focus:ring-0 outline-none placeholder:text-gray-300"
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="bg-gray-900 text-white w-12 h-12 rounded-[20px] flex items-center justify-center disabled:opacity-30 shadow-lg shadow-gray-200 active:scale-95 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      <HandoverModal 
        isOpen={isHandoverModalOpen}
        onClose={() => setIsHandoverModalOpen(false)}
        onConfirm={confirmHandoverPhotos}
        itemTitle={item?.title || 'Rental Item'}
      />
    </div>
  );
}

function HandoverModal({ isOpen, onClose, onConfirm, itemTitle }: { isOpen: boolean, onClose: () => void, onConfirm: (photos: string[]) => void, itemTitle: string }) {
  const [photos, setPhotos] = useState<string[]>([]);
  
  if (!isOpen) return null;

  const handleAddPhoto = () => {
    // Simulate photo upload
    setPhotos([...photos, 'https://images.unsplash.com/photo-1540103359328-c376907d081c?q=80&w=400']);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
       <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
       <motion.div 
         initial={{ y: '100%' }} animate={{ y: 0 }}
         className="bg-white w-full max-w-sm rounded-t-[40px] sm:rounded-[40px] p-8 relative z-10"
       >
          <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">Handover Logs</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Inspection Proofs</p>
             </div>
             <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
          </div>

          <p className="text-xs text-gray-500 font-medium mb-8 leading-relaxed">
            Please upload 3-4 photos of the item in its current state as handover evidence for {itemTitle}.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-10">
             {photos.map((p, i) => (
                <div key={i} className="relative aspect-square">
                   <img src={p} className="w-full h-full object-cover rounded-2xl shadow-inner grayscale" alt="" />
                </div>
             ))}
             {photos.length < 3 && (
               <button 
                 onClick={handleAddPhoto}
                 className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 hover:text-primary-600 hover:border-primary-200 transition-all"
               >
                  <Camera size={24} />
                  <span className="text-[10px] font-black uppercase mt-1">Upload</span>
               </button>
             )}
          </div>

          <button 
            disabled={photos.length < 1}
            onClick={() => onConfirm(photos)}
            className="w-full bg-gray-900 text-white py-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 active:scale-95 disabled:opacity-50 transition-all"
          >
             Confirm Handover
          </button>
       </motion.div>
    </div>
  );
}
