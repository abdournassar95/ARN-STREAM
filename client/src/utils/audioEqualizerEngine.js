import { EQ_BANDS, useEqualizerStore, selectEngineSettings } from '../store/useEqualizerStore';

/**
 * محرك المعادل الصوتي الموحد لمنصة ARN Stream.
 *
 * سياق صوتي واحد (AudioContext) وسلسلة معالجة مشتركة تخدم كافة المشغلات:
 *   مشغل الموسيقى (<audio>) + مشغل الفيديو (<video>) + البث التليفزيوني والراديو (<video>).
 *
 * التوجيه لكل عنصر وسائط:
 *   Source -> [عقد إضافية خاصة بالمشغل] -> ElementGain (تضخيم/تلاشي) -> سلسلة المعادل المشتركة
 *
 * السلسلة المشتركة:
 *   Preamp -> 10 EQ Filters -> (Dry + Delay + Echo) -> Master -> Analyser -> Destination
 */
class AudioEqualizerEngine {
  constructor() {
    this.audioCtx = null;
    this.preampNode = null;
    this.filters = [];
    this.analyserNode = null;

    // العنصر الأساسي (مشغل الموسيقى) المستخدم في عمليات التلاشي (Crossfade)
    this.connectedElement = null;

    // خريطة العناصر المتصلة: element -> { source, gain, inserts }
    this.routes = new Map();

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

    this._lastSettings = null;
    this._unsubscribeStore = null;
    this._gestureResumeBound = false;
  }

  initContext() {
    if (this.audioCtx && this.audioCtx.state === 'closed') {
      // لا ينبغي أن يحدث، لكن نعيد البناء بأمان إن أُغلق السياق
      this.audioCtx = null;
      this.routes.clear();
      this.connectedElement = null;
      this.filters = [];
    }
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      try {
        this.audioCtx = new AudioContextClass();
        this._buildSharedChain();
        this._bindStore();
        this._bindGestureResume();
      } catch (err) {
        console.warn('Web Audio API equalizer initialization warning:', err);
        this.audioCtx = null;
        return null;
      }
    }
    return this.audioCtx;
  }

  _buildSharedChain() {
    const ctx = this.audioCtx;

    // 1. Preamp gain node
    this.preampNode = ctx.createGain();

    // 2. Analyser for live visualizer
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // 3. EQ band filters
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

    // Routing: Preamp -> Filter 0 -> ... -> Filter N
    let lastNode = this.preampNode;
    for (const filter of this.filters) {
      lastNode.connect(filter);
      lastNode = filter;
    }

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

    this.applySettings(this._lastSettings || selectEngineSettings(useEqualizerStore.getState()));
  }

  // مزامنة تلقائية مع مخزن المعادل: أي تغيير في الإعدادات يُطبّق فوراً على كل المشغلات
  _bindStore() {
    if (this._unsubscribeStore) return;
    this._unsubscribeStore = useEqualizerStore.subscribe((state) => {
      this.applySettings(selectEngineSettings(state));
    });
  }

  // استئناف السياق الصوتي عند أول تفاعل من المستخدم (سياسة التشغيل التلقائي في المتصفح)
  _bindGestureResume() {
    if (this._gestureResumeBound || typeof window === 'undefined') return;
    this._gestureResumeBound = true;
    const onGesture = () => this.resume();
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onGesture, { capture: true, passive: true });
  }

  /**
   * ربط عنصر وسائط بالمعادل.
   * @param {HTMLMediaElement} element
   * @param {object} [settings] إعدادات اختيارية تُطبّق فوراً (للتوافق مع مشغل الموسيقى)
   * @param {object} [options]
   * @param {AudioNode[]} [options.insertNodes] عقد خاصة بالمشغل تُدرج قبل المعادل (أنشئها عبر initContext())
   * @param {boolean} [options.primary=true] هل هذا العنصر هو المشغل الأساسي لعمليات التلاشي
   * @returns {{source: MediaElementAudioSourceNode, gain: GainNode, inserts: AudioNode[]} | null}
   */
  attach(element, settings, options = {}) {
    if (!element) return null;
    const ctx = this.initContext();
    if (!ctx) return null;

    if (settings && typeof settings === 'object' && Object.keys(settings).length > 0) {
      this.applySettings(settings);
    }

    const existing = this.routes.get(element);
    if (existing) {
      if (options.primary !== false) this.connectedElement = element;
      return existing;
    }

    try {
      // لا يمكن إنشاء أكثر من مصدر واحد لنفس العنصر
      if (!element._arnEqSource) {
        element._arnEqSource = ctx.createMediaElementSource(element);
      }
      const source = element._arnEqSource;
      try { source.disconnect(); } catch {}

      const gain = ctx.createGain();
      gain.gain.value = 1.0;

      const inserts = Array.isArray(options.insertNodes) ? options.insertNodes.filter(Boolean) : [];
      let last = source;
      for (const node of inserts) {
        last.connect(node);
        last = node;
      }
      last.connect(gain);
      gain.connect(this.preampNode);

      const route = { source, gain, inserts };
      this.routes.set(element, route);
      if (options.primary !== false) this.connectedElement = element;
      return route;
    } catch (err) {
      console.warn('Web Audio API equalizer attach warning:', err);
      return null;
    }
  }

  isAttached(element) {
    return !!element && this.routes.has(element);
  }

  getRoute(element) {
    return element ? this.routes.get(element) || null : null;
  }

  // فصل عنصر عن المعادل (يُستدعى عند إزالة المشغل من الواجهة)
  detach(element = this.connectedElement) {
    if (!element) return;
    const route = this.routes.get(element);
    if (route) {
      try { route.source.disconnect(); } catch {}
      for (const node of route.inserts) {
        try { node.disconnect(); } catch {}
      }
      try { route.gain.disconnect(); } catch {}
      this.routes.delete(element);
    }
    if (this.connectedElement === element) {
      this.connectedElement = null;
    }
  }

  // ضبط كسب العنصر (مثلاً تضخيم الصوت حتى 200% في البث المباشر)
  setElementGain(element, value) {
    const route = this.getRoute(element);
    if (!route || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    route.gain.gain.cancelScheduledValues(now);
    route.gain.gain.setTargetAtTime(Math.max(0, value), now, 0.02);
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  applySettings({
    bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp = 0,
    enabled = true,
    delay = {},
    echo = {}
  } = {}) {
    this._lastSettings = { bands, preamp, enabled, delay, echo };
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

  getTimeDomainData(outputArray) {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(outputArray);
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

  // عقدة التلاشي: كسب العنصر الأساسي (الموسيقى) حتى لا يتأثر الفيديو أو البث المباشر
  _fadeTarget(element) {
    const route = this.getRoute(element || this.connectedElement);
    return route ? route.gain : null;
  }

  fadeOut(durationMs = 3000, element) {
    const node = this._fadeTarget(element);
    if (!node || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
  }

  fadeIn(durationMs = 500, element) {
    const node = this._fadeTarget(element);
    if (!node || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(0, now);
    node.gain.linearRampToValueAtTime(1.0, now + durationMs / 1000);
  }
}

export const equalizerEngine = new AudioEqualizerEngine();
