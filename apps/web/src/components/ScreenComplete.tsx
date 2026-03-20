import { motion } from 'motion/react';
import { Check } from 'lucide-react';

export function ScreenComplete() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center w-full"
    >
      <div className="flex flex-col items-center justify-center -mt-16">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-32 h-32 rounded-full bg-[#0a0a0e] border-[1.5px] border-voxera-success/40 flex items-center justify-center mb-10 relative shadow-[0_0_60px_rgba(5,150,105,0.25)]"
        >
          <div className="absolute inset-0 rounded-full bg-voxera-success/15 blur-2xl" />
          <Check className="w-14 h-14 text-voxera-success relative z-10" strokeWidth={2} />
        </motion.div>
        
        <motion.p 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-[24px] font-semibold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
        >
          전송이 완료되었어요
        </motion.p>
      </div>
    </motion.div>
  );
}
