// Motion tokens according to motion-ui v4.2 specification
export const motionTokens = {
  duration: {
    fast: 0.16,
    normal: 0.26,
    slow: 0.45,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp: [0.4, 0, 0.2, 1],
  },
  distance: {
    sm: 6,
    md: 12,
    lg: 20,
  },
  spring: {
    stiff: { type: 'spring', stiffness: 450, damping: 32 },
    snappy: { type: 'spring', stiffness: 380, damping: 28 },
    gentle: { type: 'spring', stiffness: 260, damping: 24 },
  },
};
