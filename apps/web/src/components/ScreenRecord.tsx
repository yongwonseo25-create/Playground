import { motion } from 'motion/react';
import { RecordingState } from '../types';
import { Waveform } from './Waveform';
import { CustomMicIcon } from './CustomMicIcon';

interface Props {
  recordingState: RecordingState;
  setRecordingState: (state: RecordingState) => void;
  onComplete: (blob: Blob | null) => void;
}

export function ScreenRecord({ recordingState, setRecordingState, onComplete }: Props) {
  const isRecording = recordingState === 'recording';

  const handleToggle = () => {
    if (isRecording) {
      setRecordingState('idle');
      // In a real app, stop MediaRecorder and pass the resulting blob
      onComplete(new Blob());
    } else {
      setRecordingState('recording');
      // In a real app, start MediaRecorder
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center w-full"
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full relative">
        
        {/* Microphone Button */}
        <div className="relative flex items-center justify-center mb-16">
          {/* Layered Outer Halo Glow */}
          <motion.div 
            animate={{ 
              scale: isRecording ? [1, 1.2, 1] : [1, 1.02, 1],
              opacity: isRecording ? [0.2, 0.4, 0.2] : [0.05, 0.1, 0.05]
            }}
            transition={{ 
              duration: isRecording ? 2 : 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute w-56 h-56 rounded-full bg-gradient-to-tr from-voxera-lilac via-voxera-periwinkle to-voxera-icy-blue blur-[40px]"
          />
          
          <motion.button
            onClick={handleToggle}
            whileTap={{ scale: 0.96 }}
            className={`relative z-10 w-[112px] h-[112px] rounded-full flex items-center justify-center border transition-all duration-700 ${
              isRecording 
                ? 'bg-[#16161e] border-voxera-periwinkle/50 shadow-[0_0_40px_rgba(196,203,245,0.25)]' 
                : 'bg-[#0d0d12] border-white/10 hover:border-white/20 hover:bg-[#16161e]'
            }`}
          >
            <CustomMicIcon isRecording={isRecording} />
          </motion.button>
        </div>

        {/* Status Text */}
        <motion.div 
          key={recordingState}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center h-8 mb-8"
        >
          <p className={`text-[16px] tracking-wide font-medium ${isRecording ? 'text-voxera-periwinkle drop-shadow-[0_0_8px_rgba(196,203,245,0.5)]' : 'text-white/40'}`}>
            {isRecording ? '말씀을 담고 있어요' : '탭하여 시작'}
          </p>
        </motion.div>

        {/* Waveform */}
        <div className="h-28 w-full max-w-[300px] flex items-center justify-center">
          <Waveform isRecording={isRecording} />
        </div>

      </div>
    </motion.div>
  );
}
