import { useEffect, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sliders,
  X,
  RotateCcw,
  Sparkles,
  Check,
  ChevronDown,
  Volume2,
  SlidersHorizontal,
  TrendingUp,
  Layers,
  ChevronUp,
  Sun,
  Moon
} from 'lucide-react';
import { useEqualizerStore, EQ_BANDS, EQ_PRESETS } from '../../store/useEqualizerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';
import InteractiveEqCurve from './InteractiveEqCurve';
import RotaryKnob from './RotaryKnob';
import AudioFxRack from './AudioFxRack';

/* ─── 1. Live Spectrum Visualizer (Glowing Canvas with Reflection) ─── */
const LiveSpectrumVisualizer = memo(function LiveSpectrumVisualizer({ enabled, isDark = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Smooth trailing arrays for a more organic feel
    const numBars = 48;
    const dataArray = new Uint8Array(numBars);
    let smoothedData = new Array(numBars).fill(0);
    
    let animFrame;

    const draw = () => {
      if (!enabled) {
        // Draw a flat glowing line when disabled
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, 1);
        return;
      }

      equalizerEngine.getFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / numBars) - 2;
      const centerY = height * 0.7; // Base line at 70% of height

      for (let i = 0; i < numBars; i++) {
        // Smooth data using interpolation
        smoothedData[i] += (dataArray[i] - smoothedData[i]) * 0.3;
        const val = smoothedData[i];
        const pct = val / 255;
        const barHeight = Math.max(1, pct * (centerY - 10)); // At least 1px high

        const x = i * (width / numBars);
        
        // Color gradient from left to right (Purple/Pink to Cyan/Blue)
        const hue = 270 + (i / numBars) * 90; // 270 (purple) to 360 (red) -> Let's use 260 to 200? Wait, 280 (purple) to 190 (cyan)
        // Let's do Purple -> Blue -> Cyan
        const hueActual = 280 - (i / numBars) * 100; // 280 -> 180

        const colorStr = `hsl(${hueActual}, 100%, ${isDark ? '65%' : '50%'})`;

        // 1. Draw main bar (Up)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = colorStr;
        ctx.shadowBlur = isDark ? 12 : 6;
        ctx.shadowColor = colorStr;
        
        // Use a gradient for the bar itself
        const grad = ctx.createLinearGradient(0, centerY, 0, centerY - barHeight);
        grad.addColorStop(0, `hsla(${hueActual}, 100%, 65%, 0.2)`);
        grad.addColorStop(1, colorStr);
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // 2. Glowing Cap (Top Dot)
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + barWidth / 2, centerY - barHeight - 2, barWidth / 2, 0, Math.PI * 2);
        ctx.fill();

        // 3. Reflection (Down)
        ctx.globalAlpha = 0.25;
        ctx.shadowBlur = 0;
        
        const refGrad = ctx.createLinearGradient(0, centerY, 0, centerY + (barHeight * 0.6));
        refGrad.addColorStop(0, colorStr);
        refGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = refGrad;

        ctx.beginPath();
        ctx.roundRect(x, centerY + 1, barWidth, barHeight * 0.6, [0, 0, 2, 2]);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
      }

      // Draw base line
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, centerY, width, 1);

      animFrame = requestAnimationFrame(draw);
    };

    if (enabled) {
      draw();
    } else {
      draw(); // Draw empty state
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [enabled, isDark]);

  return (
    <div className="w-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={600}
        height={90}
        className="w-full max-w-[600px] h-[90px] object-contain"
      />
    </div>
  );
});

