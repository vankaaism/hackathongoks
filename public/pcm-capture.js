class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(640);
    this.offset = 0;
    this.peak = 0;
  }

  process(inputs) {
    const mono = inputs[0]?.[0];
    if (!mono) return true;
    for (const input of mono) {
      const value = Math.max(-1, Math.min(1, input));
      this.peak = Math.max(this.peak, Math.abs(value));
      this.samples[this.offset++] = value * (value < 0 ? 32768 : 32767);
      if (this.offset === this.samples.length) {
        this.port.postMessage({ pcm: this.samples.buffer, peak: this.peak }, [this.samples.buffer]);
        this.samples = new Int16Array(640);
        this.offset = 0;
        this.peak = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
