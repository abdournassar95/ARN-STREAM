import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';
import { Activity, BarChart2, Radio, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * ARN Audio Visualizer Component
 * 60fps Web Audio API Canvas Visualizer with 3 Presets:
 * 1. 'waveform' - Glowing Neon Waveform
 * 2. 'bars' - Cyberpunk Frequency Spectrum Bars with Peak Caps
 * 3. 'circle' - Cosmic Pulsing Orbit
 */
const AudioVisualizer = memo(function AudioVisualizer({ isPlaying, coverSrc, trackTitle, className = '' }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const peaksRef = useRef([]);

  // Presets: 'waveform' | 'bars' | 'circle'
  const [preset, setPreset] = useState(() => {
    return localStorage.getItem('arn_audio_visualizer_preset') || 'bars';
  });

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    localStorage.setItem('arn_audio_visualizer_preset', newPreset);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 280);

    const handleResize = () => {
      if (canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Setup buffer
    const bufferLength = 64; // compact & smooth for UI
    const dataArray = new Uint8Array(bufferLength);
    if (peaksRef.current.length !== bufferLength) {
      peaksRef.current = new Array(bufferLength).fill(0);
    }

    let angleOffset = 0;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      // Fetch live frequency byte data from engine
      equalizerEngine.getFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const isSilent = !isPlaying;

      if (preset === 'bars') {
        // ─── Preset: Spectrum Bars ───
        const barCount = 36;
        const totalGap = (barCount - 1) * 3;
        const barWidth = Math.max(3, (width - 40 - totalGap) / barCount);
        const startX = (width - (barCount * barWidth + totalGap)) / 2;
        const baseLine = height - 20;

        for (let i = 0; i < barCount; i++) {
          const dataIdx = Math.floor((i / barCount) * (bufferLength * 0.75));
          const val = isSilent ? 4 : dataArray[dataIdx] || 0;
          const barHeight = Math.max(4, (val / 255) * (height - 50));

          // Peak falloff
          if (barHeight > (peaksRef.current[i] || 0)) {
            peaksRef.current[i] = barHeight;
          } else {
            peaksRef.current[i] = Math.max(0, (peaksRef.current[i] || 0) - 1.2);
          }

          const x = startX + i * (barWidth + 3);
          const y = baseLine - barHeight;

          // Bar Gradient
          const grad = ctx.createLinearGradient(0, y, 0, baseLine);
          grad.addColorStop(0, '#06b6d4'); // Cyan
          grad.addColorStop(0.5, '#10b981'); // Emerald
          grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]) : ctx.rect(x, y, barWidth, barHeight);
          ctx.fill();

          // Peak Cap
          const peakY = baseLine - (peaksRef.current[i] || 0) - 3;
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x, Math.max(8, peakY), barWidth, 2);
        }
      } else if (preset === 'waveform') {
        // ─── Preset: Neon Waveform ───
        const centerY = height / 2;
        const sliceWidth = width / bufferLength;

        // Draw Ambient Glow Behind
        ctx.save();
        ctx.shadowBlur = 24;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.7)';

        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = isSilent ? 128 : dataArray[i];
          const y = centerY + ((v - 128) / 128) * (height * 0.4);

          if (i === 0) ctx.moveTo(x, y);
          else {
            const prevX = (i - 1) * sliceWidth;
            const prevV = isSilent ? 128 : dataArray[i - 1];
            const prevY = centerY + ((prevV - 128) / 128) * (height * 0.4);
            const midX = (prevX + x) / 2;
            const midY = (prevY + y) / 2;
            ctx.quadraticCurveTo(prevX, prevY, midX, midY);
          }
          x += sliceWidth;
        }

        const waveGrad = ctx.createLinearGradient(0, 0, width, 0);
        waveGrad.addColorStop(0, '#06b6d4');
        waveGrad.addColorStop(0.5, '#3b82f6');
        waveGrad.addColorStop(1, '#10b981');

        ctx.strokeStyle = waveGrad;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Mirrored Subtle Wave
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = isSilent ? 128 : dataArray[i];
          const y = centerY - ((v - 128) / 128) * (height * 0.25);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (preset === 'circle') {
        // ─── Preset: Cosmic Pulsing Orbit ───
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) * 0.55;

        // Calculate average bass level (first 8 bands)
        let bassSum = 0;
        for (let b = 0; b < 8; b++) bassSum += dataArray[b];
        const bassAvg = isSilent ? 0 : bassSum / 8;
        const pulse = (bassAvg / 255) * 18;

        angleOffset += 0.015;

        // Glowing outer circle
        ctx.save();
        ctx.shadowBlur = 18 + pulse;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';

        const points = 48;
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2 + angleOffset;
          const dataIdx = Math.floor((i / points) * (bufferLength * 0.6));
          const val = isSilent ? 0 : dataArray[dataIdx] || 0;
          const r = radius + pulse + (val / 255) * (radius * 0.35);
          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        const circleGrad = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
        circleGrad.addColorStop(0, '#06b6d4');
        circleGrad.addColorStop(0.5, '#8b5cf6');
        circleGrad.addColorStop(1, '#10b981');

        ctx.strokeStyle = circleGrad;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Inner glowing core
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, radius * 0.7 + pulse * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, preset]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full select-none ${className}`}>
      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Preset Selector Pill */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 shadow-lg z-10">
        <button
          onClick={() => handlePresetChange('bars')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition ${
            preset === 'bars' ? 'bg-primaryMusic text-black font-semibold' : 'text-muted hover:text-white'
          }`}
          title={isRtl ? 'أعمدة الطيف' : 'Spectrum Bars'}
        >
          <BarChart2 size={13} />
          <span className="hidden sm:inline">{isRtl ? 'أعمدة الطيف' : 'Bars'}</span>
        </button>

        <button
          onClick={() => handlePresetChange('waveform')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition ${
            preset === 'waveform' ? 'bg-primaryMusic text-black font-semibold' : 'text-muted hover:text-white'
          }`}
          title={isRtl ? 'موجة النيون' : 'Neon Wave'}
        >
          <Activity size={13} />
          <span className="hidden sm:inline">{isRtl ? 'موجة نيون' : 'Wave'}</span>
        </button>

        <button
          onClick={() => handlePresetChange('circle')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition ${
            preset === 'circle' ? 'bg-primaryMusic text-black font-semibold' : 'text-muted hover:text-white'
          }`}
          title={isRtl ? 'القرص الكوني' : 'Cosmic Orbit'}
        >
          <Radio size={13} />
          <span className="hidden sm:inline">{isRtl ? 'حلقة كونية' : 'Orbit'}</span>
        </button>
      </div>
    </div>
  );
});

export default AudioVisualizer;
