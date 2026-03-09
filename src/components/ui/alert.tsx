import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn('relative w-full rounded-lg border border-border bg-card p-4 text-card-foreground', className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function AlertIcon() {
  return <AlertCircle className="h-4 w-4 text-primary" />;
}

export { Alert, AlertTitle, AlertDescription, AlertIcon };
