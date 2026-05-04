import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { RentableItem } from '../types';
import { motion } from 'motion/react';
import { ChevronLeft, Trash2, Edit3, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MyListings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<RentableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMyItems() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'items'), 
          where('ownerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RentableItem)));
      } catch (error) {
        console.error("Error fetching my items:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMyItems();
  }, [user]);

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this listing?")) return;
    try {
      await deleteDoc(doc(db, 'items', itemId));
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (error) {
       console.error(error);
    }
  };

  return (
    <div className="pb-32 max-w-lg mx-auto bg-white min-h-screen">
      <header className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">My Tools</h1>
        </div>
        <button 
          onClick={() => navigate('/add-item')}
          className="p-2 bg-primary-50 text-primary-600 rounded-xl"
        >
          <Plus size={20} />
        </button>
      </header>

      {loading ? (
        <div className="p-6 space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-50 rounded-3xl animate-pulse" />)}
        </div>
      ) : items.length > 0 ? (
        <div className="p-6 space-y-6">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                <img src={item.images[0]} className="w-24 h-24 rounded-2xl object-cover" alt="" />
                <div className="flex-1 flex flex-col justify-between">
                   <div>
                     <h3 className="font-bold text-gray-900">{item.title}</h3>
                     <p className="text-[10px] text-primary-600 font-bold uppercase tracking-widest mt-1">{item.category}</p>
                   </div>
                   <div className="flex items-baseline gap-1">
                     <span className="text-lg font-bold">₹{item.pricePerDay}</span>
                     <span className="text-[10px] text-gray-400">/ day</span>
                   </div>
                </div>
              </div>
              <div className="bg-gray-50 p-3 flex gap-2 border-t border-gray-50">
                 <button 
                  onClick={() => navigate(`/edit-item/${item.id}`)}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                 >
                   <Edit3 size={14} /> Edit
                 </button>
                 <button 
                   onClick={() => deleteItem(item.id)}
                   className="flex-1 bg-white border border-red-100 text-red-500 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                 >
                   <Trash2 size={14} /> Remove
                 </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-10">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
             <Plus size={40} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No items listed yet</h2>
          <p className="text-sm text-gray-500 mb-8">Share your tools with the community and start earning!</p>
          <button 
           onClick={() => navigate('/add-item')}
           className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-primary-100"
          >
            Add Your First Tool
          </button>
        </div>
      )}
    </div>
  );
}
