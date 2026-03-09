'use client';

import { useMemo } from 'react';
import { Mic, ShieldCheck, Timer } from 'lucide-react';
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
import { useVoiceCaptureMachine } from '@/features/voice-capture/state/use-voice-capture-machine';
import { clientEnv } from '@/shared/config/env.client';
import { VoiceShell } from '@/shared/layouts/voice-shell';

const statusLabelMap = {
  idle: 'Idle',
  'permission-requesting': 'Requesting microphone permission',
  ready: 'Ready to capture',
  recording: 'Recording PCM stream (max 15s)',
  stopping: 'Stopping capture',
  uploading: 'Uploading secured payload',
  success: 'Submission complete',
  error: 'Error'
} as const;

export function VoiceCaptureScreen() {
  const { state, progress, remainingMs, actions } = useVoiceCaptureMachine();

  const canRequestPermission = state.status === 'idle';
  const canStart = state.status === 'ready' || state.status === 'success';
  const canSubmit = state.status === 'stopping';

  const remainingSeconds = useMemo(() => (remainingMs / 1000).toFixed(1), [remainingMs]);

  return (
    <VoiceShell title="Voxera Capture" subtitle="AudioWorklet + PCM over WSS architecture (UI foundation)">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            Voice state machine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{statusLabelMap[state.status]}</p>
            <Progress value={progress} />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              Remaining: {remainingSeconds}s / hard stop at 15.0s (no early stop)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={!canRequestPermission}
              onClick={() => {
                actions.requestPermission();
                toast.info('Permission flow moved to ready state.');
              }}
            >
              Request Access
            </Button>

            <Button
              disabled={!canStart}
              onClick={() => {
                actions.startRecording();
                toast.info('Recording started. Hard stop set for exactly 15 seconds.');
              }}
            >
              Start 15s
            </Button>

            <Button variant="outline" disabled>
              Auto-Stop @15s
            </Button>

            <Button
              variant="default"
              disabled={!canSubmit}
              onClick={async () => {
                await actions.submitRecording();
                toast.success('Submission lock applied with clientRequestId.');
              }}
            >
              Submit
            </Button>
          </div>

          <Button variant="ghost" className="w-full" onClick={actions.reset}>
            Reset Session
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <div className="mb-2 flex items-center gap-2">
          <AlertIcon />
          <AlertTitle>Constitutional audio guardrails active</AlertTitle>
        </div>
        <AlertDescription>
          MediaRecorder is forbidden. This flow is scoped to AudioWorklet + PCM over WSS only, with fixed reducer states and request locking.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Session Info</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submission lock</DialogTitle>
              <DialogDescription>
                Upload can begin only after `clientRequestId` is generated and locked in the `uploading` transition.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => toast.info(`clientRequestId: ${state.clientRequestId ?? 'not assigned'}`)}>
                Show Lock ID
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button>
              <ShieldCheck className="h-4 w-4" />
              Security
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Security model</SheetTitle>
              <SheetDescription>Transport constraints for Sprint 1 foundation.</SheetDescription>
            </SheetHeader>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>- WSS origin: {new URL(clientEnv.NEXT_PUBLIC_WSS_URL).origin}</p>
              <p>- Non-local ws:// is rejected at startup.</p>
              <p>- Upload flow requires clientRequestId lock.</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </VoiceShell>
  );
}

