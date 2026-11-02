import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
import { Play, Pause, Radio, Sliders, Palette, Check, Sparkles, ChevronDown } from 'lucide-react';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';
import { useSettingsStore } from '../../store/useSettingsStore';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * سيمات وأنماط العرض الخاصة بمشغل الراديو (المطابقة للصور المرفقة):
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const VISUALIZER_THEMES = [
  {
    id: 'neon-waveform',
    nameAr: 'الشريحة الموجية النيون المتوهجة (صورة 1)',
    nameEn: 'Neon Harmonic Waveform',
    descAr: 'أمواج جيبية نيون متعددة الطبقات بألوان الطيف مع جزيئات مضيئة',
    type: 'waveform', // نمط الأمواج المتوهجة كالصورة 1
    accent: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.55)',
    colors: ['#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#10b981'],
    bgColors: ['rgba(6, 182, 212, 0.75)', 'rgba(168, 85, 247, 0.65)', 'rgba(236, 72, 153, 0.55)']
  },
  {
    id: 'wireframe-mountain',
    nameAr: 'تموجات الجبال السلكية المتراكبة (صورة 2)',
    nameEn: 'Wireframe Contour Peaks',
    descAr: 'خطوط هارمونية متحدة المركز ترسم تضاريس صوتية متدرجة ثلاثية الأبعاد',
    type: 'wireframe', // نمط الخطوط المتراكبة كأعلى الصورة 2
    accent: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.55)',
    colors: ['#f43f5e', '#a855f7', '#3b82f6', '#06b6d4'],
    bgColors: ['rgba(244, 63, 94, 0.75)', 'rgba(168, 85, 247, 0.65)', 'rgba(6, 182, 212, 0.45)']
  },
  {
    id: 'dynamic-bars',
    nameAr: 'أعمدة الطيف الاستوديو المتدرجة (صورة 2)',
    nameEn: 'Dynamic Studio Spectrum Bars',
    descAr: 'أعمدة كبسولية فائقة الحيوية والتباين تتبع نغمات الصوت دون ثبات أو قص',
    type: 'bars', // نمط الأعمدة المتدرجة كوسط الصورة 2
    accent: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.55)',
    colors: ['#a855f7', '#f97316', '#facc15', '#06b6d4'],
    bgColors: ['rgba(168, 85, 247, 0.75)', 'rgba(249, 115, 22, 0.65)', 'rgba(6, 182, 212, 0.45)']
  },
  {
    id: 'dna-helix',
    nameAr: 'الموجات المتداخلة المتوهجة (DNA Wave)',
    nameEn: 'Double-Helix Audio Wave',
    descAr: 'موجتان جيبيتان متداخلتان ومجدولتان بألوان الطيف تدوران مع الصوت',
    type: 'dna', // نمط الموجات المتداخلة كالقسم الثالث بالصورة 2
    accent: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.55)',
    colors: ['#f43f5e', '#eab308', '#22c55e', '#06b6d4', '#a855f7'],
    bgColors: ['rgba(236, 72, 153, 0.75)', 'rgba(59, 130, 246, 0.65)', 'rgba(34, 197, 94, 0.45)']
  },
  {
    id: 'silk-aurora',
    nameAr: 'أشرطة الحرير الانسيابية (صورة 2)',
    nameEn: 'Silk Aurora Waveform',
    descAr: 'أشرطة حريرية متموجة تتهادى بنعومة فائقة كالشفق القطبي مع الصوت',
    type: 'silk', // نمط أشرطة الحرير كالجزء السفلي بالصورة 2
    accent: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.55)',
    colors: ['#10b981', '#06b6d4', '#6366f1', '#ec4899'],
    bgColors: ['rgba(16, 185, 129, 0.75)', 'rgba(6, 182, 212, 0.65)', 'rgba(236, 72, 153, 0.45)']
  },
  {
    id: 'mirror-pulse',
    nameAr: 'الموجة المتناظرة المنعكسة (Mirror Pulse)',
    nameEn: 'Symmetrical Dual Ripple',
    descAr: 'أعمدة كبسولية تنبثق بالتناظر من المنتصف للأعلى والأسفل بحساسية متوازنة',
    type: 'mirror',
    accent: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.55)',
    colors: ['#f3e8ff', '#c084fc', '#a855f7', '#7c3aed'],
    bgColors: ['rgba(192, 132, 252, 0.75)', 'rgba(124, 58, 237, 0.65)', 'rgba(56, 189, 248, 0.45)']
  }
];

