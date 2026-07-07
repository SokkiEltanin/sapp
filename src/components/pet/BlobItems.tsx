import { G, Path, Circle, Ellipse, Rect, Line } from 'react-native-svg';

// Custom vector cosmetics drawn to fit the blob (viewBox 0 0 100 105, head centred
// at cx=50, eyes at cx 35/65 cy 45). Replaces the janky emoji stickers.

export function HatArt({ id }: { id?: string }) {
  switch (id) {
    case 'hat_cap':
      return (
        <G>
          <Path d="M30 22 Q50 -2 70 22 Z" fill="#E24B4B" />
          <Path d="M64 21 Q84 20 82 27 Q70 27 62 24 Z" fill="#C43C3C" />
          <Circle cx="50" cy="6" r="2.6" fill="#C43C3C" />
        </G>
      );
    case 'hat_bow':
      return (
        <G>
          <Path d="M50 16 L38 9 Q34 16 38 23 Z" fill="#F472B6" />
          <Path d="M50 16 L62 9 Q66 16 62 23 Z" fill="#F472B6" />
          <Circle cx="50" cy="16" r="3.4" fill="#DB2777" />
        </G>
      );
    case 'hat_top':
      return (
        <G>
          <Ellipse cx="50" cy="21" rx="21" ry="4.5" fill="#1F2430" />
          <Rect x="39" y="0" width="22" height="20" rx="3" fill="#2A2F3D" />
          <Rect x="39" y="14" width="22" height="4" fill="#E24B4B" />
        </G>
      );
    case 'hat_grad':
      return (
        <G>
          <Path d="M50 4 L70 14 L50 24 L30 14 Z" fill="#232838" />
          <Circle cx="50" cy="14" r="2.4" fill="#FBBF24" />
          <Line x1="70" y1="14" x2="72" y2="26" stroke="#FBBF24" strokeWidth="1.6" />
          <Circle cx="72" cy="27" r="2" fill="#FBBF24" />
        </G>
      );
    case 'hat_crown':
      return (
        <G>
          <Path d="M32 22 L36 6 L44 15 L50 3 L56 15 L64 6 L68 22 Z" fill="#FBBF24" stroke="#E39A0C" strokeWidth="1" strokeLinejoin="round" />
          <Circle cx="50" cy="12" r="2.2" fill="#EF4444" />
          <Circle cx="40" cy="16" r="1.6" fill="#60A5FA" />
          <Circle cx="60" cy="16" r="1.6" fill="#60A5FA" />
        </G>
      );
    default: return null;
  }
}

export function GlassesArt({ id }: { id?: string }) {
  const ly = 45;
  switch (id) {
    case 'face_glass':
      return (
        <G>
          <Circle cx="35" cy={ly} r="10.5" fill="#BFE9FF" opacity={0.35} stroke="#2A2F3D" strokeWidth="2.4" />
          <Circle cx="65" cy={ly} r="10.5" fill="#BFE9FF" opacity={0.35} stroke="#2A2F3D" strokeWidth="2.4" />
          <Line x1="45" y1={ly} x2="55" y2={ly} stroke="#2A2F3D" strokeWidth="2.4" />
        </G>
      );
    case 'face_shade':
      return (
        <G>
          <Path d={`M24 ${ly - 6} h22 a4 4 0 0 1 4 4 v3 a5 5 0 0 1 -5 5 h-14 a6 6 0 0 1 -6 -6 v-3 a3 3 0 0 1 -1 -3 z`} fill="#161A22" />
          <Path d={`M76 ${ly - 6} h-22 a4 4 0 0 0 -4 4 v3 a5 5 0 0 0 5 5 h14 a6 6 0 0 0 6 -6 v-3 a3 3 0 0 0 1 -3 z`} fill="#161A22" />
          <Line x1="46" y1={ly - 4} x2="54" y2={ly - 4} stroke="#161A22" strokeWidth="3" />
          <Ellipse cx="31" cy={ly - 1} rx="2.4" ry="1.4" fill="#fff" opacity={0.5} />
        </G>
      );
    case 'face_dis':
      return (
        <G>
          <Path d="M27 37 Q35 34 42 37" stroke="#2A2233" strokeWidth="3" strokeLinecap="round" fill="none" />
          <Path d="M58 37 Q65 34 73 37" stroke="#2A2233" strokeWidth="3" strokeLinecap="round" fill="none" />
          <Circle cx="35" cy={ly} r="9.5" fill="none" stroke="#2A2233" strokeWidth="2.6" />
          <Circle cx="65" cy={ly} r="9.5" fill="none" stroke="#2A2233" strokeWidth="2.6" />
          <Path d="M45 46 Q50 58 55 46" fill="#E7A977" />
        </G>
      );
    default: return null;
  }
}

export function HeldArt({ id }: { id?: string }) {
  switch (id) {
    case 'held_balloon':
      return (
        <G>
          <Line x1="86" y1="52" x2="82" y2="72" stroke="#9AA3B2" strokeWidth="1.2" />
          <Ellipse cx="86" cy="44" rx="8" ry="9.5" fill="#EF4444" />
          <Ellipse cx="83" cy="40" rx="2.4" ry="3" fill="#fff" opacity={0.4} />
        </G>
      );
    case 'held_lolly':
      return (
        <G>
          <Line x1="85" y1="58" x2="85" y2="74" stroke="#E8D9C0" strokeWidth="2.2" />
          <Circle cx="85" cy="52" r="7.5" fill="#F472B6" />
          <Path d="M85 52 m-4 0 a4 4 0 0 1 8 0" stroke="#fff" strokeWidth="1.6" fill="none" opacity={0.7} />
        </G>
      );
    case 'held_flower':
      return (
        <G>
          {[0, 72, 144, 216, 288].map(a => {
            const r = (a * Math.PI) / 180;
            return <Ellipse key={a} cx={84 + Math.cos(r) * 5} cy={52 + Math.sin(r) * 5} rx="3.4" ry="4.6" fill="#F9A8D4" transform={`rotate(${a} ${84 + Math.cos(r) * 5} ${52 + Math.sin(r) * 5})`} />;
          })}
          <Circle cx="84" cy="52" r="3.2" fill="#FBBF24" />
          <Line x1="84" y1="56" x2="84" y2="74" stroke="#34A853" strokeWidth="2" />
        </G>
      );
    case 'held_guitar':
      return (
        <G>
          <Rect x="82" y="40" width="4" height="26" rx="2" fill="#7A4A24" transform="rotate(24 84 53)" />
          <Ellipse cx="80" cy="66" rx="8" ry="9" fill="#B4703A" />
          <Circle cx="80" cy="66" r="3" fill="#3B2410" />
        </G>
      );
    case 'held_sword':
      return (
        <G>
          <Rect x="83" y="42" width="3.4" height="24" rx="1.6" fill="#CBD5E1" transform="rotate(18 85 54)" />
          <Rect x="79" y="62" width="12" height="3" rx="1.5" fill="#FBBF24" transform="rotate(18 85 63)" />
          <Rect x="84" y="64" width="3" height="7" rx="1.5" fill="#7A4A24" transform="rotate(18 85 67)" />
        </G>
      );
    default: return null;
  }
}
