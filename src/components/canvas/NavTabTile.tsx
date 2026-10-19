import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { PupilNavTabDef } from '@/data/pupilNavTabs';

// Renderer przycisku nawigacji dla Navbaru Pupila (Faza §392) — sygnatura `(…, onPress,
// sizeStyle)` jak `IconTile.tsx`/`ShapeTile.tsx`. `tab=null` (niepodpięte, jak dowolny inny
// typ z `bindingKey`) rysuje placeholder z "?" — w EDYTORZE (`ScreenCanvas.tsx`) tapnięcie
// otwiera picker z 4 stałych opcji; w ŻYWYM navbarze (`PupilNavbar.tsx`'s custom-render
// ścieżka) taki item nigdy się nie pojawi, bo cała appka wraca do DOMYŚLNEGO navbaru, jeśli
// którykolwiek z 4 wymaganych tabów nie jest podpięty — patrz komentarz w `PupilNavbar.tsx`.
export function NavTabTile({ tab, active, onPress, sizeStyle }: {
  tab: PupilNavTabDef | null;
  active: boolean;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  if (!tab) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[sizeStyle, s.wrap, s.unbound]}>
        <Text style={s.unboundTxt}>?</Text>
      </TouchableOpacity>
    );
  }
  const Icon = tab.Icon;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[sizeStyle, s.wrap]}>
      <Icon size={active ? 26 : 22} color={active ? tab.accent : '#94A3B8'} strokeWidth={active ? 2.4 : 1.6} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  unbound: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#94A3B8', borderRadius: 12 },
  unboundTxt: { color: '#94A3B8', fontWeight: '800', fontSize: 16 },
});
