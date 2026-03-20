import { motion } from 'motion/react';

interface Props {
  isRecording: boolean;
}

export function Waveform({ isRecording }: Props) {
  // 32 bars for a denser, more organic look
  const bars = Array.from({ length: 32 });

  return (
    <div className="flex items-center justify-center gap-[3px] h-full w-full px-4">
      {bars.map((_, i) => {
        // Asymmetrical, denser near center
        const distanceFromCenter = Math.abs(i - 15.5);
        const normalizedDistance = distanceFromCenter / 15.5; // 0 at center, 1 at edge
        
        // Base height tapers off towards edges
        const baseHeight = Math.max(4, 20 * (1 - Math.pow(normalizedDistance, 1.5)));
        
        // Active height is much more dynamic in the center
        const activeMultiplier = 1 + (1 - normalizedDistance) * 2.5;
        const activeHeight = baseHeight + Math.random() * 18 * activeMultiplier;
        
        // Branded Color variation
        let colorClass = "bg-white/90";
        if (i % 5 === 0) colorClass = "bg-voxera-lilac";
        else if (i % 7 === 0) colorClass = "bg-voxera-periwinkle";
        else if (i % 11 === 0) colorClass = "bg-voxera-icy-blue";
        else if (i === 12 || i === 20) colorClass = "bg-voxera-mint";

        return (
          <motion.div
            key={i}
            animate={{
              height: isRecording 
                ? [activeHeight, activeHeight * 1.5, activeHeight] 
                : [baseHeight, baseHeight * 1.1, baseHeight],
              opacity: isRecording ? 1 : 0.3
            }}
            transition={{
              duration: isRecording ? 0.4 + Math.random() * 0.4 : 2 + Math.random(),
              repeat: Infinity,
              ease: "easeInOut",
              delay: isRecording ? i * 0.02 : i * 0.05
            }}
            className={`w-[3px] rounded-full ${colorClass} shadow-[0_0_8px_currentColor]`}
            style={{ minHeight: '4px' }}
          />
        );
      })}
    </div>
  );
}
