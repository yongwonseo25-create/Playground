'use client';

type SectionKind = 'wave-typing' | 'convert-structure' | 'wire-delivery' | 'stacking-grid';

type ZigzagSection = {
  titleLine1: string;
  titleLine2: string;
  bodyLine1: string;
  bodyLine2: string;
  reverse: boolean;
  kind: SectionKind;
  tone: 'mint' | 'purple';
};

const zigzagSections: ZigzagSection[] = [
  {
    titleLine1: '타이핑은 끝났다.',
    titleLine2: '그냥 말하십시오.',
    bodyLine1: '회의 직후, 이동 중 떠오른 생각.',
    bodyLine2: '앱 전환이나 타이핑 없이 가장 빠르게 즉시 기록합니다.',
    reverse: false,
    kind: 'wave-typing',
    tone: 'mint'
  },
  {
    titleLine1: 'AI 완벽',
    titleLine2: '자동 구조화',
    bodyLine1: '단순 받아쓰기가 아닙니다.',
    bodyLine2: '발화 의도를 파악해 요약, 할 일, 핵심 액션 아이템을 완벽히 추출합니다.',
    reverse: true,
    kind: 'convert-structure',
    tone: 'mint'
  },
  {
    titleLine1: '원래 쓰던 도구로',
    titleLine2: '즉시 꽂힌다',
    bodyLine1: '새로운 툴을 배울 필요 없습니다.',
    bodyLine2: '카카오톡, 노션, 구글 시트 등 팀이 이미 쓰고 있는 워크플로우에 1초 만에 자동 배포됩니다.',
    reverse: false,
    kind: 'wire-delivery',
    tone: 'purple'
  },
  {
    titleLine1: '흩어진 메모의',
    titleLine2: '자산화',
    bodyLine1: '개인 카톡방에서 휘발되던 메모가,',
    bodyLine2: '조직 전체가 검색하고 재사용할 수 있는 거대한 데이터 자산으로 축적됩니다.',
    reverse: true,
    kind: 'stacking-grid',
    tone: 'purple'
  }
];

