import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function BookingSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12 }}
        className="w-24 h-24 bg-secondary-50 text-secondary-600 rounded-full flex items-center justify-center mb-6"
      >
        <CheckCircle size={56} />
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold mb-3"
      >
        Booking Confirmed!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-gray-500 mb-8"
      >
        Your request has been sent to the owner. You can now chat with them to coordinate delivery.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col gap-4 mb-10"
      >
         <div className="flex justify-between items-center text-sm">
           <span className="text-gray-400">Order ID:</span>
           <span className="font-mono font-bold text-gray-700">{id?.substring(0, 8).toUpperCase()}</span>
         </div>
         <div className="h-px bg-gray-200" />
         <div className="flex items-center gap-3 text-left">
           <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
             <ShieldCheck size={20} />
           </div>
           <div>
             <p className="text-xs font-bold">Safety Deposit Held</p>
             <p className="text-[10px] text-gray-500 leading-tight">Your deposit is safe with our Payment Guard. Take photos before using the tool.</p>
           </div>
         </div>
      </motion.div>

      <div className="w-full space-y-3">
        <Link 
          to="/bookings" 
          className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-primary-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          View My Bookings
          <ArrowRight size={20} />
        </Link>
        <Link 
          to="/" 
          className="w-full bg-white border border-gray-200 text-gray-600 py-4 rounded-xl font-bold active:scale-95 transition-all block"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
