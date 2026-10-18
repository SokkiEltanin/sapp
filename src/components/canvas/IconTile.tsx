import { View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import {
  Star, Heart, Flag, Target, Gift, Coffee, Music, Camera,
  Gamepad2, Dumbbell, Plane, Car, House, Briefcase, GraduationCap, Smile,
  Droplets, Moon, Sun, Bike, BookOpen, Zap, Flame, Trophy,
  Rocket, Bell, Calendar, Clock, MapPin, ShoppingBag, Wallet, PiggyBank,
  Leaf, Dog, Cat, Smartphone, Palette, PenTool, Sparkles, CloudRain,
  Image, Hash, Tag, Check, Lock,
} from 'lucide-react-native';
import { IconTileStyle, IconTileIconKey } from '@/store/iconTileStyleDefaults';

// Mapowanie klucz (kebab-case, `ICON_TILE_ICONS`) → realny komponent lucide — ten sam wzorzec
// co `ICON_MAP` w `habits.tsx` (tam: curated 8 ikon nawyków), tu: curated 45 ikon ogólnego
// przeznaczenia dla komponentu "Ikona" na płótnie (§371). Eksportowane dla
// `CanvasIconStyleModal.tsx`'s siatki wyboru — JEDEN punkt prawdy klucz→komponent.
export const ICON_TILE_MAP: Record<IconTileIconKey, React.ComponentType<any>> = {
  star: Star, heart: Heart, flag: Flag, target: Target, gift: Gift, coffee: Coffee, music: Music, camera: Camera,
  'gamepad-2': Gamepad2, dumbbell: Dumbbell, plane: Plane, car: Car, house: House, briefcase: Briefcase, 'graduation-cap': GraduationCap, smile: Smile,
  droplets: Droplets, moon: Moon, sun: Sun, bike: Bike, 'book-open': BookOpen, zap: Zap, flame: Flame, trophy: Trophy,
  rocket: Rocket, bell: Bell, calendar: Calendar, clock: Clock, 'map-pin': MapPin, 'shopping-bag': ShoppingBag, wallet: Wallet, 'piggy-bank': PiggyBank,
  leaf: Leaf, dog: Dog, cat: Cat, smartphone: Smartphone, palette: Palette, 'pen-tool': PenTool, sparkles: Sparkles, 'cloud-rain': CloudRain,
  image: Image, hash: Hash, tag: Tag, check: Check, lock: Lock,
};

// Renderer komponentu "Ikona" na płótnie (§371) — ta sama sygnatura `(style, onPress,
// sizeStyle)` co `ShapeTile`/`DataFieldTile`, więc `CanvasPlacedItem.tsx`'s `renderTile`
// render-prop obsługuje go identycznie bez zmian tam. BEZ podpięcia danych (jak kształty) —
// ikona JEST swoją treścią (wybrana z `ICON_TILE_ICONS`), nie reprezentuje nic z apki.
// `align` pozycjonuje ikonę w boxie w poziomie (`justify-content` na wrapperze) — `size` jest
// ABSOLUTNY w px (jak `TextShapeStyle.fontSize`), NIE skaluje się automatycznie z resize boxa
// jak SVG-kształty — user "skaluje" przez stepper w modalu stylu, box wokół niej jest czysto
// obszarem pozycjonowania/tła.
export function IconTile({ style, onPress, sizeStyle }: {
  style: IconTileStyle;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  const Icon = ICON_TILE_MAP[style.iconKey] ?? Star;
  const justify = style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center';
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: justify,
        paddingHorizontal: 8,
        backgroundColor: style.backgroundColor ?? 'transparent',
        borderRadius: style.backgroundColor ? style.cornerRadius : 0,
      }}>
        <Icon size={style.size} color={style.color} />
      </View>
    </TouchableOpacity>
  );
}
