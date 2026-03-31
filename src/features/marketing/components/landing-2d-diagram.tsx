'use client';

const problemCards = [
  {
    icon: '📝',
    text: '카톡에 적어두고\n다시 못 찾습니다'
  },
  {
    icon: '⏱️',
    text: '회의록 작성에\n매주 1시간 이상 낭비'
  },
  {
    icon: '🔁',
    text: 'CRM 업데이트\n계속 밀립니다'
  },
  {
    icon: '💡',
    text: '좋은 아이디어\n기억에서 사라집니다'
  }
];

const flowCards = [
  {
    title: '1) 먼저 말합니다',
    body: '자연어로 업무 지시'
  },
  {
    title: '2) 즉시 AI 구조화',
    body: '문맥 파악 후 데이터 가공'
  },
  {
    title: '3) 곧바로 실행',
    body: 'Notion / Slack 자동 전송'
  }
];

export function Landing2DDiagram() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-7">
        <section className="rounded-3xl border-2 border-[#333333] bg-[#0A0A0A] p-6 sm:p-8">
          <h1 className="break-keep text-center text-3xl font-bold leading-tight sm:text-4xl">
            말하면 정리되고,
            <br />
            바로 업무로 연결됩니다.
          </h1>
          <div className="mt-7 flex items-center justify-center">
            <div className="relative h-24 w-24">
              <span className="absolute inset-0 rounded-full border-2 border-violet-400/60" />
              <span className="absolute inset-2 rounded-full border-2 border-violet-400/45" />
              <span className="absolute inset-4 rounded-full border-2 border-violet-400/30" />
              <span className="absolute left-1/2 top-1/2 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-400 text-xl text-black">
                🎤
              </span>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button className="rounded-xl bg-[#00E5A0] px-6 py-3 text-sm font-bold text-[#0A0A0A] sm:text-base">
              데모 보기
            </button>
            <button className="rounded-xl border border-[#444444] px-6 py-3 text-sm text-white sm:text-base">
              도입 문의하기
            </button>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#00E5A0]">PROBLEMS</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {problemCards.map((card) => (
              <article
                key={card.text}
                className="rounded-2xl border border-[#2A2A2A] bg-[#121212] p-5 [background-image:repeating-linear-gradient(180deg,transparent,transparent_18px,rgba(255,255,255,0.03)_19px)]"
              >
                <div className="mb-2 text-2xl">{card.icon}</div>
                <p className="break-keep whitespace-pre-line text-base leading-relaxed text-white/95">{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#00E5A0]">HOW IT WORKS</p>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <article className="rounded-2xl border border-[#333333] bg-[#1A1A1A] p-5 text-center">
              <h3 className="text-lg font-bold">{flowCards[0].title}</h3>
              <p className="mt-2 break-keep text-sm text-[#AAAAAA]">{flowCards[0].body}</p>
            </article>
            <div className="hidden text-center text-2xl text-[#8B5CF6] md:block">→</div>
            <article className="rounded-2xl border border-[#333333] bg-[#1A1A1A] p-5 text-center">
              <h3 className="text-lg font-bold">{flowCards[1].title}</h3>
              <p className="mt-2 break-keep text-sm text-[#AAAAAA]">{flowCards[1].body}</p>
            </article>
            <div className="hidden text-center text-2xl text-[#8B5CF6] md:block">→</div>
            <article className="rounded-2xl border border-emerald-400/60 bg-[#1A1A1A] p-5 text-center">
              <h3 className="text-lg font-bold text-[#00E5A0]">{flowCards[2].title}</h3>
              <p className="mt-2 break-keep text-sm text-[#AAAAAA]">{flowCards[2].body}</p>
            </article>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#00E5A0]">IMPACT</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-[#222222] bg-[#0F0F0F] p-6 text-center">
              <p className="text-3xl font-bold text-[#94A3B8]">37분</p>
              <p className="mt-1 text-lg text-[#8B5CF6]">기존 방식</p>
              <p className="mt-1 text-4xl font-bold text-[#00E5A0]">3분</p>
              <p className="mt-3 text-sm text-[#AAAAAA]">업무 리드타임 단축</p>
            </article>
            <article className="rounded-2xl border border-[#222222] bg-[#0F0F0F] p-6 text-center">
              <p className="text-5xl font-bold text-white">92%</p>
              <p className="mt-2 text-sm text-[#AAAAAA]">생산성 향상</p>
            </article>
          </div>
          <div className="mt-4 rounded-2xl border border-[#333333] bg-[#0A0A0A] px-4 py-5">
            <p className="text-center text-xs tracking-[0.15em] text-[#AAAAAA]">PARTNERS &amp; INTEGRATIONS</p>
            <p className="mt-3 text-center text-sm text-[#666666]">[ Notion ] [ Slack ] [ Salesforce ] [ Jira ]</p>
          </div>
        </section>

        <footer className="pt-2 text-center text-xs text-[#444444]">© 2026 EXECUTE.AI. All rights reserved.</footer>
      </div>
    </main>
  );
}
