'use client';

import { useMemo, useState } from 'react';
import { Mic, Radio, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { VoiceShell } from '@/shared/layouts/voice-shell';
import { initialVoiceCaptureState } from '@/features/voice-capture/types/voice-types';

export function VoiceCaptureScreen() {
  const [status, setStatus] = useState(initialVoiceCaptureState.status);
  const [confidence, setConfidence] = useState(initialVoiceCaptureState.confidence);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'listening':
        return 'Listening for intent';
      case 'processing':
        return 'Thinking through actions';
      case 'complete':
        return 'Ready to execute';
      case 'error':
        return 'Needs attention';
      default:
        return 'Idle';
    }
  }, [status]);

  const simulateStage = (next: typeof status, nextConfidence: number) => {
    setStatus(next);
    setConfidence(nextConfidence);
    toast.info(`State changed: ${next}`);
  };

  return (
    <VoiceShell title="Voxera Capture" subtitle="Mobile-first voice shell (UI foundation)">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            Capture session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{statusLabel}</p>
            <Progress value={confidence} />
            <p className="text-xs text-muted-foreground">Confidence: {confidence}%</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => simulateStage('listening', 22)}>
              <Radio className="h-4 w-4" />
              Listen
            </Button>
            <Button variant="secondary" onClick={() => simulateStage('processing', 61)}>
              <WandSparkles className="h-4 w-4" />
              Think
            </Button>
            <Button variant="outline" onClick={() => simulateStage('complete', 100)}>
              Complete
            </Button>
            <Button variant="ghost" onClick={() => simulateStage('idle', 0)}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <div className="mb-2 flex items-center gap-2">
          <AlertIcon />
          <AlertTitle>Backend contract pending</AlertTitle>
        </div>
        <AlertDescription>
          Streaming and orchestration APIs are placeholders only. AudioWorklet + WSS integration is intentionally deferred.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Session Info</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Capture session placeholder</DialogTitle>
              <DialogDescription>
                No live audio transport is implemented in this sprint.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => toast.success('Ready for backend wiring later.')}>Acknowledge</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button>Open Queue</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Execution queue</SheetTitle>
              <SheetDescription>Future action candidates will surface here.</SheetDescription>
            </SheetHeader>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>- Placeholder: intent summary</p>
              <p>- Placeholder: confidence ranking</p>
              <p>- Placeholder: operator confirmation</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </VoiceShell>
  );
}
