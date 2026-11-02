import { memo, useMemo } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

/**
 * CosmicBackground — GPU-Optimized Animated Galaxy / Nebula Backdrop
 *
 * Optimizations:
 *   - Consolidates 60+ individual star DOM elements into 2 GPU-composited CSS box-shadow layers
 *   - Uses pre-softened gradients instead of expensive runtime filter:blur(80px) on rotating layers
 *   - Automatically adapts to Smart Performance Mode ('turbo' vs 'ultra')
 */
const CosmicBackground = memo(function CosmicBackground({
  density = 'normal',
  showShootingStar = true
}) {
  const performanceMode = useSettingsStore((s) => s.performanceMode);
  const isTurbo = performanceMode === 'turbo';

  // Generate 2 consolidated starfield box-shadow strings (replaces 60+ DOM nodes with 2 divs)
  const { layerA, layerB } = useMemo(() => {
    const counts = { low: 36, normal: 60, high: 90 };
    const total = isTurbo ? 28 : (counts[density] || counts.normal);
    const half = Math.ceil(total / 2);

    const makeShadows = (count, seedOffset) => {
      const shadows = [];
      for (let i = 0; i < count; i++) {
        // Deterministic pseudo-random distribution for stable layout
        const s1 = Math.sin((i + 1 + seedOffset) * 12.9898) * 43758.5453;
        const s2 = Math.cos((i + 1 + seedOffset) * 78.233) * 43758.5453;
        const x = ((s1 - Math.floor(s1)) * 100).toFixed(2);
        const y = ((s2 - Math.floor(s2)) * 100).toFixed(2);
        const alpha = (0.35 + ((i * 7) % 6) * 0.1).toFixed(2);
        shadows.push(`${x}vw ${y}vh 0 0 rgba(255,255,255,${alpha})`);
      }
      return shadows.join(',');
    };

    return {
      layerA: makeShadows(half, 0),
      layerB: makeShadows(total - half, 100)
    };
  }, [density, isTurbo]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden contain-paint" aria-hidden="true">
      {/* Layer 1: Deep cosmic base gradient */}
      <div className="absolute inset-0 bg-cosmic-base" />

      {/* Layer 2: Pre-softened Nebula clouds (no heavy runtime Gaussian blur) */}
      <div className="absolute inset-0">
        <div className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full opacity-30 dark:opacity-40 nebula-pink" />
        <div className="absolute -bottom-40 -left-32 w-[640px] h-[640px] rounded-full opacity-20 dark:opacity-30 nebula-cyan" />
        {!isTurbo && (
          <>
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[720px] h-[460px] rounded-full opacity-15 dark:opacity-25 nebula-purple" />
            <div className="absolute -bottom-20 right-1/4 w-[460px] h-[460px] rounded-full opacity-15 dark:opacity-20 nebula-emerald" />
          </>
        )}
      </div>

      {/* Layer 3: Aurora ribbons — active only in Ultra mode */}
      {!isTurbo && (
        <>
          <div className="absolute inset-0 opacity-20 dark:opacity-35 animate-cosmic-aurora pointer-events-none">
            <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] aurora-ribbon" />
          </div>
          <div className="absolute inset-0 opacity-15 dark:opacity-25 animate-cosmic-aurora-reverse pointer-events-none">
            <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 w-[960px] h-[960px] aurora-ribbon-2" />
          </div>
        </>
      )}

      {/* Layer 4: Consolidated 2-Layer GPU Starfield (replaces 60+ DOM nodes) */}
      <div
        className={isTurbo ? 'absolute top-0 left-0 w-[1.5px] h-[1.5px] rounded-full opacity-75' : 'absolute top-0 left-0 w-[1.5px] h-[1.5px] rounded-full animate-cosmic-twinkle'}
        style={{ boxShadow: layerA, animationDuration: '4s' }}
      />
      <div
        className={isTurbo ? 'absolute top-0 left-0 w-[2px] h-[2px] rounded-full opacity-60' : 'absolute top-0 left-0 w-[2px] h-[2px] rounded-full animate-cosmic-twinkle'}
        style={{ boxShadow: layerB, animationDuration: '5.5s', animationDelay: '1.8s' }}
      />

      {/* Layer 5: Shooting star (occasional, disabled in Turbo mode) */}
      {showShootingStar && !isTurbo && (
        <div className="absolute inset-0 animate-cosmic-shooting">
          <div className="shooting-star" />
        </div>
      )}

      {/* Layer 6: Subtle vignette to focus center */}
      <div className="absolute inset-0 bg-cosmic-vignette" />
    </div>
  );
});

export default CosmicBackground;
