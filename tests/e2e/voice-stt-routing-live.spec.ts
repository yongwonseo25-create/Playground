import { expect, test, type Page } from '@playwright/test';
import { LiveSttRoutingStack } from './helpers/live-stt-routing-stack';

type RoutingProbeResult = {
  serverEvent: {
    type: 'transcript.final';
    sessionId: string;
    text: string;
    isFinal: true;
    pcmFrameCount?: number;
    stt_provider?: 'whisper' | 'return-zero';
    audio_duration_sec?: number;
  };
  submitResponse: {
    ok: boolean;
    stt_provider: 'whisper' | 'return-zero';
    audio_duration_sec: number;
  };
};

async function runBrowserRoutingProbe(
  page: Page,
  input: { language: string; premiumKoAccuracy: boolean }
): Promise<RoutingProbeResult> {
  await page.goto('/capture');

  return await page.evaluate(async ({ language, premiumKoAccuracy }) => {
    const wssUrl = 'ws://127.0.0.1:8787/voice-session';
    const sessionId = `routing-e2e-${crypto.randomUUID()}`;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    const audioContext = new window.AudioContext({ latencyHint: 'interactive' });
    await audioContext.audioWorklet.addModule('/audio/voxera-pcm16-capture.worklet.js');
    await audioContext.resume();

    const socket = await new Promise<WebSocket>((resolve, reject) => {
      const nextSocket = new WebSocket(wssUrl);
      nextSocket.binaryType = 'arraybuffer';
      nextSocket.addEventListener('open', () => resolve(nextSocket), { once: true });
      nextSocket.addEventListener('error', () => reject(new Error('Failed to open WSS test socket.')), {
        once: true
      });
    });

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'voxera-pcm16-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });
    const muteNode = audioContext.createGain();
    muteNode.gain.value = 0;

    let serverReady = false;
    let pcmFrameCount = 0;
    const pendingChunks: ArrayBuffer[] = [];

    const finalTranscriptPromise = new Promise<RoutingProbeResult['serverEvent']>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Timed out waiting for transcript.final from the WSS server.'));
      }, 20_000);

      socket.addEventListener('message', async (event) => {
        const text =
          typeof event.data === 'string'
            ? event.data
            : event.data instanceof Blob
              ? await event.data.text()
              : new TextDecoder().decode(event.data);

        const payload = JSON.parse(text) as
          | { type: 'session.ready' }
          | RoutingProbeResult['serverEvent']
          | { type: 'session.error'; error: string };

        if (payload.type === 'session.ready') {
          serverReady = true;
          while (pendingChunks.length > 0) {
            const nextChunk = pendingChunks.shift();
            if (nextChunk) {
              socket.send(nextChunk);
            }
          }
          return;
        }

        if (payload.type === 'session.error') {
          window.clearTimeout(timeout);
          reject(new Error(payload.error));
          return;
        }

        if (payload.type === 'transcript.final') {
          window.clearTimeout(timeout);
          resolve(payload);
        }
      });
    });

    workletNode.port.onmessage = (event) => {
      const chunk = event.data as { type?: string; frameCount?: number; buffer?: ArrayBuffer };
      if (chunk.type !== 'pcm-chunk' || typeof chunk.frameCount !== 'number' || !chunk.buffer) {
        return;
      }

      pcmFrameCount += chunk.frameCount;
      if (serverReady && socket.readyState === WebSocket.OPEN) {
        socket.send(chunk.buffer);
        return;
      }

      pendingChunks.push(chunk.buffer.slice(0));
    };

    sourceNode.connect(workletNode);
    workletNode.connect(muteNode);
    muteNode.connect(audioContext.destination);

    socket.send(
      JSON.stringify({
        type: 'session.start',
        sessionId,
        language,
        premium_ko_accuracy: premiumKoAccuracy,
        sentAt: new Date().toISOString(),
        audio: {
          format: 'pcm16',
          sampleRateHz: audioContext.sampleRate,
          channelCount: 1
        }
      })
    );

    await new Promise((resolve) => window.setTimeout(resolve, 2500));

    workletNode.port.postMessage({ type: 'stop' });
    sourceNode.disconnect();
    workletNode.disconnect();
    muteNode.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);

    socket.send(
      JSON.stringify({
        type: 'session.stop',
        sessionId,
        sentAt: new Date().toISOString(),
        totalFrames: pcmFrameCount
      })
    );

    const serverEvent = await finalTranscriptPromise;
    const submitResponse = await fetch('/api/voice/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientRequestId: `routing-submit-${sessionId}`,
        transcriptText: serverEvent.text,
        notionDatabaseId: 'notion-db-routing',
        notionParentPageId: 'notion-page-routing',
        sessionId,
        pcmFrameCount: serverEvent.pcmFrameCount ?? pcmFrameCount,
        stt_provider: serverEvent.stt_provider,
        audio_duration_sec: serverEvent.audio_duration_sec
      })
    }).then(async (response) => {
      return (await response.json()) as RoutingProbeResult['submitResponse'];
    });

    socket.close(1000, 'routing-e2e-complete');

    return {
      serverEvent,
      submitResponse
    };
  }, input);
}

