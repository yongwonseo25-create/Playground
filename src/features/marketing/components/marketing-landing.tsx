import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function MarketingLanding() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-10 sm:px-6">
      <section className="animate-slide-up space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Rocket className="h-3.5 w-3.5" />
          Voxera foundation
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Listen. Think. Act.</h1>
        <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
          Mobile-first front-end scaffold for a voice-based business execution agent. Audio logic and backend integrations are intentionally deferred.
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Voice Workflow</CardTitle>
            <CardDescription>Route group prepared for capture, state, and execution UX.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/capture">Open voice shell</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Architecture Ready</CardTitle>
            <CardDescription>Typed placeholders for future AudioWorklet + WebSocket streams.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No backend assumptions are hardcoded.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
