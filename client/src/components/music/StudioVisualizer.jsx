import { useEffect, useRef, memo } from 'react';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';

const StudioVisualizer = memo(function StudioVisualizer({
  enabled = true,
  isPlaying = true,
  isRtl = false,
  theme = 'theme-default'
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = canvas.offsetWidth || 650);
    let height = (canvas.height = canvas.offsetHeight || 130);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 650;
      height = canvas.height = canvas.offsetHeight || 130;
    };
    window.addEventListener('resize', handleResize);

    const numBars = 48;
    const barHeights = new Array(numBars).fill(0);
    const targetHeights = new Array(numBars).fill(0);
    const peakHeights = new Array(numBars).fill(0);
    const freqData = new Uint8Array(128);

    let time = 0;
    let animId;

    const draw = () => {
      time += 0.04;
      ctx.clearRect(0, 0, width, height);

      // Extract current active theme colors from DOM
      const rootStyles = getComputedStyle(canvas.closest('.studio-eq-container') || document.body);
      const color1 = rootStyles.getPropertyValue('--accent-1').trim() || '#00d2ff';
      const color2 = rootStyles.getPropertyValue('--accent-2').trim() || '#3a7bd5';
      const glowColor = rootStyles.getPropertyValue('--glow').trim() || 'rgba(0, 210, 255, 0.4)';

      if (!enabled) {
        // Flat baseline when disabled
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, height - 2, width, 1);
        animId = requestAnimationFrame(draw);
        return;
      }

      // 1. Try to read real live audio data
      let hasRealAudio = false;
      try {
        equalizerEngine.getFrequencyData(freqData);
        // Check if there is actual sound amplitude
        let sum = 0;
        for (let j = 0; j < 32; j++) sum += freqData[j];
        if (sum > 60) {
          hasRealAudio = true;
        }
      } catch (e) {
        hasRealAudio = false;
      }

      // 2. Compute targets
      for (let i = 0; i < numBars; i++) {
        if (hasRealAudio) {
          // Map bar index to frequency bins (logarithmic distribution)
          const binIndex = Math.min(freqData.length - 1, Math.floor(Math.pow(i / numBars, 1.3) * (freqData.length - 20)) + 2);
          const rawVal = freqData[binIndex] || 0;
          const normalized = rawVal / 255;
          targetHeights[i] = Math.max(4, normalized * (height * 0.85));
        } else if (isPlaying) {
          // Synthetic ambient waves from original design
          const wave1 = Math.sin(time * 2 + i * 0.2);
          const wave2 = Math.cos(time * 1.5 + i * 0.1);
          const wave3 = Math.sin(time * 0.5 + i * 0.5);
          const target = (wave1 + wave2 + wave3 + 3) / 6;
          targetHeights[i] = target * (height * 0.75) + (height * 0.08);
        } else {
          targetHeights[i] = 2;
        }
      }

      // 3. Smooth transitions & peaks
      for (let i = 0; i < numBars; i++) {
        barHeights[i] += (targetHeights[i] - barHeights[i]) * 0.18;

        if (barHeights[i] > peakHeights[i]) {
          peakHeights[i] = barHeights[i];
        } else {
          peakHeights[i] = Math.max(0, peakHeights[i] - 1.2);
        }
      }

      // 4. Render bars with gradient and glowing peaks
      const barWidth = width / numBars;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, color2);
      gradient.addColorStop(1, color1);

      for (let i = 0; i < numBars; i++) {
        // In RTL mode, lowest frequencies are on the right (matching the 31Hz slider)
        const x = isRtl
          ? width - (i * barWidth) - barWidth
          : i * barWidth;

        const h = Math.max(2, barHeights[i]);
        const y = height - h;
        const w = Math.max(2, barWidth - 3);
        const radius = Math.min(w / 2, 4);

        // Bar glow & fill
        ctx.shadowBlur = 14;
        ctx.shadowColor = glowColor;
        ctx.fillStyle = gradient;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, [radius, radius, 0, 0]);
        } else {
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + w - radius, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
          ctx.lineTo(x + w, height);
          ctx.lineTo(x, height);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
        }
        ctx.fill();

        // Glowing white peak dot
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const peakY = Math.max(3, height - peakHeights[i] - 5);
        ctx.arc(x + w / 2, peakY, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [enabled, isPlaying, isRtl, theme]);

  return (
    <div className="visualizer-wrapper">
      <canvas ref={canvasRef} />
    </div>
  );
});

export default StudioVisualizer;

