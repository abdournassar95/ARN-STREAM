import { useMemo } from 'react';

/**
 * CosmicBackground — Animated galaxy/nebula backdrop
 *
 * Layers (back to front):
 *   1. Deep cosmic base gradient (dark mode) or aurora pastel (light mode)
 *   2. Animated nebula clouds (multi-color radial blobs that drift)
 *   3. Aurora ribbons (flowing conic gradients)
 *   4. Starfield (random twinkling stars via CSS)
 *   5. Shooting star (occasional diagonal streak)
 *
 * Props:
 *   - variant: 'dark' | 'light' | 'auto' (default 'auto' follows `dark` class)
 *   - density: 'low' | 'normal' | 'high' — star count
 *   - showAurora: boolean — show aurora ribbons (default true)
 *   - showNebula: boolean — show nebula clouds (default true)
 *   - showShootingStar: boolean — show occasional shooting star (default true)
 */
export default function CosmicBackground({
  variant = 'auto',
  density = 'normal',
  showShootingStar = true
}) {
  // Generate stable random stars (memoized so they don't shuffle on re-render)
  const stars = useMemo(() => {
    const counts = { low: 35, normal: 60, high: 90 };
    const count = counts[density] || counts.normal;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() < 0.7 ? Math.random() * 1.5 + 0.5 : Math.random() * 2.2 + 0.8,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2.5,
      opacity: Math.random() * 0.5 + 0.4
    }));
  }, [density]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Layer 1: Deep cosmic base gradient */}
      <div className="absolute inset-0 bg-cosmic-base" />

      {/* Layer 2: Nebula clouds — large animated radial blobs */}
      <div className="absolute inset-0 transform-gpu">
        {/* Magenta/Pink nebula (top-right) */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-35 dark:opacity-45 blur-2xl nebula-pink" />

        {/* Cyan/Teal nebula (bottom-left) */}
        <div className="absolute -bottom-40 -left-32 w-[700px] h-[700px] rounded-full opacity-25 dark:opacity-35 blur-2xl nebula-cyan" />

        {/* Purple/Indigo nebula (center) */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20 dark:opacity-30 blur-2xl nebula-purple" />

        {/* Emerald/Aqua accent (bottom-right) */}
        <div className="absolute -bottom-20 right-1/4 w-[500px] h-[500px] rounded-full opacity-15 dark:opacity-25 blur-2xl nebula-emerald" />

        {/* Ruby/Red accent (top-left small) */}
        <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] rounded-full opacity-15 dark:opacity-20 blur-2xl nebula-ruby" />
      </div>

      {/* Layer 3: Aurora ribbons — flowing conic gradients with GPU transform */}
      <div className="absolute inset-0 opacity-25 dark:opacity-40 animate-cosmic-aurora pointer-events-none transform-gpu will-change-transform">
        <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] aurora-ribbon" />
      </div>
      <div className="absolute inset-0 opacity-15 dark:opacity-30 animate-cosmic-aurora-reverse pointer-events-none transform-gpu will-change-transform">
        <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] aurora-ribbon-2" />
      </div>

      {/* Layer 4: Starfield */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white animate-cosmic-twinkle"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
              boxShadow: star.size > 2
                ? `0 0 ${star.size * 2}px rgba(255,255,255,0.6)`
                : undefined
            }}
          />
        ))}
      </div>

      {/* Layer 5: Shooting star (occasional) */}
      {showShootingStar && (
        <div className="absolute inset-0 animate-cosmic-shooting">
          <div className="shooting-star" />
        </div>
      )}

      {/* Layer 6: Subtle vignette to focus center */}
      <div className="absolute inset-0 bg-cosmic-vignette" />
    </div>
  );
}