export default function EqualizerModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const { theme, setTheme } = useSettingsStore();
  const isDark = theme !== 'light';

  const {
    enabled,
    toggleEnabled,
    currentPreset,
    setPreset,
    bands,
    setBandGain,
    preamp,
    setPreamp,
    reset,
    delayEnabled,
    delayTime,
    delayFeedback,
    delayWet,
    echoEnabled,
    echoTime,
    echoFeedback,
    echoWet
  } = useEqualizerStore();

  const [showFxDrawer, setShowFxDrawer] = useState(false);

  // Sync Web Audio Engine on any EQ, Preamp, Delay, or Echo change
  useEffect(() => {
    equalizerEngine.applySettings({
      bands,
      preamp,
      enabled,
      delay: { enabled: delayEnabled, time: delayTime, feedback: delayFeedback, wet: delayWet },
      echo: { enabled: echoEnabled, time: echoTime, feedback: echoFeedback, wet: echoWet }
    });
  }, [bands, preamp, enabled, delayEnabled, delayTime, delayFeedback, delayWet, echoEnabled, echoTime, echoFeedback, echoWet]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-[760px] max-h-[96vh] overflow-y-auto rounded-[32px] p-6 flex flex-col gap-6 scrollbar-thin transition-colors duration-300 ${
          isDark
            ? 'bg-[#181c25]/90 backdrop-blur-3xl border border-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.95)] text-white scrollbar-thumb-white/10'
            : 'bg-white/95 backdrop-blur-3xl border border-slate-200/90 shadow-xl text-slate-900 scrollbar-thumb-slate-300'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: isDark
            ? '0 30px 100px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.15)'
            : '0 25px 80px rgba(15,23,42,0.15), inset 0 1px 1px rgba(255,255,255,0.9)'
        }}
      >
        {/* ─── HEADER ─── */}
        <div className="flex items-center justify-between w-full">
          {/* Top-Left: Close & Active Switch */}
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition border ${
                isDark
                  ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <X size={18} />
            </button>
            <button
              type="button"
              onClick={toggleEnabled}
              className={`flex items-center gap-2.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${
                enabled
                  ? isDark
                    ? 'bg-[#1c3326] text-[#00ff66] border-[#00ff66]/30 shadow-[0_0_15px_rgba(0,255,102,0.15)]'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm'
                  : isDark
                  ? 'bg-slate-900/40 text-slate-500 border-white/10'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              <span>{enabled ? (isRtl ? 'مفعل' : 'Active') : (isRtl ? 'معطل' : 'Bypass')}</span>
              <div className={`w-3.5 h-3.5 rounded-full transition-all ${
                enabled
                  ? 'bg-[#00ff66] shadow-[0_0_10px_#00ff66,0_0_20px_#00ff66]'
                  : 'bg-slate-600'
              }`} />
            </button>
          </div>

          {/* Top-Right: Title & Icon */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <h2 className="text-xl font-bold tracking-tight">
                {isRtl ? 'موازن الصوت (Equalizer)' : 'Equalizer'}
              </h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isRtl ? 'تحسين وتخصيص ترددات الصوت بدقة في الوقت الفعلي' : 'Real-time high-precision frequency & audio shaping'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isDark
                ? 'bg-slate-800/60 border border-white/10 text-[#00ff66] shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]'
                : 'bg-slate-100 border border-slate-200 text-emerald-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]'
            }`}>
              <Sliders size={24} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* ─── SPECTRUM ANALYZER ─── */}
        <div className={`rounded-full px-6 py-3 border flex items-center justify-center ${
          isDark ? 'bg-black/40 border-white/10' : 'bg-slate-100/80 border-slate-200'
        }`}>
          <LiveSpectrumVisualizer enabled={enabled} isDark={isDark} />
        </div>

        {/* ─── MAIN EQUALIZER DISPLAY ─── */}
        <div className="relative w-full">
          <InteractiveEqCurve
            bands={bands}
            onBandChange={setBandGain}
            enabled={enabled}
            isRtl={isRtl}
            isDark={isDark}
          />
        </div>

        {/* ─── BOTTOM PRESETS SECTION ─── */}
        <div className={`w-full pt-4 mt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
          
          {/* Presets Row */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 w-full">
            
            {/* Right Side (RTL) - Presets Title + Buttons */}
            <div className="flex flex-col items-end gap-3">
              <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isRtl ? 'الأوضاع الصوتية الجاهزة' : 'Presets'}
              </span>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {[
                  { key: 'bassBoost', labelAr: 'مضخم البيز', labelEn: 'Bass Boost' },
                  { key: 'bassReducer', labelAr: 'تخفيف البيز', labelEn: 'Bass Cut' },
                  { key: 'flat', labelAr: 'عادي', labelEn: 'Normal' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPreset(p.key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                      currentPreset === p.key
                        ? isDark
                          ? 'bg-white/10 text-white border-white/30 shadow-[0_0_8px_rgba(255,255,255,0.08)]'
                          : 'bg-slate-800 text-white border-transparent'
                        : isDark
                        ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isRtl ? p.labelAr : p.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Center - Preamp Knob */}
            <div className="flex flex-col items-center gap-1">
              <RotaryKnob
                value={preamp}
                min={-10}
                max={10}
                step={0.5}
                onChange={setPreamp}
                size={90}
                label=""
                unit="dB"
                disabled={!enabled}
                isRtl={isRtl}
                isDark={isDark}
              />
              <div className={`flex items-center justify-between w-[130px] pointer-events-none text-[10px] font-mono font-bold ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>
                <span>+10dB</span>
                <span>-10dB</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Volume2 size={13} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isRtl ? 'التضخيم العام' : 'Preamp'}
                </span>
              </div>
            </div>

            {/* Left Side (RTL) - Reset + Vocal Presets */}
            <div className="flex flex-col items-start gap-3">
              <button
                onClick={reset}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors w-fit ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <RotateCcw size={13} />
                <span>{isRtl ? 'افتراضي' : 'Default'}</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'vocal', labelAr: 'وضوح (Vocal)', labelEn: 'Vocal' },
                  { key: 'clarity', labelAr: 'وضوح الصوت', labelEn: 'Clarity' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPreset(p.key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                      currentPreset === p.key
                        ? isDark
                          ? 'bg-white/10 text-white border-white/30 shadow-[0_0_8px_rgba(255,255,255,0.08)]'
                          : 'bg-slate-800 text-white border-transparent'
                        : isDark
                        ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isRtl ? p.labelAr : p.labelEn}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ─── EXPANDABLE AUDIO FX RACK ─── */}
        <div className="flex items-center justify-center pt-6">
          <button
            onClick={() => setShowFxDrawer(!showFxDrawer)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              showFxDrawer
                ? isDark
                  ? 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30'
                  : 'bg-cyan-50 text-cyan-700 border-cyan-400'
                : isDark
                ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <Layers size={14} />
            <span>{isRtl ? 'مؤثرات إضافية (Delay & Echo)' : 'More FX'}</span>
            {showFxDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showFxDrawer && (
          <div className={`mt-4 pt-4 border-t animate-fadeIn ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}>
            <AudioFxRack isRtl={isRtl} enabled={enabled} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  );
}
