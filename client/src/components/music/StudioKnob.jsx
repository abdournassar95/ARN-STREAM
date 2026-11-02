import { useRef, useState, useCallback, memo } from 'react';

const StudioKnob = memo(function StudioKnob({
  value = 50,
  min = 0,
  max = 100,
  defaultValue = 50,
  step = 1,
  onChange,
  size = 'small', // 'main' | 'small'
  label,
  displayValue,
  disabled = false,
  isRtl = false
}) {
  const knobRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ y: 0, angle: 0, val: value, centerX: 0, centerY: 0 });

  // Map value (min..max) to rotation angle (-135deg .. +135deg)
  const range = max - min || 1;
  const clampedVal = Math.max(min, Math.min(max, value));
  const normalized = (clampedVal - min) / range;
  const currentAngle = -135 + normalized * 270;

  const isLarge = size === 'main';

  const handlePointerDown = (e) => {
    if (disabled) return;
    const knob = knobRef.current;
    if (!knob) return;

    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    dragStart.current = {
      y: e.clientY,
      mouseAngle: startMouseAngle,
      knobAngle: currentAngle,
      val: clampedVal,
      centerX,
      centerY
    };

    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (!isDragging || disabled) return;
    const { y: startY, mouseAngle: startMouseAngle, knobAngle: startKnobAngle, centerX, centerY } = dragStart.current;

    // We combine angular drag with vertical drag for the ultimate buttery feel:
    // 1. Angular rotation calculation
    const moveMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    let angleDiff = moveMouseAngle - startMouseAngle;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    // 2. Also calculate vertical drag delta (120px covers full range)
    const verticalDelta = (startY - e.clientY) / 120 * 270;

    // Use whichever has higher magnitude or angular if large enough
    const effectiveDiff = Math.abs(angleDiff) > 8 ? angleDiff : verticalDelta;
    let newAngle = startKnobAngle + effectiveDiff;
    if (newAngle < -135) newAngle = -135;
    if (newAngle > 135) newAngle = 135;

    const newNormalized = (newAngle + 135) / 270;
    let nextVal = min + newNormalized * range;

    if (step) {
      nextVal = Math.round(nextVal / step) * step;
    }
    nextVal = Math.max(min, Math.min(max, nextVal));

    if (onChange) {
      onChange(Number(nextVal.toFixed(1)));
    }
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleDoubleClick = () => {
    if (disabled || onChange === undefined) return;
    onChange(defaultValue);
  };

  const handleWheel = (e) => {
    if (disabled) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? step * 2 : -step * 2;
    const nextVal = Math.max(min, Math.min(max, clampedVal + delta));
    if (onChange) onChange(Number(nextVal.toFixed(1)));
  };

  return (
    <div className={`knob-wrapper ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className={`knob-container ${isLarge ? 'main-knob-container' : 'small-knob-container'}`}>
        <div className="knob-track" />
        <div
          ref={knobRef}
          className="knob"
          style={{ transform: `rotate(${currentAngle}deg)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          title={isRtl ? 'اسحب للتدوير، انقر نقراً مزدوجاً للتصفير' : 'Drag to rotate, double click to reset'}
        >
          <div className="knob-inner-dot" />
        </div>
      </div>
      <div className="knob-label">
        {label}
        {displayValue !== undefined && (
          <>
            <br />
            <span
              style={{
                fontSize: isLarge ? '0.9rem' : '0.8rem',
                color: 'var(--accent-1)'
              }}
            >
              {displayValue}
            </span>
          </>
        )}
      </div>
    </div>
  );
});

export default StudioKnob;

