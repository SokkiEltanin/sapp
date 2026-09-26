import { View } from 'react-native';
import Svg, { G, Path, Circle, Ellipse, Rect, Defs, Mask, Pattern } from 'react-native-svg';
import { PetExpression } from '@/utils/petState';
import { CatPalette, DEFAULT_PALETTE, PUPIL } from '@/utils/catPalettes';
import { mouthFor, Paw, LX, RX, EYY, CHEEK_L } from '@/components/pet/CatArt';
import { TAIL_D, TAIL_AXIS_DEG } from '@/components/pet/CatTail';

// Naprawdę statyczny bliźniak CatArt — ZERO Animated.Value, ZERO useState, ZERO
// useEffect, czysta funkcja koloru/wyglądu (2026-09-26, user: "zapisać wersję svg bez
// animacji i po prostu zmieniać mu kolor adekwatnie jak mu zmieniam"). `animate={false}`
// na CatArt (2026-08-30, boss-fight.tsx) wyłączało tylko pętle bezczynności — 8
// `Animated.Value`, kilka `useState`/`useEffect` (w tym atak/swat, wciąż aktywny pod
// `animate={false}`) i CAŁA maszyneria interakcji (tap/cuddle/particles) NADAL istniały
// przy każdym mouncie/renderze. Ten komponent bierze te same propsy koloru/wyglądu
// (paleta/pręgi/oczy/nosek/wąsy) i renderuje TYLKO spoczynkową pozę — żadnego ataku/
// swata (fight ma już osobną animację latającej łapy + flash bossa na trafienie, patrz
// `pawTravel`/`playBossHitFx` w boss-fight.tsx — kotek nie musi dublować tego sygnału).
//
// Duplikuje TYLKO markup (nie logikę) z CatArt.tsx — stałe/pomocnicze funkcje (`mouthFor`,
// `Paw`, `LX`/`RX`/`EYY`/`CHEEK_L`, `TAIL_D`/`TAIL_AXIS_DEG`) są stamtąd zaimportowane,
// nie przepisane, żeby zmiana kształtu w CatArt.tsx nie mogła po cichu rozjechać wyglądu
// tego bliźniaka.
export default function CatArtStatic({
  size = 150, expression = 'happy', palette = DEFAULT_PALETTE, stripes = false,
  eyeColor = '', noseColor = '', whiskers = false, legStripes = false,
}: {
  size?: number; expression?: PetExpression; palette?: CatPalette; stripes?: boolean;
  eyeColor?: string; noseColor?: string; whiskers?: boolean; legStripes?: boolean;
}) {
  const p = palette;
  const asleep = expression === 'sleeping';
  const half = !asleep && expression === 'content';

  const [eyeL, eyeR] = eyeColor.includes('|')
    ? (() => { const [a, b] = eyeColor.split('|'); return [a || PUPIL, b || PUPIL]; })()
    : [eyeColor || PUPIL, eyeColor || PUPIL];
  const hasEyeColor = !!eyeColor;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 2000 2000">
        <Defs>
          <Mask id="eyesFullStatic">
            <Rect x="0" y="0" width="2000" height="2000" fill="#fff" />
            <G transform="matrix(0.881056,0,0,0.515896,679.72648,498.929128)"><Path d={CHEEK_L} fill="#000" /></G>
            <G transform="matrix(0.881056,0,0,0.515896,361.996844,497.010652)"><Path d={CHEEK_L} fill="#000" /></G>
          </Mask>
          <Mask id="eyesHalfStatic">
            <Rect x="0" y="0" width="2000" height="2000" fill="#fff" />
            <G transform="matrix(0.881056,0,0,0.515896,679.72648,498.929128)"><Path d={CHEEK_L} fill="#000" /></G>
            <G transform="matrix(0.881056,0,0,0.515896,361.996844,497.010652)"><Path d={CHEEK_L} fill="#000" /></G>
            <Rect x="706" y="668" width="180" height="92" fill="#000" />
            <Rect x="1018" y="670" width="182" height="92" fill="#000" />
          </Mask>
          {stripes && (
            <Pattern id="tailStripesStatic" patternUnits="userSpaceOnUse" width={88} height={88} patternTransform={`rotate(${TAIL_AXIS_DEG})`}>
              <Rect x={0} y={0} width={40} height={88} fill={p.mark} opacity={0.9} />
            </Pattern>
          )}
        </Defs>

        {/* ogon — za ciałem */}
        <G transform="matrix(1,0,0,1,-106.194312,-183.051682)">
          <Path d={TAIL_D} fill={p.coat} />
          {stripes && <Path d={TAIL_D} fill="url(#tailStripesStatic)" />}
        </G>

        {/* ciało */}
        <G>
          <G transform="matrix(0,-0.483436,0.363931,0,59.355842,1854.91733)"><Path d="M1217.952,1697.909L615.632,1697.909C608.388,1670.962 604.719,1643.161 604.719,1615.237C604.719,1441.176 744.554,1299.859 916.792,1299.859C1089.029,1299.859 1228.864,1441.176 1228.864,1615.237C1228.864,1643.161 1225.195,1670.962 1217.952,1697.909Z" fill={p.coat} /></G>
          <G transform="matrix(-0,0.483436,-0.363931,-0,1843.367298,968.497305)"><Path d="M1217.952,1697.909L615.632,1697.909C608.388,1670.962 604.719,1643.161 604.719,1615.237C604.719,1441.176 744.554,1299.859 916.792,1299.859C1089.029,1299.859 1228.864,1441.176 1228.864,1615.237C1228.864,1643.161 1225.195,1670.962 1217.952,1697.909Z" fill={p.coat} /></G>
          <G transform="matrix(1,0,0,1.860595,35.894072,-1501.867858)"><Path d="M1227.275,1647.023L606.308,1647.023C605.249,1636.462 604.719,1625.853 604.719,1615.237C604.719,1523.584 644.172,1436.465 712.809,1376.557L1120.774,1376.557C1189.411,1436.465 1228.864,1523.584 1228.864,1615.237C1228.864,1625.853 1228.334,1636.462 1227.275,1647.023Z" fill={p.shade} /></G>
          <Rect x={777} y={1236} width={104} height={306} rx={52} fill={p.coat} />
          <Rect x={1025} y={1236} width={104} height={306} rx={52} fill={p.coat} />
        </G>
        <Paw cx={829} p={p} />
        <Paw cx={1077} p={p} />
        {legStripes && (
          <G fill={p.mark} opacity={0.32}>
            <Rect x={779} y={1300} width={100} height={13} rx={5} />
            <Rect x={779} y={1360} width={100} height={13} rx={5} />
            <Rect x={779} y={1420} width={100} height={13} rx={5} />
            <Rect x={1027} y={1300} width={100} height={13} rx={5} />
            <Rect x={1027} y={1360} width={100} height={13} rx={5} />
            <Rect x={1027} y={1420} width={100} height={13} rx={5} />
          </G>
        )}

        {/* głowa: baza + nosek */}
        <G>
          <G transform="matrix(1,0,0,0.890459,-226.720183,-280.574338)"><Circle cx={1179.406} cy={1195.161} r={370.904} fill={p.coat} /></G>
          <G transform="matrix(0.213355,0,0,0.272984,737.537265,581.298175)"><Path d="M1144.719,1084.766L843.176,1084.766C840.209,1076.226 838.71,1067.464 838.71,1058.671C838.71,998.193 908.269,949.093 993.948,949.093C1079.626,949.093 1149.185,998.193 1149.185,1058.671C1149.185,1067.464 1147.686,1076.226 1144.719,1084.766Z" fill={noseColor || p.ink} /></G>

          {asleep ? (
            <G>
              <Path d={`M${LX - 70} ${EYY} Q${LX} ${EYY + 46} ${LX + 70} ${EYY}`} fill="none" stroke={p.ink} strokeWidth={16} strokeLinecap="round" />
              <Path d={`M${RX - 70} ${EYY} Q${RX} ${EYY + 46} ${RX + 70} ${EYY}`} fill="none" stroke={p.ink} strokeWidth={16} strokeLinecap="round" />
            </G>
          ) : (
            <G mask={`url(#${half ? 'eyesHalfStatic' : 'eyesFullStatic'})`}>
              <Ellipse cx={794} cy={785} rx={78} ry={85} fill="#fff" />
              <Ellipse cx={1107} cy={787} rx={80} ry={87} fill="#fff" />
              <Ellipse cx={794} cy={792} rx={54} ry={61} fill={eyeL} />
              <Ellipse cx={1107} cy={794} rx={55} ry={61} fill={eyeR} />
              {hasEyeColor && (
                <G>
                  <Ellipse cx={794} cy={792} rx={54} ry={61} fill="none" stroke="#000" strokeWidth={7} opacity={0.22} />
                  <Ellipse cx={1107} cy={794} rx={55} ry={61} fill="none" stroke="#000" strokeWidth={7} opacity={0.22} />
                  <Ellipse cx={794} cy={792} rx={22} ry={50} fill="#12131A" />
                  <Ellipse cx={1107} cy={794} rx={22} ry={50} fill="#12131A" />
                </G>
              )}
              <Circle cx={815} cy={758} r={17} fill="#fff" />
              <Circle cx={1128} cy={760} r={17} fill="#fff" />
            </G>
          )}
          {half && (
            <G>
              <Path d="M718 758 Q794 776 870 758" fill="none" stroke={p.ink} strokeWidth={11} strokeLinecap="round" />
              <Path d="M1030 760 Q1107 778 1184 760" fill="none" stroke={p.ink} strokeWidth={11} strokeLinecap="round" />
            </G>
          )}
          {mouthFor(expression, false, false, p.ink)}
          {whiskers && (
            <G stroke={p.ink} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.5}>
              <Path d="M846 874 Q722 852 604 838" />
              <Path d="M848 902 Q720 906 596 904" />
              <Path d="M846 930 Q724 948 606 968" />
              <Path d="M1124 874 Q1248 852 1366 838" />
              <Path d="M1122 902 Q1250 906 1374 904" />
              <Path d="M1124 930 Q1246 948 1364 968" />
            </G>
          )}
          {expression === 'sick' && (
            <G transform="rotate(-17 862 566)">
              <Rect x={762} y={536} width={200} height={60} rx={18} fill="#F0D3AE" stroke="#D3B187" strokeWidth={4} />
              <Rect x={822} y={546} width={80} height={40} rx={9} fill="#E0BE93" />
            </G>
          )}
          {expression === 'sad' && <Path d="M726 838 q-40 74 0 116 q40 -40 0 -116 z" fill="#5AB0F0" stroke="#3E93D8" strokeWidth={5} />}
          {expression === 'sick' && <Path d="M1245 706 q34 64 0 100 q-34 -36 0 -100 z" fill="#BFE3F5" stroke="#8FCDEA" strokeWidth={4} />}
        </G>

        {/* uszy — rysowane NA WIERZCHU głowy, bez overlay'u/flutteru (statyczny kąt) */}
        <G>
          <G transform="matrix(1.041427,1.041427,-0.644296,0.644296,299.104612,-1346.740541)"><Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={p.coat} /></G>
          <G transform="matrix(0.599735,0.599735,-0.504606,0.504606,795.603559,-629.947691)"><Path d="M1326.238,586.138L1472.912,834.421L1224.629,834.421L1326.238,586.138Z" fill={p.ear} /></G>
        </G>
        <G transform="matrix(0.995551,-0.88133,0.54525,0.615914,-1080.579653,1264.375067)">
          <Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={p.coat} />
          <G transform="matrix(0.72388,-0.071206,0.038982,1.035369,340.059015,115.16946)"><Path d="M1348.771,586.138L1472.912,834.421L1224.629,834.421L1348.771,586.138Z" fill={p.ear} /></G>
        </G>
      </Svg>
    </View>
  );
}
