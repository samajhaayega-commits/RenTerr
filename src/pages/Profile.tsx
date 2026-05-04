import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, LogOut, ChevronRight, Star, History, ShieldAlert, PlusCircle, ShieldCheck, MapPin, Camera, X, Bell, BellOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(profile?.notificationsEnabled !== false);

  const [editData, setEditData] = useState({
    displayName: '',
    address: '',
    photoURL: ''
  });

  useEffect(() => {
    if (profile && !isEditing) {
      setEditData({
        displayName: profile.displayName || '',
        address: profile.address || '',
        photoURL: profile.photoURL || ''
      });
    }
  }, [profile, isEditing]);

  if (!profile) return null;

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; // Slightly larger but still safe
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white'; // Background for transparent PNGs
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // Lower quality to be even safer
      };
    });
  };

  const handleUpdateProfile = async () => {
    console.log("Attempting to update profile:", editData);
    
    if (!editData.displayName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    setLoading(true);
    const path = `users/${profile.uid}`;
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updatePayload = {
        displayName: editData.displayName.trim(),
        address: editData.address.trim(),
        photoURL: editData.photoURL,
        lastActive: serverTimestamp()
      };
      
      console.log("Sending payload to Firestore:", updatePayload);
      await updateDoc(userRef, updatePayload);
      
      console.log("Firestore update successful");
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (e) {
      console.error("Profile Update Error:", e);
      
      const errInfo: FirestoreErrorInfo = {
        error: e instanceof Error ? e.message : String(e),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
        },
        operationType: OperationType.UPDATE,
        path: path
      };
      
      const detailedError = JSON.stringify(errInfo, null, 2);
      console.error('Handled Firestore Error: ', detailedError);
      
      if (e instanceof Error && e.message.includes('permission')) {
        alert("Permission denied. You might not have the right access to update this profile.");
      } else if (e instanceof Error && e.message.includes('size')) {
        alert("The image is still too large. Please try a different photo.");
      } else {
        alert(`Failed to update profile: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getVerificationLabel = (level: number) => {
    switch(level) {
      case 3: return "Level 3 (Verified)";
      case 2: return "Level 2 (Active)";
      default: return "Level 1 (New)";
    }
  };

  const menuItems = [
    { icon: <History className="text-blue-500" />, label: 'Rent History', extra: 'View all', onClick: () => navigate('/bookings') },
    { icon: <PlusCircle className="text-primary-500" />, label: 'My Listings', onClick: () => navigate('/my-listings') },
    { icon: <ShieldCheck size={18} className="text-secondary-600" />, label: 'Lender Dashboard', extra: 'Manage requests', onClick: () => navigate('/owner-dashboard') },
    { icon: <Star className="text-yellow-500" />, label: 'My Reviews', extra: '4.9 rating' },
    { icon: <ShieldAlert className="text-orange-500" />, label: 'Active Disputes', extra: 'None' },
    { icon: <Settings className="text-gray-500" />, label: 'Account Settings', onClick: () => setShowSettings(true) },
  ];

  return (
    <div className="pb-32 max-w-lg mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-primary-600 pt-16 pb-24 px-6 rounded-b-[40px] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
           <ShieldCheck size={120} />
        </div>
        <div className="flex justify-between items-start mb-8 relative z-10">
          <h1 className="text-2xl font-bold">Mitra Profile</h1>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/20 backdrop-blur rounded-full active:scale-95 transition-all"
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="flex items-center gap-4 relative z-10">
           <div className="relative">
             <img 
               src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
               alt="" 
               className="w-20 h-20 rounded-3xl border-4 border-white/20 shadow-xl object-cover"
             />
             <button 
              onClick={() => setIsEditing(true)}
              className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-xl shadow-lg border border-gray-100/50"
             >
                <Camera size={12} className="text-primary-600" />
             </button>
           </div>
           <div className="flex-1">
             <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{profile.displayName || profile.fullName}</h2>
                    <ShieldCheck size={18} className="text-primary-100" />
                  </div>
                  <div className="flex items-center gap-1 text-primary-100 text-xs mt-1 font-medium">
                      <MapPin size={10} />
                      {profile.address || 'Location not set'}
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-white/20 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Edit
                </button>
             </div>
             <div className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-secondary-500 to-secondary-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
                <Star size={12} className="fill-white" />
                {getVerificationLabel(profile.verificationLevel || 1)}
             </div>
           </div>
        </div>
      </div>

      {/* Trust Card */}
      <div className="px-6 -mt-12 relative z-10">
        <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-primary-900/5 grid grid-cols-2 gap-4 border border-gray-100">
           <div className="border-r border-gray-50 pr-4">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Trust Score</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-3xl font-black text-secondary-600">{profile.trustScore || 85}</span>
                 <span className="text-[10px] text-gray-400 font-bold">/100</span>
              </div>
           </div>
           <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Verification</p>
              <p className="text-sm font-bold text-gray-700">{getVerificationLabel(profile.verificationLevel || 1)}</p>
              <div className="w-full bg-gray-100 h-1 rounded-full mt-2 overflow-hidden">
                 <div className="h-full bg-secondary-500" style={{ width: `${(profile.verificationLevel || 1) * 33.3}%` }} />
              </div>
           </div>
        </div>
      </div>

      {/* Profile Menu */}
      <div className="px-6 mt-8 space-y-4">
        <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
          {menuItems.map((item, i) => (
            <button 
              key={i} 
              onClick={() => item.onClick?.()}
              className={`w-full flex items-center justify-between p-5 transition-colors active:bg-gray-50 text-left ${i !== menuItems.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <div className="flex items-center gap-4">
                 <div className="p-2.5 bg-gray-50 rounded-[18px]">
                   {item.icon}
                 </div>
                 <span className="font-bold text-gray-700 text-sm tracking-tight">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                 {item.extra && <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase tracking-wider">{item.extra}</span>}
                 <ChevronRight size={16} className="text-gray-300" />
              </div>
            </button>
          ))}
        </div>

        <button 
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 text-red-500 font-bold p-5 bg-red-50/50 rounded-[32px] active:scale-95 transition-all text-sm"
        >
          <LogOut size={18} />
          Sign Out Mitra Account
        </button>
      </div>

      <div className="px-10 mt-10 text-center">
        <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.2em]">ToolMitra Platform v1.0</p>
      </div>

      {/* Edit Form Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100] flex items-end"
            onClick={() => setIsEditing(false)}
          >
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[40px] p-8 max-w-lg mx-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-bold">Edit Profile</h3>
                 <button onClick={() => setIsEditing(false)} className="p-2 bg-gray-50 rounded-full">
                    <X size={20} />
                 </button>
              </div>

              <div className="space-y-6">
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Display Name</label>
                   <input 
                     type="text" 
                     value={editData.displayName}
                     onChange={(e) => setEditData({...editData, displayName: e.target.value})}
                     className="w-full bg-gray-50 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary-500"
                     placeholder="Your name"
                   />
                 </div>
                 
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">City / Address</label>
                   <input 
                     type="text" 
                     value={editData.address}
                     onChange={(e) => setEditData({...editData, address: e.target.value})}
                     className="w-full bg-gray-50 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary-500"
                     placeholder="e.g. Bangalore, KA"
                   />
                 </div>

                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Profile Photo</label>
                   <div className="flex items-center gap-4">
                      <img 
                        src={editData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
                        className="w-16 h-16 rounded-2xl object-cover border border-gray-100" 
                        alt="" 
                      />
                      <label className="flex-1 cursor-pointer">
                        <div className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center hover:bg-gray-100 transition-all">
                           <Camera size={20} className="mx-auto text-gray-400 mb-1" />
                           <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pick from Storage or Camera</p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const compressed = await compressImage(reader.result as string);
                                setEditData({ ...editData, photoURL: compressed });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                   </div>
                 </div>

                 <button 
                   onClick={handleUpdateProfile}
                   disabled={loading}
                   className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary-100 disabled:opacity-50"
                 >
                   {loading ? 'Saving...' : 'Save Changes'}
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[120]"
          >
             <div className="p-6 flex items-center gap-4 border-b border-gray-100">
               <button onClick={() => setShowSettings(false)} className="p-2 bg-gray-50 rounded-xl">
                 <ArrowLeft size={20} />
               </button>
               <h1 className="text-xl font-bold">Account Settings</h1>
             </div>

             <div className="p-6 space-y-8">
                <section>
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 px-2">Notifications</h3>
                   <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                      <div className="p-5 flex items-center justify-between border-b border-gray-50">
                        <div className="flex items-center gap-4">
                           <div className={`p-2 rounded-xl ${notifsEnabled ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400'}`}>
                              {notifsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                           </div>
                           <p className="font-bold text-sm">Push Notifications</p>
                        </div>
                        <button 
                          onClick={() => setNotifsEnabled(!notifsEnabled)}
                          className={`w-12 h-6 rounded-full transition-all relative ${notifsEnabled ? 'bg-primary-600' : 'bg-gray-200'}`}
                        >
                           <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifsEnabled ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                      <div className="p-5 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="p-2 bg-gray-50 text-gray-400 rounded-xl">
                               <ShieldCheck size={18} />
                            </div>
                            <p className="font-bold text-sm">Security Alerts</p>
                         </div>
                         <div className="w-12 h-6 bg-primary-600 rounded-full relative">
                            <div className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
                         </div>
                      </div>
                   </div>
                </section>

                <section>
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 px-2">Security</h3>
                   <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                      <button className="w-full p-5 flex items-center justify-between text-left">
                         <p className="font-bold text-sm text-gray-700">Change Mobile Number</p>
                         <ChevronRight size={16} className="text-gray-300" />
                      </button>
                      <button className="w-full p-5 flex items-center justify-between text-left">
                         <p className="font-bold text-sm text-gray-700">KYC Verification Status</p>
                         <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
                      </button>
                      <button className="w-full p-5 flex items-center justify-between text-left">
                         <p className="font-bold text-sm text-gray-700">Authorized Devices</p>
                         <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase tracking-wider">1 Device</span>
                      </button>
                   </div>
                </section>

                <button 
                  onClick={() => signOut()}
                  className="w-full py-5 text-red-500 font-bold border-2 border-red-50 rounded-3xl active:bg-red-50 transition-all text-sm"
                >
                  Delete Account (Irreversible)
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