test.describe('voice stt routing live automation', () => {
  let stack: LiveSttRoutingStack;

  test.beforeEach(async () => {
    stack = new LiveSttRoutingStack();
    await stack.start();
  });

  test.afterEach(async () => {
    await stack.close();
  });

  test('Scenario A: synthetic microphone defaults to Whisper routing', async ({ page }, testInfo) => {
    const result = await runBrowserRoutingProbe(page, {
      language: 'en-US',
      premiumKoAccuracy: false
    });

    await expect.poll(() => stack.getWebhookRequests().length).toBe(1);
    const webhookRequest = stack.getWebhookRequests()[0];
    const logs = stack.getLogs().join('\n');

    expect(result.serverEvent).toMatchObject({
      type: 'transcript.final',
      stt_provider: 'whisper'
    });
    expect(result.submitResponse).toMatchObject({
      ok: true,
      stt_provider: 'whisper'
    });
    expect(webhookRequest?.body.stt_provider).toBe('whisper');
    expect(webhookRequest?.body.audio_duration_sec).toBeGreaterThan(0);
    expect(webhookRequest?.body.transcriptText).toBe(result.serverEvent.text);
    expect(webhookRequest?.body.notionDatabaseId).toBe('notion-db-routing');
    expect(webhookRequest?.body.notionParentPageId).toBe('notion-page-routing');
    expect(logs).toContain('[mock-stt] provider=whisper');
    console.log(
      `[routing-evidence] project=${testInfo.project.name} scenario=A server=${result.serverEvent.stt_provider} submit=${result.submitResponse.stt_provider} webhook=${webhookRequest?.body.stt_provider} duration=${webhookRequest?.body.audio_duration_sec} transcript="${webhookRequest?.body.transcriptText}"`
    );
  });

  test('Scenario B: premium Korean synthetic microphone routes to Return Zero', async ({ page }, testInfo) => {
    const result = await runBrowserRoutingProbe(page, {
      language: 'ko-KR',
      premiumKoAccuracy: true
    });

    await expect.poll(() => stack.getWebhookRequests().length).toBe(1);
    const webhookRequest = stack.getWebhookRequests()[0];
    const logs = stack.getLogs().join('\n');

    expect(result.serverEvent).toMatchObject({
      type: 'transcript.final',
      stt_provider: 'return-zero'
    });
    expect(result.submitResponse).toMatchObject({
      ok: true,
      stt_provider: 'return-zero'
    });
    expect(webhookRequest?.body.stt_provider).toBe('return-zero');
    expect(webhookRequest?.body.audio_duration_sec).toBeGreaterThan(0);
    expect(webhookRequest?.body.transcriptText).toBe(result.serverEvent.text);
    expect(webhookRequest?.body.notionDatabaseId).toBe('notion-db-routing');
    expect(webhookRequest?.body.notionParentPageId).toBe('notion-page-routing');
    expect(logs).toContain('[mock-stt] provider=return-zero auth');
    expect(logs).toContain('[mock-stt] provider=return-zero result');
    console.log(
      `[routing-evidence] project=${testInfo.project.name} scenario=B server=${result.serverEvent.stt_provider} submit=${result.submitResponse.stt_provider} webhook=${webhookRequest?.body.stt_provider} duration=${webhookRequest?.body.audio_duration_sec} transcript="${webhookRequest?.body.transcriptText}"`
    );
  });
});
