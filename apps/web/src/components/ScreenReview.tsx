import { motion, AnimatePresence } from 'motion/react';
import { SendState } from '../types';
import { useRef, useEffect } from 'react';

interface Props {
  isProcessing: boolean;
  processingStep: number;
  generatedText: string;
  sendState: SendState;
  onSend: () => void;
  onCancel: () => void;
}

const loadingPhrases = [
  "내용을 정리하고 있어요",
  "전달할 형태로 다듬고 있어요",
  "확인할 수 있게 준비하고 있어요"
];

export function ScreenReview({ isProcessing, processingStep, generatedText, sendState, onSend, onCancel }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [generatedText]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col w-full h-full pt-2"
    >
      <div className="text-center mb-3 flex justify-center">
        <h2 className="text-[20px] font-semibold text-voxera-lilac-icy tracking-[0.05em] pl-[0.05em] drop-shadow-[0_0_10px_rgba(228,231,245,0.2)]">전송 전 확인</h2>
      </div>

      {/* Text Review Window */}
      <div className="flex-1 relative w-full bg-[#08080b] rounded-[2rem] border-[2px] border-[#0066FF]/50 shadow-[0_0_30px_rgba(0,102,255,0.25),0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        {/* Double layered inner border effect */}
        <div className="absolute inset-[4px] rounded-[1.7rem] border border-[#0066FF]/30 pointer-events-none z-10" />
        
        {/* Subtle top edge light */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-[#0066FF]/80 to-transparent opacity-100 blur-[2px]" />

        <div className="flex-1 relative p-8 overflow-hidden flex flex-col z-20">
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center relative"
              >
                {/* Rotating subtle glow */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-voxera-periwinkle/15 via-transparent to-transparent blur-3xl"
                />
                
                <motion.p 
                  key={processingStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-voxera-icy-blue/90 font-medium z-10 text-[16px] tracking-wide"
                >
                  {loadingPhrases[Math.min(processingStep - 1, 2)] || loadingPhrases[0]}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div 
                key="content"
                ref={scrollRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex-1 overflow-y-auto custom-scrollbar pr-4"
              >
                <p className="text-white/90 leading-[1.8] whitespace-pre-wrap font-light text-[16px] tracking-wide">
                  {generatedText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-8 flex gap-4 h-[56px]">
        <button 
          onClick={onCancel}
          disabled={isProcessing || sendState === 'sending'}
          className="flex-1 rounded-2xl bg-[#111116] border border-white/10 text-white/50 font-medium hover:bg-[#1a1a24] hover:text-white/80 hover:border-white/20 transition-all disabled:opacity-50 text-[16px]"
        >
          취소
        </button>
        <button 
          onClick={onSend}
          disabled={isProcessing || sendState === 'sending'}
          className="flex-[2.5] rounded-2xl bg-white text-black font-bold hover:bg-voxera-lilac-icy transition-all disabled:opacity-50 relative overflow-hidden text-[16px] shadow-[0_0_25px_rgba(255,255,255,0.2)]"
        >
          {sendState === 'sending' ? (
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              전송 중...
            </motion.div>
          ) : (
            '전송'
          )}
        </button>
      </div>
    </motion.div>
  );
}
