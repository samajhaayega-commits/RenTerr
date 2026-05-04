import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Sparkles, AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface MitraAIProps {
  key?: string;
  type?: 'risk' | 'suggestion' | 'tip';
  message: string;
  onDismiss?: () => void;
}

export default function MitraAI({ type = 'tip', message, onDismiss }: MitraAIProps) {
  const getColors = () => {
    switch (type) {
      case 'risk': return 'bg-red-50 border-red-100 text-red-900 icon-bg-red-500';
      case 'suggestion': return 'bg-primary-50 border-primary-100 text-primary-900 icon-bg-primary-500';
      default: return 'bg-indigo-50 border-indigo-100 text-indigo-900 icon-bg-indigo-500';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'risk': return <AlertTriangle size={18} className="text-white" />;
      case 'suggestion': return <Sparkles size={18} className="text-white" />;
      default: return <Bot size={18} className="text-white" />;
    }
  };

  const colors = getColors();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative mx-6 my-4 p-5 rounded-[28px] border ${colors.split(' ').slice(0, 2).join(' ')} shadow-sm overflow-hidden group`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 group-hover:scale-110 transition-transform">
         <Bot size={80} />
      </div>

      <div className="flex gap-4 relative z-10">
        <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${colors.split(' ').pop()?.replace('icon-bg-', 'bg-')}`}>
          {getIcon()}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${colors.split(' ').slice(2, 3).join(' ')}`}>
               Mitra AI {type === 'risk' ? 'Security' : 'Assistant'}
            </span>
            {onDismiss && (
              <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <p className={`text-xs font-bold leading-relaxed ${colors.split(' ').slice(2, 3).join(' ')}`}>
            {message}
          </p>
        </div>
      </div>
      
      {type === 'risk' && (
        <div className="mt-4 flex items-center gap-2 bg-white/50 backdrop-blur-sm p-3 rounded-xl">
           <ShieldCheck size={14} className="text-red-600" />
           <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">High Risk Profile Detected</p>
        </div>
      )}
    </motion.div>
  );
}
