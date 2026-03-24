class VoxeraPcm16CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.stopped = false;

    this.port.onmessage = (event) => {
      if (event.data?.type === 'stop') {
        this.stopped = true;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !input[0] || this.stopped) {
      return !this.stopped;
    }

    const channel = input[0];

    if (output && output[0]) {
      output[0].set(channel);
    }

    const pcm16 = new Int16Array(channel.length);
    for (let index = 0; index < channel.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, channel[index]));
      pcm16[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
    }

    this.port.postMessage(
      {
        type: 'pcm-chunk',
        frameCount: pcm16.length,
        buffer: pcm16.buffer
      },
      [pcm16.buffer]
    );

    return true;
  }
}

registerProcessor('voxera-pcm16-capture', VoxeraPcm16CaptureProcessor);
