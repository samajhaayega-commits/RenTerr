import React, { useState, useEffect, FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Camera, ChevronLeft, Info, HelpCircle, MapPin } from 'lucide-react';
import { jitterLocation } from '../lib/utils';
import { LatLng } from '../types';

export default function AddItem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Tools',
    pricePerDay: '',
    deposit: '',
    condition: 'Good',
    checklist: '',
  });

  const [images, setImages] = useState<string[]>([]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImages(prev => [...prev, url]);
    }
  };

  const categories = ['Tools', 'Cleaning', 'Home Utility'];
  const conditions = ['New', 'Good', 'Used'];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const path = 'items';
    try {
      const serialCode = `TM-${formData.category.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Protect user privacy by jittering the location within 1km
      const finalLocation = location 
        ? jitterLocation(location.lat, location.lng) 
        : { lat: 12.9716, lng: 77.5946 }; // Default to Bangalore if detection failed

      const newItem = {
        ownerId: user.uid,
        ownerName: user.displayName,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: Number(formData.pricePerDay),
        priceUnit: 'day',
        deposit: Number(formData.deposit),
        depositType: 'with_deposit',
        condition: formData.condition,
        checklist: formData.checklist.split(',').map(s => s.trim()).filter(Boolean),
        status: 'pending_approval',
        serialCode,
        location: finalLocation,
        images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1540103395703-518a1bd68307?q=80&w=600&auto=format&fit=crop'],
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, path), newItem);
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 max-w-lg mx-auto">
      <header className="p-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 bg-white z-50">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl">List Your Tool</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Photo Upload Section */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          <label className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 shrink-0 cursor-pointer active:scale-95 transition-all">
            <Camera size={24} />
            <span className="text-[10px] font-bold mt-1">Add Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
          {images.map((img, idx) => (
            <div key={idx} className="relative shrink-0">
              <img src={img} className="w-24 h-24 rounded-2xl object-cover" alt="" />
              <button 
                type="button"
                onClick={() => setImages(images.filter((_, i) => i !== idx))}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md"
              >
                <div className="w-4 h-4 flex items-center justify-center text-[10px] font-bold">×</div>
              </button>
            </div>
          ))}
          {images.length === 0 && (
            <img src="https://images.unsplash.com/photo-1540103395703-518a1bd68307?q=80&w=240&h=240&auto=format&fit=crop" className="w-24 h-24 rounded-2xl object-cover opacity-30 grayscale shrink-0" alt="" />
          )}
        </div>

        <div className="space-y-4">
          <InputGroup label="Item Title">
            <input 
              type="text" 
              required
              className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
              placeholder="e.g. Bosch Electric Drill GSR 120-LI"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </InputGroup>

          <InputGroup label="Description">
            <textarea 
              required
              rows={3}
              className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
              placeholder="Describe the tool, its condition, and any usage instructions..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </InputGroup>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Category">
              <select 
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm appearance-none"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </InputGroup>
            <InputGroup label="Condition">
              <select 
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm appearance-none"
                value={formData.condition}
                onChange={e => setFormData({...formData, condition: e.target.value})}
              >
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </InputGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Rent (₹/day)">
              <input 
                type="number" 
                required
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                placeholder="200"
                value={formData.pricePerDay}
                onChange={e => setFormData({...formData, pricePerDay: e.target.value})}
              />
            </InputGroup>
            <InputGroup label="Security Deposit">
              <div className="relative">
                <input 
                  type="number" 
                  required
                  className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                  placeholder="2000"
                  value={formData.deposit}
                  onChange={e => setFormData({...formData, deposit: e.target.value})}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <HelpCircle size={14} />
                </button>
              </div>
            </InputGroup>
          </div>

          <InputGroup label="Parts Checklist (comma separated)">
            <input 
              type="text" 
              className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
              placeholder="Drill machine, Battery, Charger, Case"
              value={formData.checklist}
              onChange={e => setFormData({...formData, checklist: e.target.value})}
            />
            <p className="text-[10px] text-gray-400 mt-1 ml-1 flex items-center gap-1">
              <Info size={10} />
              Helps in damage disputes
            </p>
          </InputGroup>
          
          <div className="bg-primary-50 p-4 rounded-xl flex items-center gap-3">
             <div className="p-2 bg-white rounded-lg text-primary-600 shadow-sm">
               <MapPin size={16} />
             </div>
             <div>
               <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest leading-none mb-1">Location Privacy Enabled</p>
               <p className="text-[10px] text-primary-700 font-medium">Your exact location is hidden. Neighbors see a 1km blurred radius.</p>
             </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-primary-100 disabled:opacity-50 active:scale-95 transition-all"
        >
          {loading ? 'Publishing...' : 'List Tool for Rent'}
        </button>
      </form>
    </div>
  );
}

function InputGroup({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
