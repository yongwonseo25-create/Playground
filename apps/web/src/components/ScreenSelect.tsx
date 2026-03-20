import { motion } from 'motion/react';
import { Destination } from '../types';

interface Props {
  onSelect: (dest: Destination) => void;
}

const NotionIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="15 13 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#000" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" fill="#fff">
      <path d="M32 40 h60 v60 h-60 z" />
      <path d="M18 26 l14 14 v60 l-14 -14 z" />
      <path d="M18 26 l60 -10 l14 14 h-60 z" />
    </g>
    <path d="M45 52 h12 v32 l18 -32 h12 v40 h-10 v-30 l-18 30 h-14 z" fill="#000"/>
  </svg>
);

const DocsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="3.5 2 17 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.5 2H5.5C4.4 2 3.5 2.9 3.5 4V20C3.5 21.1 4.4 22 5.5 22H18.5C19.6 22 20.5 21.1 20.5 20V8L14.5 2Z" fill="#4285F4"/>
    <path d="M14.5 2V8H20.5L14.5 2Z" fill="#8AB4F8"/>
    <path d="M7.5 12H16.5V14H7.5V12ZM7.5 16H16.5V18H7.5V16ZM7.5 8H11.5V10H7.5V8Z" fill="white"/>
  </svg>
);

const GmailIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 6.5v11C1.5 18.88 2.62 20 4 20h3.5v-7.5L12 16l4.5-3.5V20H20c1.38 0 2.5-1.12 2.5-2.5v-11c0-1.66-1.9-2.58-3.2-1.55L12 10.5 4.7 4.95C3.4 3.92 1.5 4.84 1.5 6.5z" fill="#EA4335"/>
    <path d="M7.5 12.5V20H4c-1.38 0-2.5-1.12-2.5-2.5v-11l6 4.5z" fill="#4285F4"/>
    <path d="M16.5 12.5V20H20c1.38 0 2.5-1.12 2.5-2.5v-11l-6 4.5z" fill="#34A853"/>
    <path d="M7.5 12.5L12 16l4.5-3.5V5L12 10.5 7.5 5v7.5z" fill="#FBBC05"/>
  </svg>
);

const KakaoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="-9 -9 148 148" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="130" rx="35" fill="#FAE100"/>
    <path d="M65 35C42.3563 35 24 49.6828 24 67.791C24 78.3554 29.8706 87.7455 38.8377 93.5255L35.666 105.117C35.3912 106.122 36.544 106.835 37.3888 106.187L51.3653 95.475C55.6888 96.344 60.2541 96.812 65 96.812C87.6437 96.812 106 82.1292 106 64.021C106 45.9128 87.6437 35 65 35Z" fill="#371D1E"/>
    <path d="M43 55.5 H53 V58.5 H49.5 V68.5 H46.5 V58.5 H43 Z" fill="#FAE100"/>
    <path d="M54 68.5 L58 55.5 H61 L65 68.5 H61.5 L60.5 65 H58.5 L57.5 68.5 H54 Z M59 62.5 H60 L59.5 58.5 L59 62.5 Z" fill="#FAE100"/>
    <path d="M67 55.5 H70 V65.5 H75 V68.5 H67 Z" fill="#FAE100"/>
    <path d="M77 55.5 H80 V61 L84 55.5 H88 L83 62 L88.5 68.5 H84.5 L81 63.5 L80 64.5 V68.5 H77 Z" fill="#FAE100"/>
  </svg>
);

const destinations: { id: Destination; icon: React.ElementType; label: string }[] = [
  { id: 'Notion', icon: NotionIcon, label: 'Notion' },
  { id: 'Docs', icon: DocsIcon, label: 'Google Docs' },
  { id: 'Gmail', icon: GmailIcon, label: 'Gmail' },
  { id: 'KakaoTalk', icon: KakaoIcon, label: 'KakaoTalk' },
];

export function ScreenSelect({ onSelect }: Props) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center w-full"
    >
      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="text-[22px] font-medium text-white/80 mb-10 tracking-tight"
      >
        어디에 실행할까요?
      </motion.h1>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="w-full bg-voxera-border-tray rounded-[2.5rem] p-[1.5px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
      >
        {/* Animated Border Light */}
        <div className="absolute inset-[-100%] z-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0_270deg,rgba(196,203,245,0.1)_310deg,rgba(196,203,245,0.6)_360deg)]"
          />
        </div>
        
        <div className="relative w-full h-full bg-voxera-tray rounded-[calc(2.5rem-1.5px)] p-6 z-10 overflow-hidden">
          {/* Subtle inner top light for the tray */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-voxera-periwinkle/20 to-transparent blur-[1px]" />
          
          <div className="grid grid-cols-2 gap-4 relative z-10">
            {destinations.map((dest) => (
              <button
                key={dest.id}
                onClick={() => onSelect(dest.id)}
                className="flex flex-col items-center justify-center gap-4 p-7 rounded-[1.5rem] bg-voxera-card border border-voxera-border-card hover:border-voxera-border-active hover:bg-voxera-card-hover hover:shadow-[0_0_25px_rgba(196,203,245,0.15)] transition-all duration-500 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-voxera-periwinkle/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <dest.icon 
                  className="w-10 h-10 transition-all duration-500 opacity-70 saturate-50 group-hover:opacity-100 group-hover:saturate-100 group-hover:scale-110 drop-shadow-md"
                />
                <span className="text-[14px] font-medium text-white/50 group-hover:text-white/90 transition-colors duration-500 tracking-wide">
                  {dest.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
