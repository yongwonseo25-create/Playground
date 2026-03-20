import { motion } from 'motion/react';

export function CustomMicIcon({ isRecording }: { isRecording: boolean }) {
  return (
    <div className="relative w-12 h-16 flex flex-col items-center justify-center">
      {/* Capsule Body */}
      <motion.div 
        animate={{
          boxShadow: isRecording 
            ? 'inset 0 0 15px rgba(255,255,255,0.8), 0 0 25px rgba(196,203,245,0.6)' 
            : 'inset 0 0 8px rgba(255,255,255,0.5), 0 0 0px rgba(196,203,245,0)'
        }}
        transition={{ duration: 0.8 }}
        className="w-7 h-12 rounded-full border-[1.5px] border-white/50 bg-gradient-to-b from-voxera-lilac via-voxera-periwinkle to-voxera-icy-blue relative z-10 overflow-hidden"
      >
        {/* Inner highlight for the capsule */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent opacity-80" />
        <div className="absolute top-1 left-1 w-2 h-4 rounded-full bg-white/80 blur-[1px]" />
      </motion.div>
      
      {/* Side Supports */}
      <div className="absolute top-5 w-10 h-7 border-b-[1.5px] border-l-[1.5px] border-r-[1.5px] border-white/30 rounded-b-xl z-0" />
      
      {/* Stem */}
      <div className="w-[2px] h-3 bg-white/30 mt-0 z-0" />
      
      {/* Base Ring */}
      <div className="w-6 h-[2px] bg-white/40 rounded-full z-0" />
    </div>
  );
}
