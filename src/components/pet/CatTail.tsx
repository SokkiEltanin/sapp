import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';

// The tail — the ORIGINAL single smooth path from the artwork, not a chain of capsules.
//
// The segmented-View version travelled a wave but rendered as a kinked, jointed stick
// ("wygląda dziwnie"). A cat tail is one smooth shape, so this draws the real path and
// gives it a gentle sway by rotating the WHOLE tail group about its base — a wrapper
// transform, which is smooth on device (animating an SVG prop is what stutters). No
// travelling wave, but it reads as a real tail that moves, which the kinked chain didn't.
//
// Rendered full-size in the 2000 viewBox so it lands exactly where the artwork expects,
// then pivoted at the base (~1202,1238) via RN's translate→rotate→translate (no
// transform-origin).

const BASE_X = 1202, BASE_Y = 1238;   // tail attaches to the body here (viewBox units)
const TAIL_D = 'M1308.567,1421.964C1297.672,1432.859 1279.982,1432.859 1269.087,1421.964C1258.192,1411.069 1258.192,1393.379 1269.087,1382.484C1274.676,1376.895 1277.281,1367.411 1282.899,1357.04C1301.861,1322.036 1336.867,1273.685 1472.244,1256.763C1513.594,1251.594 1538.649,1251.292 1557.619,1235.85C1577.302,1219.829 1589.355,1189.318 1609.223,1129.716C1618.603,1101.577 1623.848,1052.64 1624.601,1045.862C1626.302,1030.548 1640.116,1019.497 1655.43,1021.198C1670.743,1022.9 1681.794,1036.714 1680.093,1052.027C1679.236,1059.741 1672.864,1115.352 1662.191,1147.372C1637.124,1222.574 1617.7,1258.937 1592.866,1279.152C1567.314,1299.95 1534.864,1305.204 1479.169,1312.165C1417.965,1319.816 1382.013,1333.948 1359.888,1350.59C1339.802,1365.699 1332.394,1382.571 1325.987,1395.385C1320.517,1406.322 1315.177,1415.355 1308.567,1421.964Z';

export default function CatTail({
  color, markColor, stripes, animate = true, mood = 'idle', size,
}: {
  color: string; markColor: string; stripes?: boolean;
  animate?: boolean; mood?: 'idle' | 'purr' | 'angry'; size: number;
}) {
  const sway = useRef(new Animated.Value(0.5)).current;
  const dur = mood === 'angry' ? 260 : mood === 'purr' ? 900 : 2000;
  const amp = mood === 'angry' ? 11 : 5;   // degrees each way

  useEffect(() => {
    if (!animate) { sway.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate, dur]);

  const unit = size / 2000;
  // pivot at the tail base, expressed relative to the overlay's centre (RN rotates about
  // centre and has no transform-origin)
  const px = BASE_X * unit - size / 2;
  const py = BASE_Y * unit - size / 2;
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: [`${-amp}deg`, `${amp}deg`] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, top: 0, width: size, height: size,
        transform: [
          { translateX: px }, { translateY: py },
          { rotate },
          { translateX: -px }, { translateY: -py },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 2000 2000">
        <Defs>
          {/* clip stripes to the tail so bands can't float off it, even if their exact
              placement is a touch off — the previous free-floating strokes "zjebały się" */}
          <ClipPath id="tailClip">
            <Path d={TAIL_D} transform="matrix(1,0,0,1,-106.194312,-183.051682)" />
          </ClipPath>
        </Defs>
        <G transform="matrix(1,0,0,1,-106.194312,-183.051682)">
          <Path d={TAIL_D} fill={color} />
        </G>
        {stripes && (
          // thick bands roughly perpendicular to the tail's run (base→tip), clipped so
          // only the parts over the tail show → they read as rings on the tail
          <G clipPath="url(#tailClip)" opacity={0.92}>
            <Path d="M1150 1240 L1240 1180" stroke={markColor} strokeWidth={34} strokeLinecap="butt" fill="none" />
            <Path d="M1230 1140 L1320 1080" stroke={markColor} strokeWidth={34} strokeLinecap="butt" fill="none" />
            <Path d="M1320 1030 L1410 985" stroke={markColor} strokeWidth={32} strokeLinecap="butt" fill="none" />
            <Path d="M1420 940 L1500 915" stroke={markColor} strokeWidth={30} strokeLinecap="butt" fill="none" />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}
