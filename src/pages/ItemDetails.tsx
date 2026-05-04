import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { RentableItem, UserProfile } from '../types';
import { ChevronLeft, Share2, Heart, Shield, CheckCircle2, Star, MapPin, Info, MessageSquare, Clock, Calendar, ShieldAlert, ShieldCheck, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [item, setItem] = useState<RentableItem | null>(null);
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Duration State
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days' | 'months'>('days');

  const isOwner = user?.uid === item?.ownerId;

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const itemDoc = await getDoc(doc(db, 'items', id));
        if (itemDoc.exists()) {
          const itemData = { id: itemDoc.id, ...itemDoc.data() } as RentableItem;
          setItem(itemData);
          
          // Map default unit from item
          if (itemData.priceUnit === 'minute') setDurationUnit('minutes');
          if (itemData.priceUnit === 'hour') setDurationUnit('hours');
          if (itemData.priceUnit === 'day') setDurationUnit('days');
          if (itemData.priceUnit === 'month') setDurationUnit('months');

          const ownerDoc = await getDoc(doc(db, 'users', itemData.ownerId));
          if (ownerDoc.exists()) {
            setOwner(ownerDoc.data() as UserProfile);
          }
        }
      } catch (error) {
        console.error("Error fetching item:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const calculateTotal = () => {
    if (!item) return 0;
    return item.price * durationValue;
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!item) return <div className="p-10 text-center">Item not found</div>;

  return (
    <div className="pb-40 max-w-lg mx-auto bg-white min-h-screen">
      {/* Hero Section */}
      <div className="relative h-96">
        <img 
          src={item.images[0] || 'https://via.placeholder.com/600x400'} 
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white/90 backdrop-blur rounded-full shadow-md text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex gap-2">
            <button className="p-3 bg-white/90 backdrop-blur rounded-full shadow-md text-gray-700">
              <Share2 size={24} />
            </button>
            <button className="p-3 bg-primary-600 rounded-full shadow-md text-white">
              <Heart size={24} className="fill-white" />
            </button>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="absolute bottom-10 left-6">
           <div className="bg-green-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border-2 border-white">
              Available Now
           </div>
        </div>
      </div>

      <div className="p-8 -mt-6 bg-white rounded-t-[40px] relative z-10 shadow-2xl shadow-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
              {item.category}
            </div>
            {item.depositType === 'no_deposit' ? (
              <div className="bg-secondary-50 text-secondary-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                 <ShieldCheck size={10} /> No Deposit
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                 <ShieldAlert size={10} /> Deposit Required
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
            <Star size={16} className="fill-secondary-500 text-secondary-500" />
            {owner?.rating || '5.0'}
          </div>
        </div>

        <h1 className="text-3xl font-black mb-4 text-gray-900 leading-tight">{item.title}</h1>
        
        <div className="flex items-center gap-6 mb-8 bg-gray-50 p-6 rounded-[32px]">
          <div className="flex flex-col">
            <span className="text-3xl font-black text-primary-600 tracking-tighter">₹{item.price}</span>
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Per {item.priceUnit}</span>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div className="flex flex-col">
            <span className="text-3xl font-black text-gray-900 tracking-tighter">₹{item.deposit}</span>
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Refundable Deposit</span>
          </div>
        </div>

        {/* Duration Selector */}
        <section className="mb-10">
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Select Duration</h2>
              <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">Min: 30 mins</span>
           </div>
           
           <div className="flex gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {(['minutes', 'hours', 'days', 'months'] as const).map(unit => (
                <button
                  key={unit}
                  onClick={() => setDurationUnit(unit)}
                  className={`px-6 py-3 rounded-2xl text-xs font-bold capitalize transition-all ${
                    durationUnit === unit 
                      ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                      : 'bg-white border border-gray-100 text-gray-400'
                  }`}
                >
                  {unit}
                </button>
              ))}
           </div>

           <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-[28px]">
              <button 
                onClick={() => setDurationValue(Math.max(1, durationValue - 1))}
                className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl font-black text-gray-900 active:scale-95 transition-all"
              >-</button>
              <div className="flex-1 text-center">
                 <p className="text-2xl font-black text-gray-900">{durationValue}</p>
                 <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{durationUnit}</p>
              </div>
              <button 
                onClick={() => setDurationValue(durationValue + 1)}
                className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl font-black text-gray-900 active:scale-95 transition-all"
              >+</button>
           </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-3">About this item</h2>
          <p className="text-gray-600 leading-relaxed font-medium">
            {item.description}
          </p>
        </section>

        {/* Item Checklist */}
        <section className="mb-10 bg-gray-50 p-8 rounded-[40px] border border-white shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 mb-6 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-primary-600" />
            Verified Checklist
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {item.checklist.map((part, i) => (
              <div key={i} className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-2 h-2 bg-primary-500 rounded-full" />
                <span className="text-xs font-bold text-gray-700">{part}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Owner Info */}
        <div className="flex items-center gap-4 p-6 border border-gray-100 rounded-[32px] mb-10 bg-white shadow-sm">
          <img 
            src={owner?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + item.ownerId} 
            className="w-16 h-16 rounded-[24px] border-4 border-gray-50 shadow-sm" 
            alt={owner?.displayName}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-black text-gray-900">{owner?.displayName}</p>
              <ShieldCheck size={16} className="text-secondary-500" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Trusted Provider</p>
          </div>
          <button 
            onClick={() => navigate(`/chat/new?itemId=${item.id}`)}
            className="p-4 bg-gray-50 rounded-2xl text-primary-600 hover:bg-primary-600 hover:text-white transition-all"
          >
             <MessageSquare size={24} />
          </button>
        </div>
      </div>

      {/* Footer / CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-gray-50 flex items-center gap-6 z-50">
        <div className="flex flex-col">
           <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total cost</p>
           <h4 className="text-2xl font-black text-gray-900">₹{calculateTotal()}</h4>
        </div>
        <button 
          onClick={() => navigate(`/checkout/${item.id}?value=${durationValue}&unit=${durationUnit}`)}
          className="flex-1 bg-gray-900 text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isOwner ? 'Manage Listing' : 'Request to Rent'}
          {!isOwner && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
}
