import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Smartphone, CheckCircle2, X, ShieldCheck, IndianRupee, ArrowRight, Wallet } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  itemName: string;
}

export default function PaymentModal({ isOpen, onClose, onSuccess, amount, itemName }: PaymentModalProps) {
  const [step, setStep] = useState<'methods' | 'processing' | 'success'>('methods');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'wallet'>('upi');

  const handlePay = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        // Reset for next time
        setStep('methods');
      }, 2000);
    }, 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden relative z-10 shadow-2xl"
        >
          {step === 'methods' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="w-12 h-12 bg-primary-600 rounded-[18px] flex items-center justify-center text-white shadow-xl shadow-primary-200">
                  <ShieldCheck size={24} />
                </div>
                <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-8">
                 <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Paying for</p>
                 <h3 className="text-xl font-black text-gray-900 leading-tight">{itemName}</h3>
                 <div className="mt-4 flex items-center gap-2">
                    <span className="text-3xl font-black text-primary-600 tracking-tighter">₹{amount}</span>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 px-2 py-1 rounded">Escrow Held</span>
                 </div>
              </div>

              <div className="space-y-3 mb-10">
                 <PaymentMethod 
                   id="upi" 
                   icon={<Smartphone size={20} />} 
                   label="UPI / PhonePe / GPay" 
                   selected={selectedMethod === 'upi'} 
                   onClick={() => setSelectedMethod('upi')}
                 />
                 <PaymentMethod 
                   id="card" 
                   icon={<CreditCard size={20} />} 
                   label="Debit / Credit Card" 
                   selected={selectedMethod === 'card'} 
                   onClick={() => setSelectedMethod('card')}
                 />
                 <PaymentMethod 
                   id="wallet" 
                   icon={<Wallet size={20} />} 
                   label="Wallets / Paytm" 
                   selected={selectedMethod === 'wallet'} 
                   onClick={() => setSelectedMethod('wallet')}
                 />
              </div>

              <button 
                onClick={handlePay}
                className="w-full bg-gray-900 text-white py-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Secure Payment
                <ArrowRight size={18} />
              </button>
              
              <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-[0.2em] mt-6">
                 Powered by Razorpay Simulation
              </p>
            </div>
          )}

          {step === 'processing' && (
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
               <div className="relative mb-8">
                  <div className="w-24 h-24 border-8 border-gray-50 border-t-primary-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-primary-600">
                     <ShieldCheck size={40} className="animate-pulse" />
                  </div>
               </div>
               <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Verifying Secure Line</h3>
               <p className="text-gray-400 text-sm font-medium">Please do not refresh or close current session...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
               <motion.div 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-emerald-200"
               >
                  <CheckCircle2 size={48} />
               </motion.div>
               <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Payment Locked</h3>
               <p className="text-emerald-600 text-xs font-black uppercase tracking-widest">Funds held in RenTer Escrow</p>
               <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm text-gray-400">
                    <ShieldCheck size={16} />
                  </div>
                  <p className="text-[10px] text-gray-400 text-left font-bold uppercase leading-tight">Your money is safe. It will be released once you confirm handover.</p>
               </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function PaymentMethod({ icon, label, selected, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-5 rounded-[22px] border-2 transition-all ${
        selected ? 'border-primary-600 bg-primary-50 text-primary-900 ring-4 ring-primary-50' : 'border-gray-50 bg-gray-50 text-gray-400 grayscale'
      }`}
    >
      <div className={`p-2 rounded-xl ${selected ? 'bg-primary-100 text-primary-600' : 'bg-white text-gray-300'}`}>
        {icon}
      </div>
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
      {selected && <div className="ml-auto w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
    </button>
  );
}
