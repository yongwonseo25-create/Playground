'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle2, CreditCard, LoaderCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getStripeTestPublishableKey,
  loadBillingCredits,
  startStripeCheckout
} from '@/features/billing/services/billing-client';

const CREDIT_PACKS = [
  { credits: 25, label: 'Starter', note: '실험용 V3 샌드박스' },
  { credits: 50, label: 'Operator', note: '반복 검증용 묶음' },
  { credits: 100, label: 'Director', note: '파일럿 점검용 최대치' }
] as const;

export function BillingCheckoutPanel() {
  const [userIdInput, setUserIdInput] = useState('1');
  const [selectedCredits, setSelectedCredits] = useState<(typeof CREDIT_PACKS)[number]['credits']>(50);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditSource, setCreditSource] = useState<'cache' | 'database' | null>(null);

  const parsedUserId = Number(userIdInput);
  const isValidUserId = Number.isInteger(parsedUserId) && parsedUserId > 0;

  let stripeKeyError: string | null = null;
  try {
    getStripeTestPublishableKey();
  } catch (error) {
    stripeKeyError = error instanceof Error ? error.message : 'Stripe test publishable key is invalid.';
  }

  const loadCredits = async (userId: number) => {
    setIsLoadingCredits(true);

    try {
      const result = await loadBillingCredits(userId);
      setCreditBalance(result.credits);
      setCreditSource(result.source);
    } catch (error) {
      const message = error instanceof Error ? error.message : '크레딧 잔액을 불러오지 못했습니다.';
      toast.error(message);
      setCreditBalance(null);
      setCreditSource(null);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  useEffect(() => {
    if (!isValidUserId) {
      setCreditBalance(null);
      setCreditSource(null);
      return;
    }

    void loadCredits(parsedUserId);
  }, [isValidUserId, parsedUserId]);

  const handleCheckout = async () => {
    if (!isValidUserId || stripeKeyError) {
      toast.error(stripeKeyError ?? '유효한 사용자 ID를 입력해 주세요.');
      return;
    }

    setIsStartingCheckout(true);
    const loadingToast = toast.loading('Stripe Test Mode 체크아웃 세션을 생성 중입니다...');

    try {
      await startStripeCheckout({
        userId: parsedUserId,
        creditsDelta: selectedCredits
      });
      toast.success('Stripe 테스트 결제창으로 이동합니다.', {
        id: loadingToast
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '체크아웃 시작에 실패했습니다.';
      toast.error(message, {
        id: loadingToast
      });
    } finally {
      setIsStartingCheckout(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:py-12">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Stripe Test Mode only
          </span>
          <span className="rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-muted-foreground">
            V3 Checkout Sandbox
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">VOXERA Billing Sandbox</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            `/api/payment/checkout`와 연결된 테스트 결제 UI입니다. 프런트엔드는 반드시 `pk_test_`
            키만 허용하며, 결제 결과는 Step 2의 Stripe webhook과 비관적 잠금 로직으로 이어집니다.
          </p>
        </div>
      </motion.section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>크레딧 패키지 선택</CardTitle>
            <CardDescription>실제 과금이 아닌 Stripe Test Mode 샌드박스만 사용합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="billing-user-id" className="text-sm font-medium text-foreground">
                사용자 ID
              </label>
              <div className="flex gap-2">
                <input
                  id="billing-user-id"
                  data-testid="billing-user-id"
                  className="h-11 w-full rounded-xl border border-input bg-white px-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                  inputMode="numeric"
                  value={userIdInput}
                  onChange={(event) => setUserIdInput(event.target.value)}
                  placeholder="예: 1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!isValidUserId) {
                      toast.error('유효한 사용자 ID를 입력해 주세요.');
                      return;
                    }

                    void loadCredits(parsedUserId);
                  }}
                  disabled={isLoadingCredits || !isValidUserId}
                  data-testid="billing-refresh-credits"
                >
                  {isLoadingCredits ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '잔액 조회'}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {CREDIT_PACKS.map((pack) => {
                const selected = pack.credits === selectedCredits;

                return (
                  <motion.button
                    key={pack.credits}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedCredits(pack.credits)}
                    data-testid={`billing-pack-${pack.credits}`}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-[0_20px_40px_rgba(14,165,233,0.16)]'
                        : 'border-border bg-white/70 hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{pack.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{pack.note}</p>
                      </div>
                      {selected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : null}
                    </div>
                    <p className="mt-4 text-3xl font-bold tracking-tight">{pack.credits}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">credits</p>
                  </motion.button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border/70 bg-slate-950 px-5 py-4 text-slate-50">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-sm font-medium">선택된 결제 패키지</p>
                  <p className="text-xs text-slate-300">체크아웃은 Stripe Hosted Page로 이동합니다.</p>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Credits</p>
                  <p className="text-3xl font-semibold">{selectedCredits}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={isStartingCheckout || !isValidUserId || Boolean(stripeKeyError)}
                  data-testid="billing-checkout-button"
                  className="min-w-[172px]"
                >
                  {isStartingCheckout ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    'Stripe 테스트 결제'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>크레딧 상태</CardTitle>
            <CardDescription>Redis cache-first 조회 결과를 같은 화면에서 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current balance</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight" data-testid="billing-credit-balance">
                {creditBalance ?? '--'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="billing-credit-source">
                {creditSource ? `source: ${creditSource}` : '잔액을 아직 조회하지 않았습니다.'}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/70 bg-white/80 p-4">
              <p className="text-sm font-medium">프런트 안전장치</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>- `pk_test_`가 아니면 버튼을 비활성화합니다.</li>
                <li>- 버튼은 `/api/payment/checkout`를 호출한 뒤 Stripe Hosted Checkout으로 이동합니다.</li>
                <li>- 결제 완료 후 `/billing/success`, 취소 시 `/billing/cancel`로 복귀합니다.</li>
              </ul>
            </div>

            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm">
              <p className="font-medium text-foreground">환경 상태</p>
              <p className={stripeKeyError ? 'text-destructive' : 'text-emerald-600'}>
                {stripeKeyError ?? '프런트 Stripe publishable key가 test mode로 설정되어 있습니다.'}
              </p>
              <Button asChild variant="ghost" className="w-full justify-start px-0 text-primary">
                <Link href="/capture">음성 캡처로 돌아가기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
