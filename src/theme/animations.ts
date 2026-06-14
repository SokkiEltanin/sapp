export const spring = {
  snap:   { damping: 20, stiffness: 300, mass: 0.8 },
  smooth: { damping: 28, stiffness: 180, mass: 1   },
  pop:    { damping: 18, stiffness: 250, mass: 0.6 },
} as const;

export const timing = {
  fast:   { duration: 120 },
  medium: { duration: 220 },
  slow:   { duration: 350 },
} as const;

// Motion tokens for the redesign — keep it short, fast, purposeful (no decoration).
// Press feedback, value count-ups, height/opacity transitions, tab highlight.
export const motion = {
  pressScale: 0.97,
  fast: 150,
  base: 220,
  slow: 300,
  // standard ease-out (decelerate) — calm, premium
  easeOut: [0.16, 1, 0.3, 1] as const,
} as const;
