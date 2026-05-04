import { useState, FormEvent, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, db } from '../lib/firebase';
import { Hammer, Phone, ArrowLeft, CheckCircle2, ChevronRight, User, MapPin } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createAuditLog } from '../services/auditService';

type FlowStep = 'welcome' | 'mobile' | 'otp' | 'profile' | 'completing';

export default function Login() {
  const [step, setStep] = useState<FlowStep>('welcome');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('Indira Nagar, Bangalore, KA'); // Mock geo location

  const handleMobileSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mobile.length === 10) setStep('otp');
  };

  const handleOtpSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (otp === '1234') setStep('profile');
    else alert('Invalid OTP. Use 1234');
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStep('completing');
    try {
       const credential = await signInWithGoogle();
       const user = credential?.user;
       if (user) {
          const ADMIN_MOBILE = '8955343646';
          const ADMIN_EMAIL = 'kamleshgehlot210@gmail.com';
          const isAdmin = (mobile === ADMIN_MOBILE) || (user.email === ADMIN_EMAIL);
          
          await createAuditLog('LOGIN', `User session started: ${user.email}`, user.uid, {
            deviceId: localStorage.getItem('renter_device_id'),
            mobile
          });

          await setDoc(doc(db, 'users', user.uid), {
             uid: user.uid,
             displayName: name || user.displayName,
             fullName: name,
             email: user.email,
             phoneNumber: mobile, // Captured from step 2
             address: address,
             photoURL: user.photoURL,
             isVerified: true,
             trustScore: isAdmin ? 100 : 50,
             role: isAdmin ? 'admin' : 'user',
             deviceId: localStorage.getItem('renter_device_id') || 'unknown',
             lastActive: serverTimestamp(),
             createdAt: serverTimestamp()
          }, { merge: true });
       }
    } catch (err) {
       console.error("Login save error:", err);
       setStep('profile');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary-50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm text-center relative z-10"
          >
            <div className="mb-10 flex justify-center">
              <div className="w-24 h-24 bg-primary-600 rounded-[32px] flex items-center justify-center shadow-2xl shadow-primary-200 rotate-6 transform hover:rotate-0 transition-transform duration-500">
                <Hammer className="text-white" size={48} />
              </div>
            </div>
            <h1 className="text-5xl font-black mb-4 text-gray-900 tracking-tight">RenTer</h1>
            <p className="text-gray-500 text-lg mb-12 font-medium">Rent Anything, Anywhere.<br />Hyperlocal P2P marketplace.</p>

            <div className="space-y-4">
               <button
                onClick={() => setStep('mobile')}
                className="w-full flex items-center justify-between bg-primary-600 border-none py-5 px-8 rounded-[24px] font-bold shadow-xl shadow-primary-100 hover:bg-primary-700 active:scale-95 transition-all text-white group"
              >
                Get Started
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 py-5 px-6 rounded-[24px] font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Continue with Google
              </button>
            </div>
          </motion.div>
        )}

        {step === 'mobile' && (
          <motion.form
            key="mobile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm relative z-10"
            onSubmit={handleMobileSubmit}
          >
            <button onClick={() => setStep('welcome')} className="p-2 -ml-2 mb-6 text-gray-400 hover:text-gray-600">
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-3xl font-black mb-2 text-gray-900">Your Number?</h2>
            <p className="text-gray-500 mb-10 text-sm">We'll send a 4-digit code to verify you.</p>
            
            <div className="relative mb-8">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400 font-bold border-r pr-4 border-gray-100">
                <Phone size={18} />
                <span>+91</span>
              </div>
              <input
                autoFocus
                type="tel"
                placeholder="00000 00000"
                maxLength={10}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-[24px] py-5 pl-28 pr-6 text-xl font-bold tracking-widest focus:border-primary-500 outline-none transition-colors"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <button
              disabled={mobile.length < 10}
              className="w-full bg-primary-600 py-5 rounded-[24px] font-black text-white shadow-xl shadow-primary-50 disabled:opacity-50 active:scale-95 transition-all"
            >
              Send OTP
            </button>
          </motion.form>
        )}

        {step === 'otp' && (
          <motion.form
            key="otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-sm relative z-10"
            onSubmit={handleOtpSubmit}
          >
            <button onClick={() => setStep('mobile')} className="p-2 -ml-2 mb-6 text-gray-400 hover:text-gray-600">
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-3xl font-black mb-2 text-gray-900">Enter Code</h2>
            <p className="text-gray-500 mb-10 text-sm">Sent to +91 {mobile}. <span className="text-primary-600 font-bold">Resend</span></p>
            
            <div className="flex gap-4 mb-10">
              <input
                autoFocus
                type="text"
                placeholder="1234"
                maxLength={4}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-[24px] py-6 px-10 text-4xl font-black text-center tracking-[1em] focus:border-primary-500 outline-none transition-colors"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <button
              disabled={otp.length < 4}
              className="w-full bg-primary-600 py-5 rounded-[24px] font-black text-white shadow-xl shadow-primary-50 active:scale-95 transition-all"
            >
              Verify OTP
            </button>
          </motion.form>
        )}

        {step === 'profile' && (
          <motion.form
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm relative z-10"
            onSubmit={handleProfileSubmit}
          >
            <h2 className="text-3xl font-black mb-2 text-gray-900">Finish Profile</h2>
            <p className="text-gray-500 mb-8 text-sm">Let neighbors know who you are.</p>
            
            <div className="space-y-4 mb-10">
              <div className="relative">
                <User className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  required
                  placeholder="Full Name"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-[24px] py-5 pl-14 pr-6 font-bold"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  required
                  placeholder="Street Address"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-[24px] py-5 pl-14 pr-6 font-bold"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
            </div>

            <button
              className="w-full bg-primary-600 py-5 rounded-[24px] font-black text-white shadow-xl shadow-primary-50 active:scale-95 transition-all"
            >
              Complete Profile
            </button>
          </motion.form>
        )}

        {step === 'completing' && (
          <motion.div
            key="completing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center relative z-10"
          >
            <div className="mb-6 flex justify-center">
               <motion.div 
                 animate={{ scale: [1, 1.2, 1] }} 
                 transition={{ repeat: Infinity }}
                 className="w-20 h-20 bg-secondary-50 text-secondary-600 rounded-full flex items-center justify-center p-4 shadow-inner"
               >
                 <CheckCircle2 size={40} />
               </motion.div>
            </div>
            <h2 className="text-2xl font-black text-gray-900">Mitra verified!</h2>
            <p className="text-gray-500 mt-2">Connecting you to Google...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