function PanelWaveTyping() {
  const bars = [
    { h: 32, c: 'from-[#79f7e2] via-[#63e6ff] to-[#ff82dc]', d: 1.8 },
    { h: 54, c: 'from-[#ff82dc] via-[#c58fff] to-[#7c8cff]', d: 2.2 },
    { h: 42, c: 'from-[#ffe07a] via-[#ffb86b] to-[#f97316]', d: 1.9 },
    { h: 64, c: 'from-[#77d6ff] via-[#56ccf2] to-[#5b21b6]', d: 2.4 },
    { h: 48, c: 'from-[#7af7e3] via-[#6ad7ff] to-[#c59bff]', d: 2.05 }
  ];

  return (
    <div className="grid h-full grid-cols-[auto_1fr] items-center gap-4">
      <div className="flex h-[148px] items-end gap-2">
        {bars.map((bar, index) => (
          <span
            key={`wave-${index}`}
            className={`z-voice-wave w-[10px] rounded-full bg-gradient-to-b ${bar.c}`}
            style={{ height: `${bar.h}px`, animationDuration: `${bar.d}s`, animationDelay: `${index * 0.12}s` }}
          />
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#0A1321]/80 p-4">
        <p className="z-typing-line break-keep text-sm leading-relaxed text-slate-200 sm:text-base">
          회의 요약 생성 중... 액션 아이템 3건 정리 완료
        </p>
      </div>
    </div>
  );
}

function PanelConvertStructure() {
  return (
    <div className="relative h-full">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0A1321]/80 p-4">
        <div className="z-dummy-line h-3 w-11/12 rounded-full bg-slate-500/30" />
        <div className="z-dummy-line h-3 w-10/12 rounded-full bg-slate-500/30" style={{ animationDelay: '0.2s' }} />
        <div className="z-dummy-line h-3 w-7/12 rounded-full bg-slate-500/30" style={{ animationDelay: '0.35s' }} />
      </div>
      <div className="mt-4 grid gap-2">
        {['핵심 요약 자동 추출', '할 일 / 담당자 자동 태깅', '실행 우선순위 자동 정렬'].map((label, index) => (
          <div
            key={label}
            className="z-mint-tag flex items-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
            style={{ animationDelay: `${0.45 + index * 0.2}s` }}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-emerald-200/40 text-[10px]">
              ✓
            </span>
            <span className="break-keep leading-relaxed">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelWireDelivery() {
  return (
    <div className="relative h-[176px] overflow-hidden rounded-2xl border border-white/10 bg-[#0A1321]/80">
      <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-200/30 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.3)]" />

      <span className="z-logo-pill absolute left-6 top-6">KAKAO</span>
      <span className="z-logo-pill absolute right-8 top-10">NOTION</span>
      <span className="z-logo-pill absolute right-8 bottom-7">GOOGLE</span>

      <span className="z-neon-wire left-[48%] top-[48%] w-[120px] -rotate-[148deg]" />
      <span className="z-neon-wire left-[52%] top-[50%] w-[120px] rotate-[10deg]" />
      <span className="z-neon-wire left-[52%] top-[54%] w-[130px] rotate-[45deg]" />
    </div>
  );
}

function PanelStackingGrid() {
  return (
    <div className="relative h-[176px] overflow-hidden rounded-2xl border border-white/10 bg-[#0A1321]/80">
      <span className="z-speech-bubble z-bubble-1">회의 요약</span>
      <span className="z-speech-bubble z-bubble-2">할 일 추출</span>
      <span className="z-speech-bubble z-bubble-3">전송 완료</span>

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <span
            key={`stack-${index}`}
            className="h-5 rounded-md border border-violet-200/20 bg-violet-300/10"
            style={{ animationDelay: `${0.45 + index * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function InfographicPanel({ kind }: { kind: SectionKind }) {
  if (kind === 'wave-typing') return <PanelWaveTyping />;
  if (kind === 'convert-structure') return <PanelConvertStructure />;
  if (kind === 'wire-delivery') return <PanelWireDelivery />;
  return <PanelStackingGrid />;
}

function MockPanel({ kind, tone }: { kind: SectionKind; tone: 'mint' | 'purple' }) {
  const borderTone =
    tone === 'mint'
      ? 'border-emerald-300/30 shadow-[0_0_42px_rgba(52,211,153,0.15)]'
      : 'border-violet-300/30 shadow-[0_0_42px_rgba(167,139,250,0.15)]';
  const glowTone =
    tone === 'mint'
      ? 'bg-[radial-gradient(circle_at_14%_18%,rgba(94,234,212,0.25),transparent_56%)]'
      : 'bg-[radial-gradient(circle_at_84%_18%,rgba(192,132,252,0.25),transparent_58%)]';

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border bg-white/[0.04] p-5 backdrop-blur-xl ${borderTone}`}
      data-testid="z-pattern-mock"
    >
      <div className={`absolute inset-0 ${glowTone}`} />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(148,163,184,0.08),transparent_44%,rgba(148,163,184,0.04))]" />
      <div className="relative rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.94),rgba(7,11,19,0.98))] p-4">
        <InfographicPanel kind={kind} />
      </div>
    </div>
  );
}

export function BentoGridSection() {
  return (
    <section className="px-5 pb-28 pt-12 sm:px-8 lg:px-12 lg:pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="space-y-10 lg:space-y-14">
          {zigzagSections.map((item) => (
            <section
              key={`${item.titleLine1}-${item.titleLine2}`}
              className="flex flex-col items-stretch gap-6 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,15,25,0.94),rgba(7,11,19,0.98))] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.38)] md:grid md:grid-cols-2 md:items-center md:gap-10 md:p-10"
            >
              <div className={`${item.reverse ? 'md:order-2' : 'md:order-1'}`}>
                <h3 className="break-keep text-3xl font-semibold leading-relaxed tracking-[-0.03em] text-white sm:text-4xl">
                  {item.titleLine1}
                  <br />
                  {item.titleLine2}
                </h3>
                <p className="mt-5 break-keep text-base leading-relaxed text-slate-300 sm:text-lg">
                  {item.bodyLine1}
                  <br />
                  {item.bodyLine2}
                </p>
              </div>

              <div className={`${item.reverse ? 'md:order-1' : 'md:order-2'}`}>
                <MockPanel kind={item.kind} tone={item.tone} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
