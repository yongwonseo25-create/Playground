'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type FreeTrialModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FreeTrialModal({ open, onOpenChange }: FreeTrialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">VIP 무료 체험을 시작해 보세요</DialogTitle>
          <DialogDescription className="text-zinc-400">
            지금 연결하시면 음성으로 업무를 실행하는 Voxera 워크플로우를 바로 체험할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
          마이크 또는 CTA를 누르면 이 모달이 열리도록 연결되어 있습니다. 다음 단계에서 실제 리드 수집 폼이나 예약 흐름을 붙이면 됩니다.
        </div>
      </DialogContent>
    </Dialog>
  );
}
