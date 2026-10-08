import { useState, useRef, memo } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

const RotaryKnob = memo(function RotaryKnob({
  value = 0,
  min = -10,
  max = 10,
  step = 0.5,
  onChange,
  size = 110,
  label = 'Preamp',
  unit = 'dB',
  disabled = false,
  isRtl = false,
  isDark: propIsDark
}) {
  const { theme } = useSettingsStore();
  const isDark = propIsDark !== undefined ? propIsDark : theme !== 'light';

  const knobRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const startVal = useRef(value);

  // Rotation angles: min is -135 deg, max is +135 deg (270 deg total arc)
  const range = max - min;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  const angle = -135 + normalized * 270;

  // Arc calculations for SVG track
  const radius = size * 0.38;
  const center = size / 2;
  const strokeWidth = 5;

  const polarToCartesian = (cx, cy, r, angleInDegrees) => {
    const rad = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  };

  const describeArc = (x, y, r, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const bgArc = describeArc(center, center, radius, -135, 135);
  const activeArc = describeArc(center, center, radius, -135, angle);

  const handlePointerDown = (e) => {
    if (disabled) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    startVal.current = value;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    // 150px drag covers the entire range
    const deltaY = dragStartY.current - e.clientY;
    const valueDelta = (deltaY / 150) * range;
    let nextVal = startVal.current + valueDelta;
    nextVal = Math.max(min, Math.min(max, nextVal));
    nextVal = Math.round(nextVal / step) * step;
    if (onChange) onChange(Number(nextVal.toFixed(1)));
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
      setIsDragging(false);
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    if (onChange) onChange(0);
  };

  const isBoost = value > 0;
  const isCut = value < 0;

  return (
    <div className={`flex flex-col items-center select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Interactive Dial Container */}
      <div
        ref={knobRef}
        className="relative cursor-ns-resize touch-none flex items-center justify-center group"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        title={isRtl ? 'اسحب للأعلى أو الأسفل للضبط، انقر نقراً مزدوجاً للتصفير' : 'Drag up/down to adjust, double-click to reset'}
      >
        {/* SVG Arc Track & Active Glow */}
        <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
          <defs>
            <linearGradient id="knobGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? '#00ff66' : '#059669'} />
              <stop offset="100%" stopColor={isDark ? '#00e5ff' : '#0284c7'} />
            </linearGradient>
            <filter id="knobLedGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={isDark ? '3' : '1.5'} result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Arc */}
          <path
            d={bgArc}
            fill="none"
            stroke={isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.10)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active LED Arc */}
          {normalized > 0.01 && (
            <path
              d={activeArc}
              fill="none"
              stroke="url(#knobGlowGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              filter="url(#knobLedGlow)"
            />
          )}

          {/* Center 0dB Marker Tick */}
          <line
            x1={center}
            y1={center - radius - 5}
            x2={center}
            y2={center - radius + 5}
            stroke={isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)'}
            strokeWidth="1.5"
          />
        </svg>

        {/* 3D Physical Rotary Dial Body */}
        <div
          className={`relative rounded-full flex items-center justify-center transition-transform duration-75 border ${
            isDark
              ? 'border-white/10 shadow-[0_8px_25px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.15)]'
              : 'border-slate-300/80 shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.9)]'
          } ${
            isDragging
              ? (isDark ? 'scale-105 border-cyan-400/50 ring-2 ring-cyan-500/20' : 'scale-105 border-cyan-600 ring-2 ring-cyan-500/20')
              : (isDark ? 'group-hover:border-white/20' : 'group-hover:border-slate-400')
          }`}
          style={{
            width: size * 0.64,
            height: size * 0.64,
            background: isDark
              ? 'radial-gradient(circle at 35% 35%, #1e293b 0%, #0f172a 60%, #020617 100%)'
              : 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f1f5f9 60%, #cbd5e1 100%)'
          }}
        >
          {/* Beveled Rotary Pointer Notch */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ transform: `rotate(${angle}deg)`, transition: 'transform 0.06s ease-out' }}
          >
            <div
              className={`absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-3 rounded-full ${
                isDark
                  ? (isBoost ? 'bg-[#00ff66] shadow-[0_0_8px_#00ff66]' : isCut ? 'bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]' : 'bg-white')
                  : (isBoost ? 'bg-[#059669] shadow-[0_0_6px_#059669]' : isCut ? 'bg-[#0284c7] shadow-[0_0_6px_#0284c7]' : 'bg-slate-500')
              }`}
            />
          </div>

          {/* Central Digital Value Readout */}
          <div className="flex flex-col items-center justify-center text-center pointer-events-none z-10">
            <span className={`text-[12px] font-mono font-black tracking-tight ${
              isDark
                ? (isBoost ? 'text-[#00ff66]' : isCut ? 'text-[#00e5ff]' : 'text-slate-200')
                : (isBoost ? 'text-[#059669]' : isCut ? 'text-[#0284c7]' : 'text-slate-800')
            }`}>
              {value > 0 ? `+${value}` : value}
            </span>
            <span className={`text-[9px] uppercase font-semibold font-mono tracking-widest -mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {unit}
            </span>
          </div>
        </div>
      </div>

      {/* Label and Headroom Status if provided */}
      {label && (
        <div className="flex flex-col items-center mt-1 text-center pointer-events-none">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              value > 6
                ? (isDark ? 'bg-amber-400 animate-ping' : 'bg-amber-500')
                : value > 0
                ? (isDark ? 'bg-emerald-400' : 'bg-emerald-600')
                : (isDark ? 'bg-slate-500' : 'bg-slate-400')
            }`} />
            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {value > 6 ? 'HOT' : value > 0 ? 'BOOST' : 'CLEAN'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default RotaryKnob;
