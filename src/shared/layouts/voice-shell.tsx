import { cn } from '@/shared/lib/utils';
import type { PropsWithChildren } from 'react';

type VoiceShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  className?: string;
}>;

export function VoiceShell({ title, subtitle, className, children }: VoiceShellProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-6 pt-4 sm:border-x sm:border-border">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/90 px-4 py-4 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>
      <section className={cn('flex flex-1 flex-col gap-4 py-4', className)}>{children}</section>
    </main>
  );
}
