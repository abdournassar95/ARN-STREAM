import { useRef, useState, useCallback, memo } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

const DISPLAY_BANDS = [
  { storeIdx: 6, label: '12kHz', desc: 'Air' },
  { storeIdx: 5, label: '6kHz', desc: 'Treble' },
  { storeIdx: 4, label: '3kHz', desc: 'High-Mid' },
  { storeIdx: 3, label: '1kHz', desc: 'Mid' },
  { storeIdx: 2, label: '350Hz', desc: 'Low-Mid' },
  { storeIdx: 1, label: '170Hz', desc: 'Bass' },
  { storeIdx: 0, label: '60Hz', desc: 'Sub-Bass' }
];

function getSplinePoints(points, numSamples) {
  const result = [];
  const p = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  
  for (let i = 0; i < numSamples; i++) {
    const t_total = i / (numSamples - 1); 
    const x_target = points[0].x + t_total * (points[points.length - 1].x - points[0].x);
    
    let idx = 0;
    while (idx < points.length - 2 && points[idx + 1].x <= x_target) {
      idx++;
    }
    
    const p0 = p(idx - 1);
    const p1 = p(idx);
    const p2 = p(idx + 1);
    const p3 = p(idx + 2);
    
    const t = (x_target - p1.x) / (p2.x - p1.x || 1);
    const t2 = t * t;
    const t3 = t2 * t;
    
    const gain = 0.5 * (
      (2 * p1.gain) +
      (-p0.gain + p2.gain) * t +
      (2 * p0.gain - 5 * p1.gain + 4 * p2.gain - p3.gain) * t2 +
      (-p0.gain + 3 * p1.gain - 3 * p2.gain + p3.gain) * t3
    );
    
    result.push({ x: x_target, gain });
  }
  return result;
}

