import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  CheckCircle,
  Inbox,
  Kanban,
  Layout,
  Lightbulb,
  XCircle,
} from 'lucide-react';

const quickStartSteps = [
  'Voice Inbox에서 신규 항목 확인',
  '요약과 액션 아이템을 빠르게 검토',
  '실제로 해야 할 일만 Execution Board에 등록',
  '담당자, 마감일, 우선순위 지정',
  '완료 후 상태 업데이트',
];

const mistakes = [
  'Voice Inbox를 할 일 보드처럼 직접 운영하는 실수',
  '실행하지 않을 항목까지 Execution Board에 넣는 실수',
  '담당자나 마감일 없이 등록하는 실수',
  '완료 후 상태 업데이트를 하지 않는 실수',
];

export default function App() {
  return (
    <div className="min-h-screen bg-[#FAFAF9] px-4 py-12 font-sans md:py-20">
      <section className="relative mx-auto mb-16 w-full max-w-5xl overflow-hidden rounded-[2.5rem] border-2 border-sky-100 bg-white p-12 text-center shadow-sm md:p-24">
        <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-sky-200 via-emerald-200 to-sky-200" />
        <div className="mb-8 inline-block rounded-full border border-sky-100 bg-sky-50 px-5 py-2 text-sm font-bold tracking-wide text-sky-700">
          VOXERA Onboarding
        </div>
        <h1 className="mb-8 break-keep text-4xl font-extrabold leading-tight tracking-tight text-slate-800 md:text-5xl lg:text-6xl">
          VOXERA 실행 가이드
        </h1>
        <p className="mb-6 break-keep text-2xl font-bold leading-snug text-slate-700 md:text-3xl">
          들어온 음성을 쌓아두지 말고, 실행으로 전환하세요.
        </p>
        <p className="mx-auto max-w-3xl break-keep text-lg leading-relaxed text-slate-600 md:text-xl">
          Voice Inbox에서 검토하고, 실제 해야 할 일만 Execution Board로 옮겨
          팀의 실행력을 유지합니다.
        </p>
      </section>

      <section className="mx-auto mb-16 w-full max-w-5xl rounded-[2.5rem] border-2 border-emerald-100 bg-white p-8 shadow-sm md:p-16">
        <h2 className="mb-10 flex items-center gap-3 break-keep text-2xl font-bold text-slate-800 md:text-3xl">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          빠른 시작
        </h2>
        <div className="flex flex-col gap-4">
          {quickStartSteps.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-5 rounded-2xl border border-emerald-100/60 bg-emerald-50/50 p-5 md:p-6"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
                {index + 1}
              </div>
              <p className="break-keep text-lg font-medium text-slate-700 md:text-xl">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mb-16 w-full max-w-5xl rounded-[2.5rem] border-2 border-orange-100 bg-white p-8 shadow-sm md:p-16">
        <h2 className="mb-10 flex items-center gap-3 break-keep text-2xl font-bold text-slate-800 md:text-3xl">
          <Layout className="h-8 w-8 text-orange-400" />
          보드 역할
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <div className="rounded-[2rem] border border-orange-100 bg-orange-50/50 p-8 md:p-10">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-100/50 bg-white shadow-sm">
              <Inbox className="h-8 w-8 text-orange-400" />
            </div>
            <h3 className="mb-5 break-keep text-2xl font-bold text-orange-900">Voice Inbox</h3>
            <p className="break-keep text-lg leading-relaxed text-orange-800/90">
              음성 기록이 텍스트로 변환되어 들어오는 곳입니다. 요약과 액션 아이템을
              먼저 확인하고, 실제 실행이 필요한지 판단하는 검토 대기열로 사용합니다.
            </p>
          </div>
          <div className="rounded-[2rem] border border-sky-100 bg-sky-50/50 p-8 md:p-10">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-100/50 bg-white shadow-sm">
              <Kanban className="h-8 w-8 text-sky-400" />
            </div>
            <h3 className="mb-5 break-keep text-2xl font-bold text-sky-900">
              Execution Board
            </h3>
            <p className="break-keep text-lg leading-relaxed text-sky-800/90">
              실제 해야 할 일만 모아 관리하는 실행 보드입니다. 담당자, 우선순위,
              마감일을 지정하고 끝날 때까지 추적하는 운영 기준 보드입니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto mb-16 w-full max-w-5xl rounded-[2.5rem] border-2 border-yellow-100 bg-white p-8 shadow-sm md:p-16">
        <h2 className="mb-10 flex items-center gap-3 break-keep text-2xl font-bold text-slate-800 md:text-3xl">
          <ArrowRight className="h-8 w-8 text-yellow-400" />
          실행 흐름
        </h2>
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row md:gap-6">
          <div className="w-full flex-1 rounded-3xl border border-yellow-100 bg-yellow-50/50 p-8 text-center">
            <h4 className="mb-3 break-keep text-xl font-bold text-yellow-900">1. 확인</h4>
            <p className="break-keep text-lg text-yellow-800">Voice Inbox 확인</p>
          </div>
          <ArrowRight className="hidden h-10 w-10 flex-shrink-0 text-yellow-300 md:block" />
          <ArrowDown className="h-10 w-10 flex-shrink-0 text-yellow-300 md:hidden" />
          <div className="w-full flex-1 rounded-3xl border border-yellow-100 bg-yellow-50/50 p-8 text-center">
            <h4 className="mb-3 break-keep text-xl font-bold text-yellow-900">2. 추리기</h4>
            <p className="break-keep text-lg text-yellow-800">실행할 항목만 추출</p>
          </div>
          <ArrowRight className="hidden h-10 w-10 flex-shrink-0 text-yellow-300 md:block" />
          <ArrowDown className="h-10 w-10 flex-shrink-0 text-yellow-300 md:hidden" />
          <div className="w-full flex-1 rounded-3xl border border-yellow-100 bg-yellow-50/50 p-8 text-center">
            <h4 className="mb-3 break-keep text-xl font-bold text-yellow-900">3. 등록</h4>
            <p className="break-keep text-lg text-yellow-800">
              Execution Board 등록 및 상태 업데이트
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto mb-16 w-full max-w-5xl rounded-[2.5rem] border-2 border-rose-100 bg-white p-8 shadow-sm md:p-16">
        <h2 className="mb-10 flex items-center gap-3 break-keep text-2xl font-bold text-slate-800 md:text-3xl">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          자주 하는 실수
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {mistakes.map((mistake) => (
            <div
              key={mistake}
              className="flex items-start gap-4 rounded-3xl border border-rose-100 bg-rose-50/50 p-6 md:p-8"
            >
              <XCircle className="mt-0.5 h-7 w-7 flex-shrink-0 text-rose-400" />
              <p className="break-keep text-lg font-medium leading-relaxed text-rose-900 md:text-xl">
                {mistake}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mb-16 w-full max-w-5xl rounded-[2.5rem] border-2 border-teal-100 bg-white p-8 shadow-sm md:p-16">
        <h2 className="mb-10 flex items-center gap-3 break-keep text-2xl font-bold text-slate-800 md:text-3xl">
          <Lightbulb className="h-8 w-8 text-teal-400" />
          실행 전환 예시
        </h2>
        <div className="rounded-[2rem] border border-teal-100 bg-teal-50/50 p-8 md:p-12">
          <div className="mb-10 border-b border-teal-200/50 pb-8">
            <h4 className="mb-3 break-keep text-sm font-bold uppercase tracking-wider text-teal-600">
              상황
            </h4>
            <p className="break-keep text-xl font-bold text-teal-900 md:text-2xl">
              오전 회의 내용을 실행 항목으로 정리
            </p>
          </div>

          <div className="space-y-8 md:space-y-12">
            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="break-keep pt-1 text-lg font-bold text-teal-800 md:w-1/4 md:text-xl">
                입력
              </div>
              <div className="break-keep rounded-2xl border border-teal-100 bg-white p-6 text-lg leading-relaxed text-slate-700 shadow-sm md:w-3/4 md:p-8">
                &quot;이번 주 금요일까지 투자자용 제안서 초안을 수정해서 공유해 주세요.
                그리고 다음 주 파트너 미팅 전에 핵심 질문도 정리해야 합니다.&quot;
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="break-keep pt-1 text-lg font-bold text-teal-800 md:w-1/4 md:text-xl">
                검토
                <span className="mt-1 block text-sm font-normal text-teal-600 md:text-base">
                  (Voice Inbox)
                </span>
              </div>
              <div className="break-keep rounded-2xl border border-teal-100 bg-white p-6 text-lg leading-relaxed text-slate-700 shadow-sm md:w-3/4 md:p-8">
                <ul className="list-inside list-disc space-y-3">
                  <li>투자자용 제안서 수정과 공유</li>
                  <li>파트너 미팅 전 핵심 질문 정리</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="break-keep pt-1 text-lg font-bold text-teal-800 md:w-1/4 md:text-xl">
                실행 항목 추출
              </div>
              <div className="break-keep rounded-2xl border border-teal-100 bg-white p-6 text-lg leading-relaxed text-slate-700 shadow-sm md:w-3/4 md:p-8">
                <ol className="list-inside list-decimal space-y-3 font-medium">
                  <li>투자자용 제안서 수정 및 공유</li>
                  <li>파트너 미팅용 핵심 질문 리스트 정리</li>
                </ol>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="break-keep pt-1 text-lg font-bold text-teal-800 md:w-1/4 md:text-xl">
                Execution Board 등록
              </div>
              <div className="space-y-4 md:w-3/4">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-6 shadow-sm">
                  <div className="mb-2 break-keep text-lg font-bold text-sky-900">
                    [투자자용 제안서 수정]
                  </div>
                  <div className="break-keep text-base font-medium text-sky-700">
                    담당자 지정 | 금요일 마감 | 우선순위 높음
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-6 shadow-sm">
                  <div className="mb-2 break-keep text-lg font-bold text-sky-900">
                    [파트너 미팅 질문 정리]
                  </div>
                  <div className="break-keep text-base font-medium text-sky-700">
                    담당자 지정 | 미팅 전 마감 | 우선순위 보통
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto mb-12 w-full max-w-5xl overflow-hidden rounded-[2.5rem] border-2 border-emerald-100 bg-gradient-to-br from-sky-50 to-emerald-50 p-12 text-center shadow-sm md:p-24">
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
        <h2 className="mb-8 break-keep text-4xl font-bold uppercase tracking-widest text-emerald-700/80 md:text-5xl">
          마지막 원칙
        </h2>
        <p className="relative z-10 break-keep text-3xl font-extrabold leading-tight text-slate-800 md:text-4xl lg:text-5xl">
          Voice Inbox에 머무르면 <span className="text-sky-600">기록</span>이고,
          <br className="hidden md:block" /> Execution Board로 옮기면{' '}
          <span className="text-emerald-600">실행</span>입니다.
        </p>
      </section>
    </div>
  );
}
