import React from 'react';
import { G, Path, Circle, Ellipse, Rect } from 'react-native-svg';

// Custom accessories drawn directly in the cat's 2000×2000 viewBox (see CatArt) so
// they fit the actual head/neck/eyes instead of floating emoji. Rendered on top of
// the cat. Coordinates were tuned against the cat's geometry by render.

const INK = '#3B3C4E';

// ── Hats (sit between / on the ears, x≈780–1130 clear gap; forehead band ≈y600) ──
const HAT_CROWN = (
  <G>
    <Path d="M772 588 L800 452 L890 540 L953 430 L1016 540 L1106 452 L1134 588 Z" fill="#F5C94E" stroke="#D9A520" strokeWidth={12} />
    <Rect x={762} y={576} width={382} height={52} rx={16} fill="#EDB63A" stroke="#D9A520" strokeWidth={10} />
    <Circle cx={800} cy={452} r={17} fill="#fff" />
    <Circle cx={953} cy={430} r={20} fill="#E0555F" />
    <Circle cx={1106} cy={452} r={17} fill="#fff" />
    <Circle cx={850} cy={602} r={12} fill="#E0555F" />
    <Circle cx={953} cy={602} r={12} fill="#6FA8E8" />
    <Circle cx={1056} cy={602} r={12} fill="#E0555F" />
  </G>
);

const HAT_BERET = (
  <G>
    <G transform="rotate(-8 953 560)"><Ellipse cx={953} cy={560} rx={330} ry={150} fill="#E86A5C" /></G>
    <Path d="M640 600 Q953 690 1266 600 L1266 628 Q953 720 640 628 Z" fill="#C74E44" />
    <Circle cx={1120} cy={452} r={26} fill="#E86A5C" />
  </G>
);

const HAT_BEANIE = (
  <G>
    <Path d="M632 662 Q953 280 1274 662 Z" fill="#4FA79C" />
    <Path d="M624 652 Q953 726 1282 652 L1282 708 Q953 782 624 708 Z" fill="#3C8A80" />
    <Circle cx={953} cy={452} r={54} fill="#EAF3F1" stroke="#CADED9" strokeWidth={7} />
  </G>
);

const HAT_PARTY = (
  <G>
    <Path d="M834 640 L953 356 L1072 640 Z" fill="#6F9BEE" />
    <Path d="M905 470 L983 470 M872 560 L1034 560" stroke="#fff" strokeWidth={16} strokeLinecap="round" opacity={0.85} />
    <Path d="M834 640 Q953 690 1072 640 L1072 620 Q953 668 834 620 Z" fill="#4E7FD8" />
    <Circle cx={953} cy={352} r={30} fill="#F5C94E" />
  </G>
);

// ── Face (over the eyes: LX 794, RX 1107, EYY 762) ──
const FACE_ROUND = (
  <G>
    <Circle cx={794} cy={762} r={132} fill="none" stroke={INK} strokeWidth={20} />
    <Circle cx={1107} cy={762} r={132} fill="none" stroke={INK} strokeWidth={20} />
    <Path d="M926 758 Q950 742 975 758" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
    <Path d="M662 748 L590 726" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
    <Path d="M1239 748 L1311 726" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
  </G>
);

const FACE_SHADES = (
  <G>
    <Ellipse cx={794} cy={760} rx={138} ry={116} fill="#2B2F3D" />
    <Ellipse cx={1107} cy={760} rx={138} ry={116} fill="#2B2F3D" />
    <Path d="M930 742 H1024" stroke="#2B2F3D" strokeWidth={20} strokeLinecap="round" />
    <Path d="M656 724 L586 700" stroke="#2B2F3D" strokeWidth={18} strokeLinecap="round" />
    <Path d="M1245 724 L1315 700" stroke="#2B2F3D" strokeWidth={18} strokeLinecap="round" />
    <Path d="M716 716 Q760 686 812 704" fill="none" stroke="#565b6e" strokeWidth={13} strokeLinecap="round" />
    <Path d="M1029 716 Q1073 686 1125 704" fill="none" stroke="#565b6e" strokeWidth={13} strokeLinecap="round" />
  </G>
);

// ── Neck (collar at the head/body junction ≈y1040–1100) ──
const NECK_COLLAR = (
  <G>
    <Path d="M695 1040 Q953 1120 1211 1040 Q1216 1070 1211 1100 Q953 1180 695 1100 Q690 1070 695 1040 Z" fill="#E0555F" />
    <Path d="M695 1042 Q953 1122 1211 1042" fill="none" stroke="#fff" strokeWidth={7} opacity={0.35} />
    <Rect x={934} y={1120} width={38} height={30} rx={7} fill="#EAB93B" />
    <Circle cx={953} cy={1198} r={52} fill="#F5CB4E" stroke="#D9A520" strokeWidth={8} />
    <Path d="M925 1180 Q953 1200 981 1180" fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.5} />
    <Circle cx={953} cy={1214} r={11} fill="#B8860B" />
  </G>
);