export const RadioStudioVisualizer = memo(function RadioStudioVisualizer({
  channel,
  isPlaying,
  volume = 100,
  togglePlayPause,
  onOpenEqualizer,
  eqEnabled,
  eqPreset
}) {
  const theme = useSettingsStore(s => s.theme);
  const isDark = theme !== 'light';

  const bgCanvasRef = useRef(null);
  const pillCanvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // السيم النشط مع الحفظ التلقائي في LocalStorage
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('arn_radio_vis_theme_v2') || 'neon-waveform';
    } catch {
      return 'neon-waveform';
    }
  });

  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [bassEnergy, setBassEnergy] = useState(0);
  const [eqBars, setEqBars] = useState([30, 70, 100, 40, 100, 60, 20]);

  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  const activeTheme = useMemo(() => {
    return VISUALIZER_THEMES.find((t) => t.id === themeId) || VISUALIZER_THEMES[0];
  }, [themeId]);

  const activeThemeRef = useRef(activeTheme);
  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);

  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const handleSelectTheme = (newThemeId) => {
    setThemeId(newThemeId);
    try {
      localStorage.setItem('arn_radio_vis_theme_v2', newThemeId);
    } catch {}
    setShowThemeMenu(false);
  };

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const pillCanvas = pillCanvasRef.current;
    if (!bgCanvas || !pillCanvas) return;

    const bgCtx = bgCanvas.getContext('2d', { alpha: true });
    const pillCtx = pillCanvas.getContext('2d', { alpha: true });
    if (!bgCtx || !pillCtx) return;

    const resizeCanvases = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (bgCanvas.parentElement) {
        bgCanvas.width = bgCanvas.parentElement.clientWidth * dpr;
        bgCanvas.height = bgCanvas.parentElement.clientHeight * dpr;
      }
      if (pillCanvas.parentElement) {
        pillCanvas.width = pillCanvas.parentElement.clientWidth * dpr;
        pillCanvas.height = pillCanvas.parentElement.clientHeight * dpr;
      }
    };
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    // سعة تخزين البيانات الترددية والزمنية
    const FFT_SIZE = 128;
    const freqData = new Uint8Array(FFT_SIZE);
    const timeData = new Uint8Array(FFT_SIZE);

    // ذاكرة الأعمدة ونعومة الحركة
    const BARS_COUNT = 34;
    const smoothedBars = new Float32Array(BARS_COUNT);
    const barPeaks = new Float32Array(BARS_COUNT);

    // ذاكرة أمواج الخلفية
    const BG_POINTS = 48;
    const smoothedBg = new Float32Array(BG_POINTS);

    // جزيئات مضيئة متطايرة للشريحة الموجية (الصورة 1)
    const PARTICLE_COUNT = 24;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: 0.5,
      vx: (Math.random() - 0.5) * 0.002,
      vy: -0.003 - Math.random() * 0.004,
      size: 1 + Math.random() * 2,
      alpha: Math.random()
    }));

    let phase = 0;
    let lastBassUpdate = 0;

    const render = (time) => {
      animFrameRef.current = requestAnimationFrame(render);
      phase += 0.045;

      const currentTheme = activeThemeRef.current;
      const currentVol = volumeRef.current ?? 100;
      // معامل تدرج الصوت الطبيعي مع حماية عند كتم الصوت
      const volMultiplier = currentVol <= 0 ? 0 : Math.max(0.12, Math.min(1.2, currentVol / 100));

      // قراءة الترددات الفعلية والبيانات الزمنية
      let hasRealAudio = false;
      let totalFreqSum = 0;
      let timeDevSum = 0;
      let bassSum = 0;

      try {
        equalizerEngine.getFrequencyData(freqData);
        equalizerEngine.getTimeDomainData(timeData);

        for (let i = 0; i < 48; i++) {
          const f = freqData[i] || 0;
          totalFreqSum += f;
          if (i < 8) bassSum += f;
        }

        // قياس التذبذب الحقيقي حول خط الصفر (128)
        for (let i = 0; i < 64; i++) {
          const t = timeData[i] || 128;
          timeDevSum += Math.abs(t - 128);
        }

        if (timeDevSum > 35 && isPlaying && currentVol > 0) {
          hasRealAudio = true;
        }
      } catch (e) {
        hasRealAudio = false;
      }

      // حساب طاقة البيز الديناميكية للهالة الخلفية دون أن تتجمد
      const currentBass = hasRealAudio
        ? Math.min(1, (bassSum / (8 * 160)) * volMultiplier)
        : isPlaying
        ? (Math.sin(phase * 1.5) + 1) * 0.15
        : 0;

      if (time - lastBassUpdate > 65) {
        setBassEnergy(currentBass);

        // تحديث أشرطة الترددات السبعة الحية اللحظية (Audio-Reactive Equalizer Bars)
        if (hasRealAudio) {
          const b1 = Math.min(100, Math.max(18, ((freqData[1] || 0) / 220) * 100 * volMultiplier));
          const b2 = Math.min(100, Math.max(22, ((freqData[3] || 0) / 220) * 100 * volMultiplier));
          const b3 = Math.min(100, Math.max(25, ((freqData[6] || 0) / 220) * 100 * volMultiplier));
          const b4 = Math.min(100, Math.max(20, ((freqData[10] || 0) / 220) * 100 * volMultiplier));
          const b5 = Math.min(100, Math.max(25, ((freqData[16] || 0) / 220) * 100 * volMultiplier));
          const b6 = Math.min(100, Math.max(22, ((freqData[24] || 0) / 220) * 100 * volMultiplier));
          const b7 = Math.min(100, Math.max(18, ((freqData[34] || 0) / 220) * 100 * volMultiplier));
          setEqBars([b1, b2, b3, b4, b5, b6, b7]);
        } else if (isPlaying) {
          const p = phase;
          setEqBars([
            Math.max(18, 25 + Math.sin(p + 0.2) * 15),
            Math.max(25, 55 + Math.cos(p + 0.6) * 20),
            Math.max(30, 80 + Math.sin(p + 1.2) * 15),
            Math.max(20, 40 + Math.cos(p + 1.8) * 15),
            Math.max(30, 80 + Math.sin(p + 2.4) * 15),
            Math.max(25, 55 + Math.cos(p + 3.0) * 20),
            Math.max(18, 25 + Math.sin(p + 3.6) * 15)
          ]);
        } else {
          setEqBars([18, 28, 38, 22, 38, 28, 18]);
        }

        lastBassUpdate = time;
      }

      // ─────────────────────────────────────────────────────────────────────
      // 1. رسم الخلفية الضبابية الحية المتحركة (Audio-Reactive Flowing Background)
      // ─────────────────────────────────────────────────────────────────────
      const bgW = bgCanvas.width;
      const bgH = bgCanvas.height;
      bgCtx.clearRect(0, 0, bgW, bgH);

      const isDarkCur = isDarkRef.current;
      const fadeStop = isDarkCur ? 'rgba(7, 11, 20, 0)' : 'rgba(248, 250, 252, 0)';

      if (bgW > 0 && bgH > 0) {
        const centerX = bgW / 2;
        const centerY = bgH * 0.44;
        const glowRadius = Math.max(140, Math.min(bgW, bgH) * (0.35 + currentBass * 0.28));

        // هالة متغيرة ومتنفسة حسب سيم العرض
        const radialGrad = bgCtx.createRadialGradient(
          centerX,
          centerY,
          10,
          centerX,
          centerY,
          glowRadius
        );
        radialGrad.addColorStop(0, currentTheme.bgColors[0].replace(/[\d.]+\)$/, `${0.32 + currentBass * 0.35})`));
        radialGrad.addColorStop(0.5, currentTheme.bgColors[1].replace(/[\d.]+\)$/, `${0.18 + currentBass * 0.2})`));
        radialGrad.addColorStop(0.8, currentTheme.bgColors[2].replace(/[\d.]+\)$/, `${0.06 + currentBass * 0.1})`));
        radialGrad.addColorStop(1, fadeStop);

        bgCtx.fillStyle = radialGrad;
        bgCtx.beginPath();
        bgCtx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        bgCtx.fill();

        // رسم أمواج هارمونية سائلة ضبابية تتراقص في الخلفية بأكملها (متحركة وحية دائماً)
        const bgBaseY = bgH * 0.75;
        const waveLayers = 3;

        for (let l = 0; l < waveLayers; l++) {
          bgCtx.beginPath();
          bgCtx.moveTo(0, bgH);

          const layerPhase = phase * (0.8 + l * 0.4) + l * 1.6;
          const layerAlpha = 0.25 - l * 0.06;

          for (let i = 0; i <= BG_POINTS; i++) {
            const x = (i / BG_POINTS) * bgW;

            let audioVal = 0;
            if (hasRealAudio) {
              const bin = Math.min(freqData.length - 1, Math.floor((i / BG_POINTS) * 40) + 1);
              // كسب مدروس يمنع التجمد أو الانغلاق عند 100%
              audioVal = Math.min(0.85, ((freqData[bin] || 0) / 240) * volMultiplier);
            } else if (isPlaying) {
              audioVal = (Math.sin(layerPhase + i * 0.25) + 1) * 0.18;
            }

            // سلاسة حركة الخلفية
            smoothedBg[i] = smoothedBg[i] * 0.85 + audioVal * 0.15;

            const waveAmp = (bgH * 0.22) * (smoothedBg[i] + 0.1);
            const y = bgBaseY - Math.sin(layerPhase + i * 0.28) * waveAmp - l * 25;

            if (i === 0) bgCtx.lineTo(x, y);
            else bgCtx.lineTo(x, y);
          }

          bgCtx.lineTo(bgW, bgH);
          bgCtx.closePath();

          const waveGrad = bgCtx.createLinearGradient(0, bgBaseY - bgH * 0.3, 0, bgH);
          waveGrad.addColorStop(0, currentTheme.bgColors[l % currentTheme.bgColors.length].replace(/[\d.]+\)$/, `${layerAlpha})`));
          waveGrad.addColorStop(1, fadeStop);

          bgCtx.fillStyle = waveGrad;
          bgCtx.fill();
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 2. رسم الكبسولة والموجات الصوتية الدقيقة (المطابقة للصور المرفقة)
      // ─────────────────────────────────────────────────────────────────────
      const pillW = pillCanvas.width;
      const pillH = pillCanvas.height;
      pillCtx.clearRect(0, 0, pillW, pillH);

      if (pillW > 0 && pillH > 0) {
        const sidePadding = pillW * 0.04;
        const availableW = pillW - sidePadding * 2;
        const centerY = pillH * 0.5;

        // ═════════════════════════════════════════════════════════════════════
        // النمط 1: الشريحة الموجية النيون المتوهجة (صورة 1 - Continuous Waveform)
        // ═════════════════════════════════════════════════════════════════════
        if (currentTheme.type === 'waveform') {
          const numStrands = 5;
          const maxWaveH = pillH * 0.42;

          // رسم الخط المرجعي المضيء بالمنتصف
          pillCtx.save();
          pillCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          pillCtx.lineWidth = 1;
          pillCtx.beginPath();
          pillCtx.moveTo(sidePadding, centerY);
          pillCtx.lineTo(pillW - sidePadding, centerY);
          pillCtx.stroke();
          pillCtx.restore();

          for (let s = 0; s < numStrands; s++) {
            pillCtx.save();
            const strandPhase = phase * (1.2 + s * 0.3) + s * 1.2;
            const strandAlpha = 0.95 - s * 0.15;
            const strandWidth = Math.max(1.5, 3.5 - s * 0.5);

            // تدرج لوني مطابق للصورة 1 (Cyan -> Blue -> Violet -> Magenta -> Orange -> Green)
            const strandGrad = pillCtx.createLinearGradient(sidePadding, 0, pillW - sidePadding, 0);
            strandGrad.addColorStop(0.0, '#06b6d4'); // Cyan
            strandGrad.addColorStop(0.2, '#3b82f6'); // Blue
            strandGrad.addColorStop(0.45, '#a855f7'); // Violet
            strandGrad.addColorStop(0.65, '#ec4899'); // Magenta
            strandGrad.addColorStop(0.85, '#f97316'); // Orange
            strandGrad.addColorStop(1.0, '#10b981'); // Green

            pillCtx.strokeStyle = strandGrad;
            pillCtx.lineWidth = strandWidth;
            pillCtx.shadowColor = s === 0 ? '#a855f7' : '#06b6d4';
            pillCtx.shadowBlur = s === 0 ? 12 : 6;
            pillCtx.globalAlpha = strandAlpha;

            pillCtx.beginPath();
            const steps = 60;

            for (let i = 0; i <= steps; i++) {
              const normX = i / steps;
              const x = sidePadding + normX * availableW;

              // نافذة انسيابية (Tapered Envelope) لجعل الأطراف تلتقي بنعومة في المنتصف
              const envelope = Math.sin(normX * Math.PI);

              let amp = 0;
              if (hasRealAudio) {
                // استخدام البيانات الزمنية الفعلية (Time Domain) المحاكية للصورة 1 تماماً
                const timeIdx = Math.min(timeData.length - 1, Math.floor(normX * 64));
                const rawDev = (timeData[timeIdx] - 128) / 128; // يتراوح بين -1 و +1

                // ترددات الميد والبيز لإعطاء تنوع تموجي
                const freqIdx = Math.min(freqData.length - 1, Math.floor(normX * 36) + 1);
                const freqWeight = ((freqData[freqIdx] || 0) / 255) * 0.5;

                // تحويل ناعم يتناسب مع مستوى الصوت دون أي قص عند 100%
                amp = (rawDev * 0.75 + Math.sin(strandPhase + normX * 12) * freqWeight) * volMultiplier;
              } else if (isPlaying) {
                // تموجات هادئة عند سكون الصوت
                amp = Math.sin(strandPhase + normX * (8 + s * 2)) * 0.22;
              }

              // تقييد الارتفاع ليبقى دائماً داخل الكبسولة وبمظهر انسيابي فائق
              const clampedAmp = Math.max(-0.95, Math.min(0.95, amp));
              const y = centerY + clampedAmp * maxWaveH * envelope;

              if (i === 0) pillCtx.moveTo(x, y);
              else pillCtx.lineTo(x, y);
            }
            pillCtx.stroke();
            pillCtx.restore();
          }

          // رسم الجزيئات المضيئة المتطايرة (Floating Audio Sparkles) كالصورة 1
          if (isPlaying) {
            pillCtx.save();
            particles.forEach((p) => {
              p.x += p.vx;
              if (p.x < 0) p.x = 1;
              if (p.x > 1) p.x = 0;

              // ربط حركة الجزيئات بنشاط الصوت
              const devOffset = hasRealAudio ? (Math.sin(phase * 4 + p.x * 20) * 0.35) * maxWaveH : 0;
              const px = sidePadding + p.x * availableW;
              const py = centerY + devOffset + Math.sin(phase * 2 + p.x * 10) * 12;

              pillCtx.fillStyle = '#ffffff';
              pillCtx.shadowColor = '#38bdf8';
              pillCtx.shadowBlur = 8;
              pillCtx.globalAlpha = 0.4 + currentBass * 0.5;
              pillCtx.beginPath();
              pillCtx.arc(px, py, p.size, 0, Math.PI * 2);
              pillCtx.fill();
            });
            pillCtx.restore();
          }

        // ═════════════════════════════════════════════════════════════════════
        // النمط 2: تموجات الجبال السلكية المتراكبة (صورة 2 علوي - Wireframe Peaks)
        // ═════════════════════════════════════════════════════════════════════
        } else if (currentTheme.type === 'wireframe') {
          const numTiers = 7;
          const maxH = pillH * 0.44;

          for (let t = 0; t < numTiers; t++) {
            pillCtx.save();
            const tierRatio = (t + 1) / numTiers;
            const tierGrad = pillCtx.createLinearGradient(sidePadding, 0, pillW - sidePadding, 0);
            tierGrad.addColorStop(0, '#f43f5e');
            tierGrad.addColorStop(0.35, '#a855f7');
            tierGrad.addColorStop(0.7, '#3b82f6');
            tierGrad.addColorStop(1, '#06b6d4');

            pillCtx.strokeStyle = tierGrad;
            pillCtx.lineWidth = 1.2;
            pillCtx.globalAlpha = 0.4 + tierRatio * 0.6;
            pillCtx.shadowColor = currentTheme.glowColor;
            pillCtx.shadowBlur = 4;

            pillCtx.beginPath();
            const steps = 44;

            for (let i = 0; i <= steps; i++) {
              const normX = i / steps;
              const x = sidePadding + normX * availableW;
              const envelope = Math.sin(normX * Math.PI);

              let val = 0;
              if (hasRealAudio) {
                const bin = Math.min(freqData.length - 1, Math.floor(normX * 42) + 1);
                val = ((freqData[bin] || 0) / 240) * volMultiplier;
              } else if (isPlaying) {
                val = (Math.sin(phase * 2 + normX * 10) + 1) * 0.2;
              }

              // رسم قمم الجبال المتدرجة السلكية
              const peakY = centerY - val * maxH * tierRatio * envelope * (1 + Math.sin(normX * 14 + t * 0.5) * 0.3);
              if (i === 0) pillCtx.moveTo(x, peakY);
              else pillCtx.lineTo(x, peakY);
            }
            pillCtx.stroke();
            pillCtx.restore();
          }

        // ═════════════════════════════════════════════════════════════════════
        // النمط 3: أعمدة الطيف الاستوديو المتدرجة (صورة 2 وسط - Dynamic Spectrum Bars)
        // ═════════════════════════════════════════════════════════════════════
        } else if (currentTheme.type === 'bars') {
          const barSlot = availableW / BARS_COUNT;
          const barW = Math.max(3.2, barSlot * 0.55);
          const maxBarH = pillH * 0.82;
          const baselineY = pillH * 0.92;

          for (let i = 0; i < BARS_COUNT; i++) {
            let target = 0;
            if (hasRealAudio) {
              const normX = i / BARS_COUNT;
              const envelope = Math.sin(normX * Math.PI) * 0.4 + 0.6;
              const binIdx = Math.min(freqData.length - 1, Math.floor(1 + Math.pow(normX, 1.1) * 44));
              const rawByte = freqData[binIdx] || 0;

              // معادلة الحساسية المتوازنة: لا تصل للقص أبداً وتتفاعل بمرونة هائلة
              const cleanVal = Math.max(0, rawByte - 8);
              target = Math.min(0.9, (cleanVal / 220) * (0.35 + volMultiplier * 0.65) * envelope);
            } else if (isPlaying) {
              const s1 = Math.sin(phase * 2.2 + i * 0.32);
              target = Math.max(0.1, (s1 + 1) * 0.18);
            } else {
              target = 0.05;
            }

            // حركة انسيابية طبيعية جداً
            if (target > smoothedBars[i]) {
              smoothedBars[i] = smoothedBars[i] * 0.65 + target * 0.35;
            } else {
              smoothedBars[i] = smoothedBars[i] * 0.86 + target * 0.14;
            }

            const currentH = Math.max(5, smoothedBars[i] * maxBarH);

            if (currentH >= barPeaks[i]) {
              barPeaks[i] = currentH;
            } else {
              barPeaks[i] = Math.max(5, barPeaks[i] - 0.7);
            }

            const barX = sidePadding + i * barSlot + (barSlot - barW) / 2;
            const barY = baselineY - currentH;
            const barRadius = barW / 2;

            // تدرج طيف كامل كالصورة 2 (Purple -> Amber -> Cyan)
            const normPos = i / BARS_COUNT;
            const barGrad = pillCtx.createLinearGradient(0, barY, 0, baselineY);
            if (normPos < 0.35) {
              barGrad.addColorStop(0, '#e879f9');
              barGrad.addColorStop(1, '#a855f7');
            } else if (normPos < 0.75) {
              barGrad.addColorStop(0, '#fde047');
              barGrad.addColorStop(1, '#f97316');
            } else {
              barGrad.addColorStop(0, '#67e8f9');
              barGrad.addColorStop(1, '#06b6d4');
            }

            pillCtx.save();
            pillCtx.fillStyle = barGrad;
            pillCtx.shadowColor = normPos < 0.5 ? '#f97316' : '#06b6d4';
            pillCtx.shadowBlur = 6;

            pillCtx.beginPath();
            if (typeof pillCtx.roundRect === 'function') {
              pillCtx.roundRect(barX, barY, barW, currentH, [barRadius, barRadius, barRadius, barRadius]);
            } else {
              pillCtx.rect(barX, barY, barW, currentH);
            }
            pillCtx.fill();

            // قمة طافية ناصعة
            if (isPlaying && barPeaks[i] > currentH + 3) {
              const peakY = baselineY - barPeaks[i];
              pillCtx.fillStyle = '#ffffff';
              pillCtx.beginPath();
              pillCtx.arc(barX + barW / 2, peakY, Math.max(1.4, barW / 2.6), 0, Math.PI * 2);
              pillCtx.fill();
            }
            pillCtx.restore();
          }

        // ═════════════════════════════════════════════════════════════════════
        // النمط 4: الموجات المتداخلة المتوهجة (صورة 2 وسط 2 - Double Helix DNA)
        // ═════════════════════════════════════════════════════════════════════
        } else if (currentTheme.type === 'dna') {
          const maxH = pillH * 0.38;
          const strands = 2;

          for (let s = 0; s < strands; s++) {
            pillCtx.save();
            const strandSign = s === 0 ? 1 : -1;
            const helixGrad = pillCtx.createLinearGradient(sidePadding, 0, pillW - sidePadding, 0);
            helixGrad.addColorStop(0, '#f43f5e');
            helixGrad.addColorStop(0.25, '#eab308');
            helixGrad.addColorStop(0.5, '#22c55e');
            helixGrad.addColorStop(0.75, '#06b6d4');
            helixGrad.addColorStop(1, '#a855f7');

            pillCtx.strokeStyle = helixGrad;
            pillCtx.lineWidth = 2.5;
            pillCtx.shadowColor = s === 0 ? '#ec4899' : '#06b6d4';
            pillCtx.shadowBlur = 8;

            pillCtx.beginPath();
            const steps = 50;

            for (let i = 0; i <= steps; i++) {
              const normX = i / steps;
              const x = sidePadding + normX * availableW;
              const envelope = Math.sin(normX * Math.PI);

              let val = 0;
              if (hasRealAudio) {
                const bin = Math.min(freqData.length - 1, Math.floor(normX * 40) + 1);
                val = ((freqData[bin] || 0) / 240) * volMultiplier;
              } else if (isPlaying) {
                val = (Math.sin(phase * 2 + normX * 10) + 1) * 0.22;
              }

              const twist = Math.sin(phase * 3 + normX * 14) * strandSign;
              const y = centerY + twist * maxH * envelope * (0.3 + val * 0.7);

              if (i === 0) pillCtx.moveTo(x, y);
              else pillCtx.lineTo(x, y);

              // رسم نقاط العقد المضيئة في التقاطعات
              if (i % 5 === 0 && isPlaying) {
                pillCtx.fillStyle = '#ffffff';
                pillCtx.beginPath();
                pillCtx.arc(x, y, 2.2, 0, Math.PI * 2);
                pillCtx.fill();
              }
            }
            pillCtx.stroke();
            pillCtx.restore();
          }

        // ═════════════════════════════════════════════════════════════════════
        // النمط 5: أشرطة الحرير الانسيابية للشفق القطبي (صورة 2 سفلي - Silk Ribbon)
        // ═════════════════════════════════════════════════════════════════════
        } else if (currentTheme.type === 'silk') {
          const numRibbons = 4;
          const maxH = pillH * 0.4;

          for (let r = 0; r < numRibbons; r++) {
            pillCtx.save();
            const ribbonPhase = phase * (1.1 + r * 0.25) + r * 1.4;

            const silkGrad = pillCtx.createLinearGradient(sidePadding, 0, pillW - sidePadding, 0);
            silkGrad.addColorStop(0, '#10b981');
            silkGrad.addColorStop(0.35, '#06b6d4');
            silkGrad.addColorStop(0.7, '#6366f1');
            silkGrad.addColorStop(1, '#ec4899');

            pillCtx.strokeStyle = silkGrad;
            pillCtx.lineWidth = 2.2;
            pillCtx.globalAlpha = 0.55 + r * 0.12;
            pillCtx.shadowColor = '#06b6d4';
            pillCtx.shadowBlur = 6;

            pillCtx.beginPath();
            const steps = 40;

            for (let i = 0; i <= steps; i++) {
              const normX = i / steps;
              const x = sidePadding + normX * availableW;
              const envelope = Math.sin(normX * Math.PI);

              let val = 0;
              if (hasRealAudio) {
                const bin = Math.min(freqData.length - 1, Math.floor(normX * 36) + 1);
                val = ((freqData[bin] || 0) / 240) * volMultiplier;
              } else if (isPlaying) {
                val = (Math.sin(ribbonPhase + normX * 8) + 1) * 0.2;
              }

              // أمواج حريرية ناعمة بانحناءات بيزير
              const y = centerY + Math.sin(ribbonPhase + normX * 6 + r * 0.4) * maxH * envelope * (0.3 + val * 0.7);

              if (i === 0) pillCtx.moveTo(x, y);
              else pillCtx.lineTo(x, y);
            }
            pillCtx.stroke();
            pillCtx.restore();
          }

        // ═════════════════════════════════════════════════════════════════════
        // النمط 6: الموجة المتناظرة المنعكسة (Mirror Pulse)
        // ═════════════════════════════════════════════════════════════════════
        } else {
          const barSlot = availableW / BARS_COUNT;
          const barW = Math.max(3, barSlot * 0.52);
          const maxBarH = pillH * 0.82;

          for (let i = 0; i < BARS_COUNT; i++) {
            let target = 0;
            if (hasRealAudio) {
              const normX = i / BARS_COUNT;
              const envelope = Math.sin(normX * Math.PI) * 0.45 + 0.55;
              const binIdx = Math.min(freqData.length - 1, Math.floor(1 + Math.pow(normX, 1.15) * 44));
              const rawByte = freqData[binIdx] || 0;
              const cleanVal = Math.max(0, rawByte - 8);
              target = Math.min(0.88, (cleanVal / 220) * (0.35 + volMultiplier * 0.65) * envelope);
            } else if (isPlaying) {
              target = Math.max(0.1, (Math.sin(phase * 2 + i * 0.3) + 1) * 0.18);
            } else {
              target = 0.05;
            }

            if (target > smoothedBars[i]) {
              smoothedBars[i] = smoothedBars[i] * 0.65 + target * 0.35;
            } else {
              smoothedBars[i] = smoothedBars[i] * 0.86 + target * 0.14;
            }

            const currentH = Math.max(6, smoothedBars[i] * maxBarH);
            const halfH = currentH / 2;
            const barX = sidePadding + i * barSlot + (barSlot - barW) / 2;
            const topY = centerY - halfH;
            const barRadius = barW / 2;

            const barGrad = pillCtx.createLinearGradient(0, topY, 0, centerY + halfH);
            barGrad.addColorStop(0, '#f3e8ff');
            barGrad.addColorStop(0.5, '#a855f7');
            barGrad.addColorStop(1, '#7c3aed');

            pillCtx.save();
            pillCtx.fillStyle = barGrad;
            pillCtx.shadowColor = currentTheme.glowColor;
            pillCtx.shadowBlur = 6;

            pillCtx.beginPath();
            if (typeof pillCtx.roundRect === 'function') {
              pillCtx.roundRect(barX, topY, barW, currentH, [barRadius, barRadius, barRadius, barRadius]);
            } else {
              pillCtx.rect(barX, topY, barW, currentH);
            }
            pillCtx.fill();
            pillCtx.restore();
          }
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvases);
    };
  }, [isPlaying]);

  return (
    <div className={`radio-studio-view absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-5 z-10 select-none overflow-hidden transition-colors duration-500 ${
      isDark ? 'bg-[#070b14]' : 'bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0]'
    }`}>
      {/* ستايل الأنماط الحركية لموجات النيون وتوهج الشعار */}
      <style>{`
        @keyframes emitGreen {
          0% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes emitRed {
          0% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────────
          طبقة 1: توهج خلفي مزدوج (أخضر يسار، أحمر يمين) كما في التصميم المرفق
          ───────────────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-10 sm:top-4 left-[3%] sm:left-[8%] w-56 sm:w-[440px] h-56 sm:h-[440px] rounded-full filter blur-[80px] sm:blur-[115px] transition-all duration-300"
        style={{
          background: '#00ff41',
          opacity: isDark
            ? (isPlaying ? 0.24 + bassEnergy * 0.36 : 0.10)
            : (isPlaying ? 0.09 + bassEnergy * 0.12 : 0.035),
          transform: `scale(${isPlaying ? 0.95 + bassEnergy * 0.25 : 0.9})`
        }}
      />
      <div
        className="pointer-events-none absolute -top-10 sm:top-4 right-[3%] sm:right-[8%] w-56 sm:w-[440px] h-56 sm:h-[440px] rounded-full filter blur-[80px] sm:blur-[115px] transition-all duration-300"
        style={{
          background: '#ff003c',
          opacity: isDark
            ? (isPlaying ? 0.24 + bassEnergy * 0.36 : 0.10)
            : (isPlaying ? 0.09 + bassEnergy * 0.12 : 0.035),
          transform: `scale(${isPlaying ? 0.95 + bassEnergy * 0.25 : 0.9})`
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────
          طبقة 2: انعكاس لوني هادئ لشعار التطبيق الافتراضي في الخلفية
          ───────────────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden select-none"
        style={{
          opacity: isPlaying ? (isDark ? 0.22 : 0.10) : (isDark ? 0.08 : 0.035),
          transition: 'opacity 1s ease-in-out'
        }}
      >
        <img
          src="/ARN-logo.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover filter blur-[95px] scale-150 transform transition-transform duration-1000"
        />
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDark
            ? 'bg-gradient-to-t from-[#070b14] via-[#070b14]/75 to-[#070b14]/90'
            : 'bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/75 to-[#f8fafc]/90'
        }`} />
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          طبقة 3: قماش الخلفية الضبابية التفاعلية مع الصوت (أمواج حية ومتحركة)
          ───────────────────────────────────────────────────────────────── */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none filter blur-2xl sm:blur-3xl opacity-60 sm:opacity-75 transition-opacity duration-700"
      />

      <div className={`absolute top-0 left-0 right-0 h-40 pointer-events-none transition-colors duration-300 ${
        isDark
          ? 'bg-gradient-to-b from-black/40 via-transparent to-transparent'
          : 'bg-gradient-to-b from-slate-200/40 via-transparent to-transparent'
      }`} />

      {/* ─────────────────────────────────────────────────────────────────
          طبقة 4: المحتوى التفاعلي (Pulsing Neon Radio Studio)
          ───────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4 space-y-2 sm:space-y-3">
        
        {/* حاوية الشعار النيون النابض وموجات الراديو */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 flex items-center justify-center select-none">
          {/* موجة راديو نيون خضراء (يسار) */}
          <div
            className="absolute inset-0 rounded-[25%] pointer-events-none box-border"
            style={{
              border: '3px solid #00ff41',
              boxShadow: `0 0 ${14 + bassEnergy * 24}px #00ff41, inset 0 0 ${14 + bassEnergy * 20}px #00ff41`,
              animation: isPlaying
                ? `emitGreen ${Math.max(1.5, 2.8 - bassEnergy * 1.2)}s cubic-bezier(0.1, 0.8, 0.3, 1) infinite`
                : 'none',
              opacity: isPlaying ? 0.65 + bassEnergy * 0.35 : 0
            }}
          />

          {/* موجة راديو نيون حمراء (يمين) */}
          <div
            className="absolute inset-0 rounded-[25%] pointer-events-none box-border"
            style={{
              border: '3px solid #ff003c',
              boxShadow: `0 0 ${14 + bassEnergy * 24}px #ff003c, inset 0 0 ${14 + bassEnergy * 20}px #ff003c`,
              animation: isPlaying
                ? `emitRed ${Math.max(1.5, 2.8 - bassEnergy * 1.2)}s cubic-bezier(0.1, 0.8, 0.3, 1) infinite`
                : 'none',
              animationDelay: `${Math.max(0.75, (2.8 - bassEnergy * 1.2) / 2)}s`,
              opacity: isPlaying ? 0.65 + bassEnergy * 0.35 : 0
            }}
          />

          {/* صورة الشعار (نبض ديناميكي مزدوج مربوط بالصوت) */}
          <div
            className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[25%] overflow-hidden flex items-center justify-center transition-all duration-75 cursor-pointer z-10"
            style={{
              transform: `scale(${isPlaying ? 1 + bassEnergy * 0.12 : 1}) translateY(${isPlaying ? -bassEnergy * 8 : 0}px)`,
              boxShadow: isPlaying
                ? `-${10 + bassEnergy * 28}px 0 ${20 + bassEnergy * 35}px rgba(0, 255, 65, ${0.45 + bassEnergy * 0.55}),
                   ${10 + bassEnergy * 28}px 0 ${20 + bassEnergy * 35}px rgba(255, 0, 60, ${0.45 + bassEnergy * 0.55}),
                   0 ${10 + bassEnergy * 8}px ${25 + bassEnergy * 25}px rgba(0, 0, 0, ${isDark ? 0.85 : 0.25})`
                : (isDark ? '0 10px 30px rgba(0, 0, 0, 0.8)' : '0 10px 30px rgba(0, 0, 0, 0.1)'),
              background: isDark ? '#08090c' : '#ffffff'
            }}
            onClick={() => togglePlayPause()}
            title="انقر للتشغيل / الإيقاف المؤقت"
          >
            <img
              src="/ARN-logo.png"
              alt={channel?.name || 'ARN Technology Radio'}
              className="w-full h-full object-cover rounded-[25%] transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>

        {/* أشرطة التردد السبعة + نص ON AIR */}
        <div className="flex flex-col items-center gap-1.5 select-none">
          {/* أشرطة التردد المتوهجة (أخضر 1-3، أبيض 4، أحمر 5-7) */}
          <div className="flex items-end justify-center gap-1.5 sm:gap-2 h-7 sm:h-8" title="ترددات الصوت اللحظية">
            {eqBars.map((h, i) => {
              let bg = '#00ff41';
              let shadow = '0 0 12px #00ff41';
              if (i === 3) {
                bg = '#ffffff';
                shadow = '0 0 12px #ffffff';
              } else if (i > 3) {
                bg = '#ff003c';
                shadow = '0 0 12px #ff003c';
              }
              return (
                <div
                  key={i}
                  className="w-1.5 sm:w-2 rounded-full transition-all duration-75"
                  style={{
                    height: `${h}%`,
                    background: bg,
                    boxShadow: shadow
                  }}
                />
              );
            })}
          </div>

          {/* نص ON AIR المزدوج الإضاءة */}
          <div
            className="font-bold tracking-[8px] sm:tracking-[12px] text-xs sm:text-sm select-none transition-all duration-150"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: isDark ? '#ffffff' : '#0f172a',
              textShadow: isPlaying
                ? `-2px 0 10px rgba(0, 255, 65, ${0.5 + bassEnergy * 0.5}), 2px 0 10px rgba(255, 0, 60, ${0.5 + bassEnergy * 0.5})`
                : 'none'
            }}
          >
            {isPlaying ? 'ON AIR' : 'OFF AIR'}
          </div>
        </div>

        {/* بيانات المحطة والتردد */}
        <div className="space-y-1 radio-station-meta">
          <h2 className={`radio-station-title text-lg sm:text-xl font-bold tracking-tight leading-normal drop-shadow-md ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {channel?.name || 'إذاعة مباشر'}
          </h2>
          <div className={`radio-station-sub flex items-center justify-center gap-2 text-xs ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <span className="font-semibold" style={{ color: activeTheme.accent }}>
              {channel?.groupTitle || 'راديو'}
            </span>
            <span aria-hidden="true" className={isDark ? 'text-white/30' : 'text-slate-300'}>·</span>
            <span
              className={`flex items-center gap-1.5 font-bold ${
                isPlaying ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPlaying ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span>{isPlaying ? 'بث إذاعي مباشر' : 'متوقف مؤقتاً'}</span>
            </span>
            <span aria-hidden="true" className={isDark ? 'text-white/30' : 'text-slate-300'}>·</span>
            <span className={`radio-hq-badge font-mono px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              isDark ? 'bg-white/10 text-slate-200 border-white/10' : 'bg-slate-200/90 text-slate-700 border-slate-300'
            }`}>
              HQ Studio 48kHz
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            طبقة 4: نمط الشريط والموجات مدمج في الخلفية المموهة بعرض الشاشة
            ───────────────────────────────────────────────────────────────── */}
        <div
          className="relative w-full h-28 sm:h-36 md:h-44 flex items-center justify-center my-1 select-none pointer-events-none overflow-visible"
          title="محلل الطيف الصوتي والموجات اللحظية للإذاعة"
        >
          {/* قماش رسم الموجات الصوتية المدمج في الخلفية المموهة بعرض الشاشة */}
          <canvas
            ref={pillCanvasRef}
            className="w-full h-full block"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)'
            }}
          />
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            طبقة 5: أزرار التحكم السريع (أيقونات فقط وبدون نصوص)
            ───────────────────────────────────────────────────────────────── */}
        <div className="relative flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* زر التشغيل والإيقاف المؤقت (أيقونة فقط) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل الإذاعة'}
            className={`radio-action-btn w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
              isPlaying
                ? 'bg-[#7c3aed] text-white hover:bg-[#8b5cf6] shadow-violet-600/35 ring-2 ring-violet-400/30'
                : isDark
                ? 'bg-white/10 hover:bg-white/15 text-white border border-white/15 shadow-black/40'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-slate-300/50'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ms-0.5" />
            )}
          </button>

          {/* زر تغيير السيمات والأنماط البصرية (أيقونة فقط) */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowThemeMenu((prev) => !prev);
              }}
              className={`radio-action-btn w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                isDark
                  ? 'bg-[#0f172a]/90 hover:bg-white/15 text-slate-200 border-white/15 shadow-black/40'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
              }`}
              title={`نمط الأمواج الصوتية: ${activeTheme.nameAr}`}
            >
              <Palette className="w-5 h-5" style={{ color: activeTheme.accent }} />
            </button>

            {/* قائمة السيمات المنبثقة */}
            {showThemeMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-14 left-1/2 -translate-x-1/2 w-80 sm:w-96 backdrop-blur-2xl border rounded-2xl p-2.5 shadow-2xl z-50 text-right animate-fadeIn flex flex-col gap-1.5 ${
                  isDark
                    ? 'bg-[#0b0f19]/95 border-white/20 text-slate-200'
                    : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60'
                }`}
              >
                <div className={`flex items-center justify-between px-2.5 py-1 border-b mb-1 ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>أنماط الأمواج الصوتية (6 استايلات احترافية)</span>
                  </div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>6 Styles</span>
                </div>

                {VISUALIZER_THEMES.map((theme) => {
                  const isSelected = theme.id === themeId;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectTheme(theme.id)}
                      className={`w-full p-2.5 rounded-xl text-right flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? (isDark ? 'bg-white/15 border border-white/25 shadow-md' : 'bg-violet-50 border border-violet-300 shadow-xs')
                          : (isDark ? 'hover:bg-white/5 border border-transparent text-slate-300 hover:text-white' : 'hover:bg-slate-100 border border-transparent text-slate-700 hover:text-slate-950')
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.accent})`,
                            boxShadow: `0 0 8px ${theme.accent}66`
                          }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{theme.nameAr}</span>
                          <span className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{theme.descAr}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* زر المعادل الصوتي الاستوديو (أيقونة فقط) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEqualizer?.();
            }}
            className={`radio-action-btn w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
              eqEnabled && eqPreset !== 'flat'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-600/20 ring-1 ring-emerald-400/30'
                : isDark
                ? 'bg-[#0f172a]/80 hover:bg-white/15 text-slate-200 border-white/15 shadow-black/40'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
            }`}
            title="المعادل الصوتي الاستوديو (Equalizer)"
          >
            <Sliders className="w-5 h-5 text-violet-500" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default RadioStudioVisualizer;
