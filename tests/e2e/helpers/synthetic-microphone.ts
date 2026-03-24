import type { Page } from '@playwright/test';

type SyntheticMicrophoneOptions = {
  language?: string;
  languages?: string[];
};

export async function installSyntheticMicrophone(
  page: Page,
  options: SyntheticMicrophoneOptions = {}
): Promise<void> {
  await page.addInitScript((input: SyntheticMicrophoneOptions) => {
    if (input.language) {
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        get: () => input.language
      });
    }

    if (Array.isArray(input.languages) && input.languages.length > 0) {
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        get: () => input.languages
      });
    }

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      return;
    }

    mediaDevices.getUserMedia = async () => {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      oscillator.type = 'sine';
      oscillator.frequency.value = 220;
      gain.gain.value = 0.18;

      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();

      destination.stream.getTracks().forEach((track) => {
        const originalStop = track.stop.bind(track);
        track.stop = () => {
          oscillator.stop();
          void audioContext.close().catch(() => undefined);
          originalStop();
        };
      });

      return destination.stream;
    };
  }, options);
}
