'use client';

const leftBars = [52, 78, 62, 88, 66, 74];
const rightBars = [70, 58, 86, 64, 82, 56];

function EqBars({ side, bars }: { side: 'left' | 'right'; bars: number[] }) {
  return (
    <div className={`flex items-end gap-2 ${side === 'left' ? 'pr-2' : 'pl-2'}`} aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={`${side}-${index}`}
          className="voxera-mic-eq w-2 rounded-full bg-gradient-to-b from-[#7af7e3] via-[#7c8cff] to-[#ff82dc]"
          style={{ height: `${height}px`, animationDelay: `${index * 0.16}s` }}
        />
      ))}
    </div>
  );
}

export function VoiceHologramMic() {
  return (
    <div className="relative mx-auto flex items-center justify-center gap-5">
      <EqBars side="left" bars={leftBars} />

      <div className="relative">
        <div className="absolute -inset-6 rounded-[48px] bg-[radial-gradient(circle,rgba(96,165,250,0.2),transparent_68%)] blur-2xl" />
        <div className="relative overflow-hidden rounded-[38px] border border-white/12 bg-[linear-gradient(180deg,rgba(7,12,20,0.96),rgba(6,10,17,0.98))] p-4 shadow-[0_0_70px_rgba(125,211,252,0.18)] backdrop-blur-2xl">
          <svg
            viewBox="0 0 240 330"
            className="h-[240px] w-[180px] sm:h-[280px] sm:w-[210px] lg:h-[320px] lg:w-[240px]"
            role="img"
            aria-label="VOICE hologram microphone"
          >
            <defs>
              <radialGradient id="voxera-head" cx="50%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.95" />
                <stop offset="62%" stopColor="#94a3b8" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#64748b" stopOpacity="0.35" />
              </radialGradient>
              <linearGradient id="voxera-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7af7e3" stopOpacity="0.28" />
                <stop offset="52%" stopColor="#1f2937" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#c59bff" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="voxera-stand" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#e2e8f0" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            <ellipse cx="120" cy="86" rx="58" ry="68" fill="url(#voxera-head)" />
            <rect x="62" y="118" width="116" height="130" rx="50" fill="url(#voxera-body)" />
            <rect x="106" y="248" width="28" height="46" rx="10" fill="url(#voxera-stand)" />
            <ellipse cx="120" cy="306" rx="66" ry="13" fill="url(#voxera-stand)" />
            <ellipse cx="120" cy="306" rx="48" ry="8" fill="#0f172a" opacity="0.7" />

            <line x1="78" y1="184" x2="162" y2="184" stroke="#7dd3fc" strokeOpacity="0.22" />
            <line x1="78" y1="202" x2="162" y2="202" stroke="#c4b5fd" strokeOpacity="0.2" />
            <line x1="88" y1="220" x2="152" y2="220" stroke="#67e8f9" strokeOpacity="0.18" />
          </svg>

          <div className="pointer-events-none absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2">
            <span className="text-base font-semibold tracking-[0.24em] text-cyan-100 drop-shadow-[0_0_12px_rgba(103,232,249,0.95)] sm:text-lg">
              VOICE
            </span>
          </div>
        </div>
      </div>

      <EqBars side="right" bars={rightBars} />
    </div>
  );
}
