import { useState, useRef, memo } from 'react';
import { EQ_BANDS } from '../../store/useEqualizerStore';

const SingleBandSlider = memo(function SingleBandSlider({
  band,
  index,
  gain = 0,
  onChange,
  disabled = false,
  isRtl = false
}) {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Gain from -12dB to +12dB -> 0% to 100%
  const clampedGain = Math.max(-12, Math.min(12, gain));
  const percentage = Math.max(0, Math.min(100, ((clampedGain + 12) / 24) * 100));

  const calculateGainFromPointer = (clientY) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const offset = rect.bottom - clientY;
    let pct = (offset / rect.height) * 100;
    pct = Math.max(0, Math.min(100, pct));
    const rawGain = -12 + (pct / 100) * 24;
    return Math.round(rawGain * 2) / 2; // Step by 0.5 dB
  };

  const handlePointerDown = (e) => {
    if (disabled) return;
    setIsDragging(true);
    const newGain = calculateGainFromPointer(e.clientY);
    if (onChange) onChange(index, newGain);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (!isDragging || disabled) return;
    const newGain = calculateGainFromPointer(e.clientY);
    if (onChange) onChange(index, newGain);
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(index, 0); // Reset to 0 dB
  };

  const showTooltip = isDragging || isHovered;

  return (
    <div
      className={`slider-group ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={trackRef}
        className="slider-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        title={isRtl ? `${band.label}: انقر نقراً مزدوجاً للتصفير` : `${band.label}: double click to reset`}
      >
        {/* Glow Fill */}
        <div
          className="slider-fill"
          style={{ height: `${percentage}%` }}
        />

        {/* Draggable Thumb */}
        <div
          className="slider-thumb"
          style={{ bottom: `calc(${percentage}% - 7px)` }}
          onDoubleClick={handleDoubleClick}
        >
          <div className="thumb-line" />
          
          {/* Tooltip showing dB value */}
          {showTooltip && (
            <div className="slider-tooltip animate-fadeIn">
              {clampedGain > 0 ? `+${clampedGain.toFixed(1)}` : clampedGain.toFixed(1)} dB
            </div>
          )}
        </div>
      </div>

      {/* Frequency label (e.g. 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k) */}
      <div className="freq-label">
        {band.shortLabel || band.label}
      </div>
    </div>
  );
});

const StudioEqSliders = memo(function StudioEqSliders({
  bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  onBandChange,
  disabled = false,
  isRtl = false
}) {
  return (
    <div className="eq-sliders">
      {EQ_BANDS.map((band, idx) => (
        <SingleBandSlider
          key={band.id}
          band={band}
          index={idx}
          gain={bands[idx] ?? 0}
          onChange={onBandChange}
          disabled={disabled}
          isRtl={isRtl}
        />
      ))}
    </div>
  );
});

export default StudioEqSliders;

