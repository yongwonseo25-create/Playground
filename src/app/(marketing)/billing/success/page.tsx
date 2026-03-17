import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <Card className="border-emerald-200 bg-emerald-50/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="h-5 w-5" />
            결제 테스트 완료
          </CardTitle>
          <CardDescription className="text-emerald-800/80">
            Stripe Test Mode 결제가 완료되었습니다. 실제 과금은 발생하지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link href="/billing">샌드박스로 돌아가기</Link>
          </Button>
          <Button asChild variant="outline" className="sm:w-auto">
            <Link href="/capture">음성 캡처 열기</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
