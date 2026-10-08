import { memo } from 'react';
import { Power, Activity, Waves } from 'lucide-react';
import { useEqualizerStore } from '../../store/useEqualizerStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const AudioFxRack = memo(function AudioFxRack({ isRtl = false, enabled = true, isDark: propIsDark }) {
  const { theme } = useSettingsStore();
  const isDark = propIsDark !== undefined ? propIsDark : theme !== 'light';

  const {
    delayEnabled,
    delayTime,
    delayFeedback,
    delayWet,
    toggleDelay,
    setDelayTime,
    setDelayFeedback,
    setDelayWet,
    echoEnabled,
    echoTime,
    echoFeedback,
    echoWet,
    toggleEcho,
    setEchoTime,
    setEchoFeedback,
    setEchoWet
  } = useEqualizerStore();

  const DELAY_QUICK_PRESETS = [
    { labelAr: 'صفعة (Slapback)', labelEn: 'Slapback', time: 0.12, feedback: 0.20, wet: 0.35 },
    { labelAr: 'إيقاعي (Echo Beat)', labelEn: 'Echo Beat', time: 0.28, feedback: 0.40, wet: 0.35 },
    { labelAr: 'واسع (Ambient)', labelEn: 'Ambient', time: 0.55, feedback: 0.60, wet: 0.45 },
  ];

  const ECHO_QUICK_PRESETS = [
    { labelAr: 'غرفة (Studio)', labelEn: 'Studio', time: 0.12, feedback: 0.30, wet: 0.25 },
    { labelAr: 'قاعة (Hall)', labelEn: 'Hall', time: 0.25, feedback: 0.50, wet: 0.35 },
    { labelAr: 'عميق (Canyon)', labelEn: 'Canyon', time: 0.45, feedback: 0.65, wet: 0.45 },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 transition-opacity duration-300 ${
      enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
    }`}>
      {/* ─── 1. DELAY MODULE (تأثير التكرار الزمني) ─── */}
      <div className={`relative rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 ${
        isDark
          ? delayEnabled
            ? 'bg-[#0d1322]/90 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
            : 'bg-[#0d1322]/60 border-white/5 opacity-80 hover:opacity-100'
          : delayEnabled
          ? 'bg-white border-cyan-500 shadow-md ring-1 ring-cyan-400/40'
          : 'bg-slate-50/90 border-slate-200/90 opacity-80 hover:opacity-100'
      }`}>
        {/* Module Header */}
        <div className={`flex items-center justify-between border-b pb-2.5 mb-3 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              delayEnabled
                ? (isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700')
                : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-200 text-slate-500')
            }`}>
              <Activity size={15} />
            </div>
            <div>
              <div className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span>{isRtl ? 'الديلي (Tape Delay)' : 'Tape Delay FX'}</span>
                {delayEnabled && (
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    isDark ? 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]' : 'bg-cyan-600'
                  }`} />
                )}
              </div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isRtl ? 'تكرار صوتي متدرج دافئ' : 'Analog tape echo repeats'}
              </div>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={toggleDelay}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              delayEnabled
                ? (isDark ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]' : 'bg-cyan-600 text-white shadow-sm')
                : (isDark ? 'bg-white/10 text-slate-300 hover:text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300')
            }`}
          >
            <Power size={11} className="stroke-[3]" />
            <span>{delayEnabled ? (isRtl ? 'مفعّل' : 'ON') : (isRtl ? 'معطّل' : 'OFF')}</span>
          </button>
        </div>

        {/* Sliders Controls */}
        <div className={`flex flex-col gap-2.5 transition-opacity duration-200 ${
          delayEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          {/* Time slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{isRtl ? 'زمن التأخير (Time)' : 'Delay Time'}</span>
              <span className={`font-mono font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                {Math.round(delayTime * 1000)} ms
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.01"
              value={delayTime}
              onChange={(e) => setDelayTime(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-800 accent-cyan-400' : 'bg-slate-200 accent-cyan-600'
              }`}
            />
          </div>

          {/* Feedback slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{isRtl ? 'التغذية / التكرار (Feedback)' : 'Feedback (Repeats)'}</span>
              <span className={`font-mono font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                {Math.round(delayFeedback * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.85"
              step="0.02"
              value={delayFeedback}
              onChange={(e) => setDelayFeedback(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-800 accent-cyan-400' : 'bg-slate-200 accent-cyan-600'
              }`}
            />
          </div>

          {/* Wet Mix slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{isRtl ? 'نسبة المزج (Wet Mix)' : 'Dry / Wet Mix'}</span>
              <span className={`font-mono font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                {Math.round(delayWet * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.70"
              step="0.02"
              value={delayWet}
              onChange={(e) => setDelayWet(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-800 accent-cyan-400' : 'bg-slate-200 accent-cyan-600'
              }`}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className={`flex items-center gap-1.5 mt-1 pt-1 border-t ${
            isDark ? 'border-white/5' : 'border-slate-200'
          }`}>
            {DELAY_QUICK_PRESETS.map((p, idx) => (
              <button
                key={p.label || idx}
                type="button"
                onClick={() => {
                  setDelayTime(p.time);
                  setDelayFeedback(p.feedback);
                  setDelayWet(p.wet);
                }}
                className={`flex-1 py-1 rounded-md text-[10px] font-medium transition ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {isRtl ? p.labelAr : p.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 2. ECHO MODULE (تأثير صدى المكان والاستوديو) ─── */}
      <div className={`relative rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 ${
        isDark
          ? echoEnabled
            ? 'bg-[#0d1322]/90 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
            : 'bg-[#0d1322]/60 border-white/5 opacity-80 hover:opacity-100'
          : echoEnabled
          ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-400/40'
          : 'bg-slate-50/90 border-slate-200/90 opacity-80 hover:opacity-100'
      }`}>
        {/* Module Header */}
        <div className={`flex items-center justify-between border-b pb-2.5 mb-3 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              echoEnabled
                ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-200 text-slate-500')
            }`}>
              <Waves size={15} />
            </div>
            <div>
              <div className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span>{isRtl ? 'الإيكو (Spatial Echo)' : 'Spatial Echo FX'}</span>
                {echoEnabled && (
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    isDark ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-emerald-600'
                  }`} />
                )}
              </div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isRtl ? 'انعكاس وصدى مكاني رحب' : 'Room & hall reflection space'}
              </div>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={toggleEcho}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              echoEnabled
                ? (isDark ? 'bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-emerald-600 text-white shadow-sm')
                : (isDark ? 'bg-white/10 text-slate-300 hover:text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300')
            }`}
          >
            <Power size={11} className="stroke-[3]" />
            <span>{echoEnabled ? (isRtl ? 'مفعّل' : 'ON') : (isRtl ? 'معطّل' : 'OFF')}</span>
          </button>
        </div>

        {/* Sliders Controls */}
        <div className={`flex flex-col gap-2.5 transition-opacity duration-200 ${
          echoEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          {/* Echo Size / Time slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{isRtl ? 'حجم الصدى (Space Time)' : 'Echo Time'}</span>
              <span className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {Math.round(echoTime * 1000)} ms
              </span>
            </div>
            <input
              type="range"
              min="0.08"
              max="0.50"
              step="0.01"
              value={echoTime}
              onChange={(e) => setEchoTime(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-800 accent-emerald-400' : 'bg-slate-200 accent-emerald-600'
              }`}
            />
          </div>

          {/* Decay / Feedback slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{isRtl ? 'عمق الانعكاس (Decay)' : 'Decay / Reflections'}</span>
              <span className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {Math.round(echoFeedback * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.75"
              step="0.02"
              value={echoFeedback}
              onChange={(e) => setEchoFeedback(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-800 accent-emerald-400' : 'bg-slate-200 accent-emerald-600'
              }`}
            />
          </div>

          {/* Wet Mix slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px]">
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{isRtl ? 'نسبة الصدى (Echo Level)' : 'Echo Mix Level'}</span>
              <span className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {Math.round(echoWet * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.70"
              step="0.02"
              value={echoWet}
              onChange={(e) => setEchoWet(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                isDark ? 'bg-slate-800 accent-emerald-400' : 'bg-slate-200 accent-emerald-600'
              }`}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className={`flex items-center gap-1.5 mt-1 pt-1 border-t ${
            isDark ? 'border-white/5' : 'border-slate-200'
          }`}>
            {ECHO_QUICK_PRESETS.map((p, idx) => (
              <button
                key={p.label || idx}
                type="button"
                onClick={() => {
                  setEchoTime(p.time);
                  setEchoFeedback(p.feedback);
                  setEchoWet(p.wet);
                }}
                className={`flex-1 py-1 rounded-md text-[10px] font-medium transition ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {isRtl ? p.labelAr : p.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default AudioFxRack;
