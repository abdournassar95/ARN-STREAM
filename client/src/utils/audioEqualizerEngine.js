import { EQ_BANDS } from '../store/useEqualizerStore';

class AudioEqualizerEngine {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.preampNode = null;
    this.filters = [];
    this.analyserNode = null;
    this.connectedElement = null;

    // FX Nodes: Dry & Master
    this.dryGainNode = null;
    this.masterGainNode = null;

    // FX Nodes: Delay
    this.delayNode = null;
    this.delayFilterNode = null;
    this.delayFeedbackNode = null;
    this.delayWetNode = null;

    // FX Nodes: Echo
    this.echoDelayNode = null;
    this.echoFeedbackNode = null;
    this.echoWetNode = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  attach(audioElement, settings = {}) {
    if (!audioElement) return;
    const ctx = this.initContext();
    if (!ctx) return;

    if (this.connectedElement === audioElement && this.filters.length > 0) {
      this.applySettings(settings);
      return;
    }

    try {
      // Avoid creating multiple media element sources on the same element
      if (!audioElement._arnEqSource) {
        audioElement._arnEqSource = ctx.createMediaElementSource(audioElement);
      }
      this.sourceNode = audioElement._arnEqSource;

      // 1. Preamp gain node
      this.preampNode = ctx.createGain();

      // 2. Analyser for live visualizer
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 3. Create 7 EQ band filters
      this.filters = EQ_BANDS.map((band) => {
        const filter = ctx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.freq;
        filter.gain.value = 0;
        if (band.type === 'peaking') {
          filter.Q.value = 1.4;
        }
        return filter;
      });

      // 4. Dry & Master Gains
      this.dryGainNode = ctx.createGain();
      this.dryGainNode.gain.value = 1.0;
      this.masterGainNode = ctx.createGain();
      this.masterGainNode.gain.value = 1.0;

      // 5. Studio Delay FX Chain
      this.delayNode = ctx.createDelay(3.0);
      this.delayNode.delayTime.value = 0.25;

      // Analog warmth lowpass filter for delay repeats
      this.delayFilterNode = ctx.createBiquadFilter();
      this.delayFilterNode.type = 'lowpass';
      this.delayFilterNode.frequency.value = 2800;
      this.delayFilterNode.Q.value = 0.7;

      this.delayFeedbackNode = ctx.createGain();
      this.delayFeedbackNode.gain.value = 0;

      this.delayWetNode = ctx.createGain();
      this.delayWetNode.gain.value = 0;

      // 6. Studio Spatial Echo FX Chain
      this.echoDelayNode = ctx.createDelay(2.0);
      this.echoDelayNode.delayTime.value = 0.18;

      this.echoFeedbackNode = ctx.createGain();
      this.echoFeedbackNode.gain.value = 0;

      this.echoWetNode = ctx.createGain();
      this.echoWetNode.gain.value = 0;

      // Disconnect previous connections if any
      try {
        this.sourceNode.disconnect();
      } catch (e) {}

      // Routing: Source -> Preamp -> Filter 0 -> ... -> Filter 6
      this.sourceNode.connect(this.preampNode);
      let lastNode = this.preampNode;

      for (const filter of this.filters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      // lastNode is the output of the EQ filter chain.
      // Branch 1: Dry Path
      lastNode.connect(this.dryGainNode);
      this.dryGainNode.connect(this.masterGainNode);

      // Branch 2: Delay Path
      lastNode.connect(this.delayNode);
      this.delayNode.connect(this.delayFilterNode);
      this.delayFilterNode.connect(this.delayFeedbackNode);
      this.delayFeedbackNode.connect(this.delayNode); // feedback loop
      this.delayFilterNode.connect(this.delayWetNode);
      this.delayWetNode.connect(this.masterGainNode);

      // Branch 3: Echo Path
      lastNode.connect(this.echoDelayNode);
      this.echoDelayNode.connect(this.echoFeedbackNode);
      this.echoFeedbackNode.connect(this.echoDelayNode); // feedback loop
      this.echoDelayNode.connect(this.echoWetNode);
      this.echoWetNode.connect(this.masterGainNode);

      // Master output -> Analyser -> Destination
      this.masterGainNode.connect(this.analyserNode);
      this.analyserNode.connect(ctx.destination);

      this.connectedElement = audioElement;
      this.applySettings(settings);
    } catch (err) {
      console.warn('Web Audio API equalizer & FX initialization warning:', err);
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  detach() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    this.connectedElement = null;
  }

  applySettings({
    bands = [0, 0, 0, 0, 0, 0, 0],
    preamp = 0,
    enabled = true,
    delay = {},
    echo = {}
  } = {}) {
    if (!this.audioCtx || !this.filters.length) return;

    const now = this.audioCtx.currentTime;

    // 1. Preamp level in linear scale: 10^(dB / 20)
    if (this.preampNode) {
      const targetPreampGain = enabled ? Math.pow(10, (preamp || 0) / 20) : 1.0;
      this.preampNode.gain.cancelScheduledValues(now);
      this.preampNode.gain.linearRampToValueAtTime(targetPreampGain, now + 0.04);
    }

    // 2. Apply frequency band gains
    this.filters.forEach((filter, index) => {
      const targetGain = enabled ? (bands[index] || 0) : 0;
      filter.gain.cancelScheduledValues(now);
      filter.gain.linearRampToValueAtTime(targetGain, now + 0.04);
    });

    // 3. Apply Studio Delay FX
    if (this.delayNode && this.delayFeedbackNode && this.delayWetNode) {
      const isDelayOn = enabled && !!delay.enabled;
      const dTime = Math.max(0.05, Math.min(1.0, delay.time ?? 0.25));
      const dFeedback = isDelayOn ? Math.max(0, Math.min(0.85, delay.feedback ?? 0.35)) : 0;
      const dWet = isDelayOn ? Math.max(0, Math.min(0.7, delay.wet ?? 0.3)) : 0;

      this.delayNode.delayTime.cancelScheduledValues(now);
      this.delayNode.delayTime.linearRampToValueAtTime(dTime, now + 0.04);

      this.delayFeedbackNode.gain.cancelScheduledValues(now);
      this.delayFeedbackNode.gain.linearRampToValueAtTime(dFeedback, now + 0.04);

      this.delayWetNode.gain.cancelScheduledValues(now);
      this.delayWetNode.gain.linearRampToValueAtTime(dWet, now + 0.04);
    }

    // 4. Apply Studio Echo FX
    if (this.echoDelayNode && this.echoFeedbackNode && this.echoWetNode) {
      const isEchoOn = enabled && !!echo.enabled;
      const eTime = Math.max(0.08, Math.min(0.6, echo.time ?? 0.18));
      const eFeedback = isEchoOn ? Math.max(0, Math.min(0.75, echo.feedback ?? 0.4)) : 0;
      const eWet = isEchoOn ? Math.max(0, Math.min(0.7, echo.wet ?? 0.25)) : 0;

      this.echoDelayNode.delayTime.cancelScheduledValues(now);
      this.echoDelayNode.delayTime.linearRampToValueAtTime(eTime, now + 0.04);

      this.echoFeedbackNode.gain.cancelScheduledValues(now);
      this.echoFeedbackNode.gain.linearRampToValueAtTime(eFeedback, now + 0.04);

      this.echoWetNode.gain.cancelScheduledValues(now);
      this.echoWetNode.gain.linearRampToValueAtTime(eWet, now + 0.04);
    }
  }

  getFrequencyData(outputArray) {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(outputArray);
    }
  }

  getMetrics() {
    if (!this.audioCtx) return { latency: '4.80', sampleRate: '48.0' };
    const lat = (this.audioCtx.baseLatency || 0.0051) * 1000;
    const sr = (this.audioCtx.sampleRate || 48000) / 1000;
    return {
      latency: lat.toFixed(2),
      sampleRate: sr.toFixed(1)
    };
  }

  fadeOut(durationMs = 3000) {
    if (!this.masterGainNode || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(this.masterGainNode.gain.value, now);
    this.masterGainNode.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
  }

  fadeIn(durationMs = 500) {
    if (!this.masterGainNode || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(0, now);
    this.masterGainNode.gain.linearRampToValueAtTime(1.0, now + durationMs / 1000);
  }
}

export const equalizerEngine = new AudioEqualizerEngine();
