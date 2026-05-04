import React, { useState, useEffect, FormEvent, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Camera, ChevronLeft, Info, HelpCircle, MapPin, Trash2 } from 'lucide-react';
import { RentableItem, LatLng } from '../types';
import { jitterLocation } from '../lib/utils';

export default function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Tools',
    price: '',
    priceUnit: 'day',
    deposit: '',
    depositType: 'with_deposit',
    condition: 'Good',
    checklist: '',
  });

  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [existingLocation, setExistingLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  useEffect(() => {
    async function fetchItem() {
      if (!id) return;
      try {
        const itemDoc = await getDoc(doc(db, 'items', id));
        if (itemDoc.exists()) {
          const item = itemDoc.data() as RentableItem;
          // Check ownership
          if (item.ownerId !== user?.uid) {
            alert("Unauthorized");
            navigate('/');
            return;
          }
          setFormData({
            title: item.title,
            description: item.description,
            category: item.category,
            price: item.price.toString(),
            priceUnit: item.priceUnit || 'day',
            deposit: item.deposit.toString(),
            depositType: item.depositType || 'with_deposit',
            condition: item.condition,
            checklist: item.checklist.join(', '),
          });
          setImages(item.images || []);
          setExistingLocation(item.location || null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchItem();
  }, [id, user, navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImages(prev => [...prev, url]);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("Are you sure you want to delete this listing?")) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'items', id));
      navigate('/owner-dashboard');
    } catch (e) {
      console.error(e);
      alert("Error deleting item.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    setSaving(true);
    try {
      // If no location exists, attempt to save current detected location with jitter
      const finalLocation = existingLocation || (location ? jitterLocation(location.lat, location.lng) : null);

      const updatedItem = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: Number(formData.price),
        priceUnit: formData.priceUnit,
        deposit: Number(formData.deposit),
        depositType: formData.depositType,
        condition: formData.condition,
        checklist: formData.checklist.split(',').map(s => s.trim()).filter(Boolean),
        images: images,
        location: finalLocation,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'items', id), updatedItem as any);
      navigate('/my-listings');
    } catch (error) {
      console.error(error);
      alert("Error updating item.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading item...</div>;

  const categories = ['Tools', 'Cleaning', 'Home Utility'];
  const conditions = ['New', 'Good', 'Used'];

  return (
    <div className="min-h-screen bg-white pb-24 max-w-lg mx-auto">
      <header className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Edit Your Tool</h1>
        </div>
        <button 
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <Trash2 size={20} />
        </button>
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
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </InputGroup>
            <InputGroup label="Condition">
              <select 
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                value={formData.condition}
                onChange={e => setFormData({...formData, condition: e.target.value})}
              >
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </InputGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Rent Amount (₹)">
              <input 
                type="number" 
                required
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                placeholder="200"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
              />
            </InputGroup>
            <InputGroup label="Per Unit">
              <select 
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                value={formData.priceUnit}
                onChange={e => setFormData({...formData, priceUnit: e.target.value as any})}
              >
                <option value="minute">Minute</option>
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="month">Month</option>
              </select>
            </InputGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Deposit Amount (₹)">
              <input 
                type="number" 
                required
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                placeholder="2000"
                value={formData.deposit}
                onChange={e => setFormData({...formData, deposit: e.target.value})}
              />
            </InputGroup>
            <InputGroup label="Deposit Policy">
              <select 
                className="w-full bg-gray-50 border-transparent rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-600 transition-all text-sm"
                value={formData.depositType}
                onChange={e => setFormData({...formData, depositType: e.target.value as any})}
              >
                <option value="with_deposit">Deductible Deposit</option>
                <option value="no_deposit">No Deposit (Trusted)</option>
              </select>
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
          </InputGroup>
        </div>

        <button 
          type="submit"
          disabled={saving}
          className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-primary-100 disabled:opacity-50 active:scale-95 transition-all"
        >
          {saving ? 'Saving...' : 'Update Listing'}
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
