import React, { useState, useEffect, memo } from 'react';

/**
 * PlayerWatermark - Rotating Live Broadcast Watermark GIF
 * Automatically rotates between corners every 2 minutes with smooth fade transitions.
 * Encapsulated in React.memo to prevent unnecessary re-renders of the main player.
 */
const PlayerWatermark = memo(function PlayerWatermark({
  src = '/ARN_live_tv_broadcast.gif',
  alt = 'ARN Live TV Broadcast',
  className = '',
  rotationInterval = 2 * 60 * 1000,
}) {
  // 0: Top-Right, 1: Bottom-Right, 2: Bottom-Left, 3: Top-Left
  const [watermarkCorner, setWatermarkCorner] = useState(0);
  const [watermarkVisible, setWatermarkVisible] = useState(true);

  useEffect(() => {
    setWatermarkVisible(true);

    const interval = window.setInterval(() => {
      // Smooth fade-out before corner switch
      setWatermarkVisible(false);
      window.setTimeout(() => {
        setWatermarkCorner((prev) => (prev + 1) % 4);
        setWatermarkVisible(true);
      }, 700);
    }, rotationInterval);

    return () => {
      window.clearInterval(interval);
    };
  }, [rotationInterval]);

  const cornerClasses = [
    'top-4 sm:top-6 right-4 sm:right-6',         // 0: Top-Right
    'bottom-12 sm:bottom-16 right-4 sm:right-6', // 1: Bottom-Right
    'bottom-12 sm:bottom-16 left-4 sm:left-6',   // 2: Bottom-Left
    'top-4 sm:top-6 left-4 sm:left-6',           // 3: Top-Left
  ];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute z-25 transition-all duration-700 ease-in-out ${
        cornerClasses[watermarkCorner] || cornerClasses[0]
      } ${
        watermarkVisible ? 'opacity-95 scale-100' : 'opacity-0 scale-90'
      } ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
      />
    </div>
  );
});

PlayerWatermark.displayName = 'PlayerWatermark';

export default PlayerWatermark;
