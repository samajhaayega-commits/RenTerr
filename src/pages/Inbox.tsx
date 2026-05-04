import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Conversation } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ChevronRight } from 'lucide-react';

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      setConversations(convs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching conversations:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) return <div className="p-10 text-center">Loading messages...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-lg mx-auto">
      <header className="p-6 bg-white border-b border-gray-100 sticky top-0 z-50">
        <h1 className="text-2xl font-bold">Messages</h1>
      </header>

      <div className="p-4 space-y-3">
        {conversations.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">No messages yet</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Start a conversation from an item page</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full bg-white p-4 rounded-2xl border border-gray-100 flex gap-4 items-center active:scale-98 transition-all text-left shadow-sm hover:shadow-md"
            >
              <div className="relative shrink-0">
                <img 
                  src={conv.itemImage || 'https://via.placeholder.com/100'} 
                  className="w-14 h-14 rounded-2xl object-cover border border-gray-100" 
                  alt="" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <h3 className="text-sm font-bold truncate">{conv.itemTitle}</h3>
                  <span className="text-[9px] text-gray-400 font-bold uppercase whitespace-nowrap ml-2">
                    {conv.updatedAt?.seconds ? formatDistanceToNow(new Date(conv.updatedAt.seconds * 1000)) + ' ago' : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  {conv.lastMessage || 'No messages yet'}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