const NECK_BOW = (
  <G>
    <Path d="M953 1075 L770 1010 Q735 1070 770 1130 Z" fill="#E0555F" />
    <Path d="M953 1075 L1136 1010 Q1171 1070 1136 1130 Z" fill="#E0555F" />
    <Path d="M953 1075 L788 1022 Q763 1072 788 1120 Z" fill="#c74650" opacity={0.45} />
    <Path d="M953 1075 L1118 1022 Q1143 1072 1118 1120 Z" fill="#c74650" opacity={0.45} />
    <Rect x={921} y={1042} width={64} height={66} rx={16} fill="#c74650" />
  </G>
);

// ── New accessories (verified by render on the cat) ──
const HAT_WIZARD = (
  <G>
    <Path d="M953 262 Q1010 470 1096 648 L810 648 Q900 470 953 262 Z" fill="#5B4B9E" />
    <Path d="M754 640 Q953 712 1152 640 L1152 686 Q953 758 754 686 Z" fill="#4A3D85" />
    <Circle cx={953} cy={440} r={13} fill="#F5C94E" />
    <Circle cx={905} cy={545} r={9} fill="#FBE08A" />
    <Circle cx={1005} cy={560} r={9} fill="#FBE08A" />
    <Circle cx={953} cy={360} r={10} fill="#FBE08A" />
  </G>
);

// A single 6-petal flower with a golden centre.
function Petals({ cx, cy, col }: { cx: number; cy: number; col: string }) {
  const pts = [0, 1, 2, 3, 4, 5].map(i => { const a = (i / 6) * Math.PI * 2; return { x: cx + Math.cos(a) * 26, y: cy + Math.sin(a) * 26 }; });
  return <G>{pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={18} fill={col} />)}<Circle cx={cx} cy={cy} r={15} fill="#F5C94E" /></G>;
}
const HAT_FLOWER = (
  <G>
    <Petals cx={722} cy={600} col="#F49AC1" />
    <Petals cx={842} cy={566} col="#F7C6DE" />
    <Petals cx={953} cy={556} col="#F49AC1" />
    <Petals cx={1064} cy={566} col="#F7C6DE" />
    <Petals cx={1184} cy={600} col="#F49AC1" />
  </G>
);

const FACE_MONOCLE = (
  <G>
    <Circle cx={1107} cy={762} r={122} fill="rgba(255,255,255,0.12)" stroke="#E7B84B" strokeWidth={16} />
    <Path d="M1150 872 Q1210 1010 1120 1120" fill="none" stroke="#E7B84B" strokeWidth={9} />
    <Circle cx={1118} cy={1128} r={14} fill="#E7B84B" />
  </G>
);

// warm orange so it pops on the blue coat (a blue scarf vanished into the cat)
const NECK_SCARF = (
  <G>
    <Path d="M690 1044 Q953 1140 1216 1044 Q1224 1112 1180 1168 Q953 1250 726 1168 Q682 1112 690 1044 Z" fill="#E0733A" />
    <Path d="M1112 1150 L1176 1372 L1052 1372 L1080 1150 Z" fill="#E0733A" />
    <Path d="M700 1070 Q953 1160 1206 1070" fill="none" stroke="#C25A26" strokeWidth={10} opacity={0.6} />
    <Path d="M1066 1200 L1160 1360" stroke="#C25A26" strokeWidth={10} opacity={0.6} />
  </G>
);

export const CAT_ACCESSORIES: Record<string, React.ReactNode> = {
  hat_crown: HAT_CROWN,
  hat_beret: HAT_BERET,
  hat_beanie: HAT_BEANIE,
  hat_party: HAT_PARTY,
  hat_wizard: HAT_WIZARD,
  hat_flower: HAT_FLOWER,
  face_round: FACE_ROUND,
  face_shades: FACE_SHADES,
  face_monocle: FACE_MONOCLE,
  neck_collar: NECK_COLLAR,
  neck_bow: NECK_BOW,
  neck_scarf: NECK_SCARF,
};

export type Worn = { hat?: string; face?: string; neck?: string; held?: string };

// Rendered INSIDE the cat's <Svg>, after the cat, so accessories sit on top. Neck
// first (lowest), then hat, then face (glasses over the eyes).
export default function CatAccessories({ equipped }: { equipped?: Worn }) {
  if (!equipped) return null;
  return (
    <>
      {equipped.neck ? CAT_ACCESSORIES[equipped.neck] ?? null : null}
      {equipped.hat ? CAT_ACCESSORIES[equipped.hat] ?? null : null}
      {equipped.face ? CAT_ACCESSORIES[equipped.face] ?? null : null}
    </>
  );
}
