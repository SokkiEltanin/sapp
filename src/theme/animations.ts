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
