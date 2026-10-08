const SIZE_MAP = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32,
  xl: 40,
};

/**
 * `size` accepts a keyword (xs|sm|md|lg|xl) or a raw pixel number.
 * Passing a keyword previously produced invalid CSS (`width: "sm"`),
 * which the browser silently dropped — so the spinner rendered at
 * its default size. Normalize both forms to a number here.
 */
export default function Spinner({ size = 'md', className = '' }) {
  const px = typeof size === 'number' ? size : (SIZE_MAP[size] ?? SIZE_MAP.md);
  return (
    <div
      className={`animate-spin rounded-full border-2 border-muted ${className}`}
      style={{ width: px, height: px }}
    />
  );
}