const InteractiveEqCurve = memo(function InteractiveEqCurve({
  bands = [0, 0, 0, 0, 0, 0, 0],
  onBandChange,
  enabled = true,
  isRtl = false,
  isDark: propIsDark
}) {
  const { theme } = useSettingsStore();
  const isDark = propIsDark !== undefined ? propIsDark : theme !== 'light';

  const svgRef = useRef(null);
  const [activeDragIdx, setActiveDragIdx] = useState(null);

  const viewWidth = 720;
  const viewHeight = 260;
  const paddingX = 55;
  const paddingY = 40;
  const usableWidth = viewWidth - paddingX * 2;
  const usableHeight = viewHeight - paddingY * 2;

  const gainToY = useCallback((gain) => {
    const clamped = Math.max(-12, Math.min(12, gain));
    const norm = (12 - clamped) / 24;
    return paddingY + norm * usableHeight;
  }, [usableHeight, paddingY]);

  const yToGain = useCallback((y) => {
    const clampedY = Math.max(paddingY, Math.min(viewHeight - paddingY, y));
    const norm = (clampedY - paddingY) / usableHeight;
    const rawGain = 12 - norm * 24;
    return Math.round(rawGain * 2) / 2;
  }, [usableHeight, paddingY, viewHeight]);

  const nodePoints = DISPLAY_BANDS.map((item, screenIdx) => {
    const x = paddingX + (screenIdx / (DISPLAY_BANDS.length - 1)) * usableWidth;
    const storeGain = bands[item.storeIdx] || 0;
    const y = gainToY(storeGain);
    return {
      x,
      y,
      gain: storeGain,
      storeIdx: item.storeIdx,
      screenIdx,
      label: item.label,
      desc: item.desc
    };
  });

  const allPoints = [
    { x: 0, gain: (bands[6] || 0) * 0.5 },
    ...nodePoints,
    { x: viewWidth, gain: (bands[0] || 0) * 0.5 }
  ];

  // 3D Mesh Generation
  const X_SAMPLES = 45;
  const Z_LEVELS = 15;
  const Z_OFFSET_X = 60; // shift right as it goes back
  const Z_OFFSET_Y = 50; // shift up as it goes back
  
  const horizontalPaths = [];
  const verticalPaths = [];
  const grid = [];
  
  for (let zi = 0; zi < Z_LEVELS; zi++) {
    const z = zi / (Z_LEVELS - 1); // 0 to 1
    const row = [];
    const curvePoints = getSplinePoints(allPoints, X_SAMPLES);
    
    for (let xi = 0; xi < X_SAMPLES; xi++) {
      const pt = curvePoints[xi];
      
      // Decrease gain towards the back to flatten it
      const zGain = pt.gain * (1 - z);
      
      const projX = pt.x + z * Z_OFFSET_X - (Z_OFFSET_X / 2); // Center perspective
      const projY = gainToY(zGain) - z * Z_OFFSET_Y + (Z_OFFSET_Y / 2);
      
      row.push({ x: projX, y: projY });
    }
    grid.push(row);
  }
  
  grid.forEach((row) => {
    const d = row.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    horizontalPaths.push(d);
  });
  
  for (let xi = 0; xi < X_SAMPLES; xi++) {
    const col = grid.map(row => row[xi]);
    const d = col.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    verticalPaths.push(d);
  }

  const handlePointerDown = (storeIdx, e) => {
    if (!enabled) return;
    e.stopPropagation();
    e.preventDefault();
    setActiveDragIdx(storeIdx);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (activeDragIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeY = ((e.clientY - rect.top) / rect.height) * viewHeight;
    const newGain = yToGain(relativeY);
    if (onBandChange) {
      onBandChange(activeDragIdx, newGain);
    }
  };

  const handlePointerUp = (e) => {
    if (activeDragIdx !== null) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
      setActiveDragIdx(null);
    }
  };

  const handleDoubleClick = (storeIdx, e) => {
    e.stopPropagation();
    if (onBandChange) onBandChange(storeIdx, 0);
  };

  return (
    <div className={`relative w-full rounded-2xl p-3 sm:p-5 overflow-hidden select-none transition-all duration-300 ${
      isDark
        ? 'bg-[#090e18]/90 border border-cyan-500/20 shadow-[0_15px_45px_rgba(0,0,0,0.85)]'
        : 'bg-slate-50/95 border border-slate-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.06)]'
    } ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>

      {/* SVG Canvas for Mesh and HTML Overlay Container */}
      <div className="relative w-full h-64 sm:h-72 z-10">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full touch-none overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            <linearGradient id="meshGradient" x1="0" y1={gainToY(12)} x2="0" y2={gainToY(-12)} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="30%" stopColor="#eab308" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="70%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            <filter id="meshGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid reference lines */}
          <g opacity="0.15">
            <line x1="0" y1={gainToY(12)} x2={viewWidth} y2={gainToY(12)} stroke="#ffffff" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1={gainToY(0)} x2={viewWidth} y2={gainToY(0)} stroke="#00e5ff" strokeWidth="1.5" />
            <line x1="0" y1={gainToY(-12)} x2={viewWidth} y2={gainToY(-12)} stroke="#ffffff" strokeWidth="1" strokeDasharray="4 4" />
          </g>

          {/* Draw 3D Mesh */}
          <g stroke="url(#meshGradient)" fill="none" opacity={isDark ? "0.6" : "0.8"}>
            {horizontalPaths.map((d, i) => (
              <path key={`h-${i}`} d={d} strokeWidth={i === 0 ? "2.5" : "1"} filter={i === 0 ? "url(#meshGlow)" : ""} opacity={1 - (i / Z_LEVELS) * 0.7} />
            ))}
            {verticalPaths.map((d, i) => (
              <path key={`v-${i}`} d={d} strokeWidth="1" opacity="0.7" />
            ))}
          </g>

          {/* Interactive Hit Areas and Dots */}
          {nodePoints.map((node) => (
            <g
              key={node.storeIdx}
              className="cursor-ns-resize touch-none"
              onPointerDown={(e) => handlePointerDown(node.storeIdx, e)}
              onDoubleClick={(e) => handleDoubleClick(node.storeIdx, e)}
            >
              <circle cx={node.x} cy={node.y} r="22" fill="transparent" />
              {/* Metallic Dot representation instead of HTML nodes */}
              <circle cx={node.x} cy={node.y} r="7" fill={isDark ? "#334155" : "#e2e8f0"} stroke={isDark ? "#94a3b8" : "#64748b"} strokeWidth="1.5" />
              <circle cx={node.x} cy={node.y - 1.5} r="5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              <circle cx={node.x} cy={node.y + 1.5} r="5" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
            </g>
          ))}
        </svg>

        {/* HTML Labels Overlay (pointer-events-none) */}
        <div className="absolute inset-0 pointer-events-none">
          {nodePoints.map((node) => {
            const left = `${(node.x / viewWidth) * 100}%`;
            const top = `${(node.y / viewHeight) * 100}%`;
            return (
              <div
                key={node.storeIdx}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center transition-all duration-100"
                style={{ left, top }}
              >
                <span className={`text-[11px] font-bold mb-8 px-1.5 py-0.5 rounded-md ${
                  isDark ? 'text-slate-200 bg-slate-900/60' : 'text-slate-700 bg-white/60'
                }`}>
                  {node.gain > 0 ? `+${node.gain}dB` : `${node.gain}dB`}
                </span>
                
                <span className={`text-[11px] font-medium mt-8 px-1.5 py-0.5 rounded-md ${
                  isDark ? 'text-slate-300 bg-slate-900/60' : 'text-slate-600 bg-white/60'
                }`}>
                  {node.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Frequency Axis Row */}
      <div className={`grid grid-cols-7 gap-1 mt-3 px-3 sm:px-6 text-center border-t pt-3 ${
        isDark ? 'border-white/5' : 'border-slate-200'
      }`}>
        {nodePoints.map((node) => (
          <div
            key={node.storeIdx}
            className="flex flex-col items-center justify-center"
          >
            <span className={`text-sm font-bold font-mono ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              {node.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default InteractiveEqCurve;
