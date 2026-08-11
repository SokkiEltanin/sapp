import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useHeroFont, HeroFont } from '@/store/heroFont';

// Title with a LIGHT gradient (accent washing in from the LEFT). Font family, size and
// line box come from the chosen preset; the user can additionally scale the size and
// nudge the position, and pick a custom-loaded font family.
export default function GradientGreeting({ text, baseColor, font }: { text: string; baseColor: string; font: HeroFont }) {
  const scale = useHeroFont(s => s.sizeScale);
  const offsetX = useHeroFont(s => s.offsetX);
  const offsetY = useHeroFont(s => s.offsetY);
  const customFamily = useHeroFont(s => s.customFamily);

  const label = font.upper ? text.toUpperCase() : text;
  // Shrink long greetings so they never clip (e.g. "DOBRY WIECZÓR" vs "DOBRANOC").
  const fit = label.length > 11 ? 11 / label.length : 1;
  const size = font.size * scale * fit;
  const baseY = font.baseY * scale + offsetY;
  const height = Math.ceil(font.height * scale) + Math.max(0, offsetY) + 6;
  return (
    <Svg height={height} width="100%">
      <Defs>
        <SvgLinearGradient id="greetGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"    stopColor={baseColor} stopOpacity="1" />
          <Stop offset="0.32" stopColor="#FFFFFF"   stopOpacity="0.97" />
          <Stop offset="1"    stopColor="#FFFFFF"   stopOpacity="0.86" />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x={offsetX}
        y={baseY}
        fontSize={size}
        fontWeight={font.weight as any}
        fontFamily={customFamily || font.family}
        fontStyle={font.italic ? 'italic' : 'normal'}
        fill="url(#greetGrad)"
        letterSpacing={font.spacing}
      >
        {label}
      </SvgText>
    </Svg>
  );
}
