import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RentableItem, LatLng } from '../types';
import { Search, MapPin, SlidersHorizontal, Star, RefreshCw, Map as MapIcon, List, Sparkles, Navigation, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getSmartSuggestions } from '../services/aiService';
import { useAuth } from '../hooks/useAuth';

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapRecenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
}

export default function Home() {
  const { profile } = useAuth();
  const [items, setItems] = useState<RentableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [cityName, setCityName] = useState('Detecting location...');
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const categories = ['All', 'Tools', 'Cleaning', 'Home Utility', 'Electronics', 'Camping'];

  useEffect(() => {
    detectLocation();
    fetchItems();
  }, [profile]);

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          setCityName('Current Location');
        },
        () => {
          setUserLocation({ lat: 12.9716, lng: 77.5946 }); // Default to Bangalore
          setCityName('Bangalore, KA');
        }
      );
    }
  };

  async function fetchItems(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const q = query(
        collection(db, 'items'), 
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'), 
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const fetchedItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RentableItem));
      setItems(fetchedItems);
      
      const suggestions = getSmartSuggestions(fetchedItems, profile);
      setAiSuggestion(suggestions[Math.floor(Math.random() * suggestions.length)]);
      setShowAiAssistant(true);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || item.category === category;
    return matchesSearch && matchesCategory;
  });

  const getDistance = (l1: LatLng, l2: LatLng) => {
    const R = 6371; // km
    const dLat = (l1.lat - l2.lat) * Math.PI / 180;
    const dLon = (l1.lng - l2.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(l1.lat * Math.PI / 180) * Math.cos(l2.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 px-1">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">RenTer</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="bg-primary-600 p-1.5 rounded-lg text-white">
              <Navigation size={12} className="fill-white" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{cityName}</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-600 active:scale-95 transition-all"
           >
             {viewMode === 'list' ? <MapIcon size={20} /> : <List size={20} />}
           </button>
           <button className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-primary-600 active:scale-95 transition-all">
             <SlidersHorizontal size={20} />
           </button>
        </div>
      </header>

      {/* AI Assistant Banner */}
      <AnimatePresence>
        {showAiAssistant && aiSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-6 bg-gradient-to-r from-primary-600 to-indigo-600 p-5 rounded-[28px] text-white shadow-xl shadow-primary-200 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-500">
               <Sparkles size={100} />
            </div>
            <div className="flex items-start gap-4 relative z-10">
               <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 shrink-0">
                  <Sparkles size={20} className="text-white" />
               </div>
               <div className="flex-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary-100 mb-1">AI Neighbors Guard</p>
                 <p className="font-bold text-sm leading-relaxed">{aiSuggestion}</p>
               </div>
               <button onClick={() => setShowAiAssistant(false)} className="p-1 hover:bg-white/10 rounded-full shrink-0">
                  <X size={16} />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search items to rent..."
          className="w-full bg-white border border-gray-100 rounded-[28px] py-5 pl-14 pr-6 shadow-sm focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-8 py-3.5 rounded-[22px] text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              category === cat 
                ? 'bg-gray-900 text-white shadow-xl shadow-gray-200 scale-105' 
                : 'bg-white border border-gray-100 text-gray-400 hover:text-gray-900 border-gray-100 shadow-sm'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List Mode */}
      {viewMode === 'list' && (
        <div className="pb-8">
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">Nearby You</h2>
              {refreshing && <RefreshCw size={18} className="animate-spin text-primary-600" />}
           </div>
           
           {loading && items.length === 0 ? (
             <div className="grid grid-cols-1 gap-4">
               {[1,2,3].map(i => (
                 <div key={i} className="bg-white border border-gray-100 p-4 rounded-[32px] flex gap-4 animate-pulse">
                    <div className="w-24 h-24 bg-gray-100 rounded-2xl" />
                    <div className="flex-1 space-y-3">
                       <div className="h-4 bg-gray-100 rounded w-1/2" />
                       <div className="h-4 bg-gray-50 rounded w-full" />
                       <div className="h-4 bg-gray-100 rounded w-1/4" />
                    </div>
                 </div>
               ))}
             </div>
           ) : filteredItems.length > 0 ? (
             <div className="space-y-4">
                {filteredItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={`/item/${item.id}`} className="block bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                       <div className="flex gap-4">
                          <div className="relative shrink-0">
                             <img 
                               src={item.images[0]} 
                               className="w-28 h-28 rounded-[24px] object-cover group-hover:scale-105 transition-transform duration-500 shadow-sm" 
                               alt={item.title} 
                             />
                             <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-lg flex items-center gap-1 text-[9px] font-black text-gray-700 shadow-sm">
                                <Star size={10} className="fill-secondary-500 text-secondary-500" />
                                {item.ownerRating || '5.0'}
                             </div>
                             {item.status === 'active' && (
                               <div className="absolute -bottom-1 -right-1 bg-green-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border-2 border-white shadow-sm">
                                  Available
                               </div>
                             )}
                          </div>
                          
                          <div className="flex-1 flex flex-col justify-between py-1">
                             <div>
                                <div className="flex justify-between items-start">
                                   <p className="text-[9px] font-black text-primary-500 uppercase tracking-widest mb-1">{item.category}</p>
                                   {userLocation && (
                                     <span className="text-[10px] text-gray-400 font-bold">{getDistance(userLocation, item.location)}km</span>
                                   )}
                                </div>
                                <h3 className="font-bold text-gray-800 line-clamp-1">{item.title}</h3>
                                <p className="text-xs text-gray-400 line-clamp-1 mt-1">{item.description}</p>
                             </div>
                             
                             <div className="flex items-center justify-between mt-2">
                                <div className="flex flex-col">
                                   <p className="text-10px text-gray-400 font-bold uppercase tracking-widest mb-0.5">Price</p>
                                   <div className="flex items-baseline gap-1">
                                      <span className="text-lg font-black text-gray-900 tracking-tight">₹{item.price}</span>
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">/ {item.priceUnit}</span>
                                   </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-xl text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                   <ChevronRight size={20} />
                                </div>
                             </div>
                          </div>
                       </div>
                    </Link>
                  </motion.div>
                ))}
             </div>
           ) : (
             <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
               <p className="text-gray-400 font-bold">No items match your search.</p>
               <button onClick={() => fetchItems(true)} className="mt-4 text-primary-600 font-black text-sm flex items-center justify-center gap-2 mx-auto">
                 <RefreshCw size={16} /> Reset Filters
               </button>
             </div>
           )}
        </div>
      )}

      {/* Map Mode */}
      {viewMode === 'map' && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[50] mt-0 bg-white"
        >
          <div className="absolute top-10 left-4 z-[1000] flex gap-2">
             <button 
              onClick={() => setViewMode('list')}
              className="p-4 bg-white rounded-[24px] shadow-2xl shadow-gray-200 text-gray-900 active:scale-95 transition-all border border-gray-100 flex items-center gap-2 font-bold text-sm"
             >
               <List size={18} /> List View
             </button>
          </div>

          <MapContainer 
            center={userLocation || { lat: 12.9716, lng: 77.5946 }} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {userLocation && <MapRecenter center={userLocation} />}
            
            {filteredItems.map(item => (
              <Marker key={item.id} position={[item.location.lat, item.location.lng]}>
                <Popup className="custom-popup">
                  <Link to={`/item/${item.id}`} className="block w-48">
                     <img src={item.images[0]} className="w-full h-24 object-cover rounded-xl mb-2" alt="" />
                     <h4 className="font-bold text-sm">{item.title}</h4>
                     <p className="text-primary-600 font-black text-xs">₹{item.price} / {item.priceUnit}</p>
                     <p className="text-[10px] text-gray-400 mt-1">{item.ownerName}</p>
                  </Link>
                </Popup>
              </Marker>
            ))}

            {userLocation && (
               <Marker 
                 position={[userLocation.lat, userLocation.lng]} 
                 icon={L.divIcon({ 
                   className: 'custom-div-icon', 
                   html: `<div class="w-8 h-8 bg-primary-600 border-4 border-white rounded-full shadow-xl animate-pulse"></div>` 
                 })}
               />
            )}
          </MapContainer>
        </motion.div>
      )}
    </div>
  );
}
