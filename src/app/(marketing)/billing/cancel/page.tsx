import Link from 'next/link';
import { ArrowLeftCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BillingCancelPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftCircle className="h-5 w-5 text-muted-foreground" />
            결제 테스트 취소
          </CardTitle>
          <CardDescription>결제는 취소되었고 실제 과금은 발생하지 않았습니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link href="/billing">다시 시도하기</Link>
          </Button>
          <Button asChild variant="outline" className="sm:w-auto">
            <Link href="/">메인으로 이동</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
