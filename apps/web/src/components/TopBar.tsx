import { motion } from 'motion/react';

export function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-32 flex items-center justify-center z-50 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-voxera-lilac-icy font-medium tracking-[0.3em] pl-[0.3em] text-[26px] mt-8 drop-shadow-[0_0_15px_rgba(196,203,245,0.3)]"
      >
        VOXERA
      </motion.div>
    </header>
  );
}
