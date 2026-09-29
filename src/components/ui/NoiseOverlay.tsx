import { useMemo } from 'react';
import Svg, { Circle } from 'react-native-svg';

// Subtelne ziarno/grain na gradientowych kafelkach (2026-09-29, user o kafelku "Plan
// zajęć": "możesz dodać noise większy" — dotąd żaden kafelek go nie miał). RN/RNSVG nie
// wspiera niezawodnie filtrów SVG (feTurbulence) na Androidzie (docelowa platforma appki,
// patrz CLAUDE.md), więc zamiast filtra: rozrzucone, malutkie półprzezroczyste kropki —
// ten sam trik co ziarno w druku offsetowym, działa identycznie na iOS/Androidzie bo to
// zwykłe `<Circle>` (uniwersalnie wspierane), nie efekt SVG.
// Deterministyczne ziarnistości (seedowany PRNG, nie `Math.random()`) — ten sam seed
// zawsze rysuje TE SAME kropki, więc tekstura nie "miga" przy każdym rerenderze karty.
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface NoiseOverlayProps {
  opacity?: number;
  density?: number;
  color?: string;
  seed?: number;
}

export default function NoiseOverlay({ opacity = 0.05, density = 140, color = '#FFFFFF', seed = 42 }: NoiseOverlayProps) {
  const dots = useMemo(() => {
    const rand = seededRandom(seed);
    return Array.from({ length: density }, (_, i) => ({
      key: i,
      cx: rand() * 100,
      cy: rand() * 100,
      r: 0.25 + rand() * 0.85,
      o: 0.25 + rand() * 0.75,
    }));
  }, [density, seed]);

  return (
    <Svg
      width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {dots.map(d => (
        <Circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill={color} fillOpacity={d.o * opacity} />
      ))}
    </Svg>
  );
}
