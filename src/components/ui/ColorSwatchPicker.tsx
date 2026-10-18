import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Plus, Check, RotateCcw, BookmarkPlus, Trash2, Pencil, X } from 'lucide-react-native';
import { useColorLibraryStore } from '@/store/colorLibraryStore';
import { normalizeHex } from '@/utils/color';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { usePressGuard } from '@/hooks/usePressGuard';

// Wspólny wybór koloru (Faza 23, 2026-10-17, §354) — user: "nie ma możliwości customowego
// koloru... dodaj bibliotekę kolorów gdzie moge dodawac kolory zeby miec do nich dostęp
// projektując inne kafelki". Zastępuje dotychczasowy, zaszyty na sztywno wiersz samych presetów
// (`TIER_COLOR_PRESETS.map(hex => <TouchableOpacity.../>)` w `dashboard-tile-creator.tsx`/
// `CanvasStreakStyleModal.tsx`, `RECORD_COLOR_PRESETS` w kreatorze) — DROP-IN, bierze te same
// `presets`/`current`/`onSelect`/opcjonalny `onReset`, więc podmiana istniejącego wiersza na
// ten komponent to jedna linijka, nie przepisywanie wołających.
//
// Presety (per typ kafla, np. 8 progów serii vs 6 akcentów Rekordów) ZOSTAJĄ osobne — to
// świadome, przemyślane domyślne palety. Biblioteka (`colorLibraryStore`) jest JEDNA, WSPÓLNA
// dla WSZYSTKICH wywołań tego komponentu w całej appce — kolor dodany przy jednym typie kafla
// jest od razu widoczny przy każdym innym.
export default function ColorSwatchPicker({ presets, current, onSelect, onReset }: {
  presets: string[];
  current: string;
  onSelect: (hex: string) => void;
  onReset?: () => void;
}) {
  const c = useColors();
  const s = makeS(c);
  const libraryColors = useColorLibraryStore(st => st.colors);
  const addColor = useColorLibraryStore(st => st.addColor);
  const removeColor = useColorLibraryStore(st => st.removeColor);
  const renameColor = useColorLibraryStore(st => st.renameColor);
  const [adding, setAdding] = useState(false);
  const [hexInput, setHexInput] = useState('');
  // Zmiana nazwy (audyt martwych funkcji, §377) — `renameColor` istniał w store od §354, ale
  // nigdy nie był podpięty do żadnego UI, a `name` nigdzie nie było ustawiane ani czytane.
  // Minimalne, realne zastosowanie: ustawiona nazwa staje się `accessibilityLabel` kółka
  // (dotąd czytnik ekranu nie miał ŻADNEJ etykiety na kolorach z biblioteki).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  // Tryb zarządzania biblioteką — długie przytrzymanie DOWOLNEGO koloru z biblioteki pokazuje
  // małe "🗑" na KAŻDYM z nich (nie tylko przytrzymanym), tap na "🗑" usuwa TEN konkretny.
  // Ten sam, prosty wzorzec co "tryb zaznaczania" na płótnie (§349) — osobny tryb zamiast
  // osobnego ekranu zarządzania biblioteką.
  const [manageMode, setManageMode] = useState(false);

  const normalized = normalizeHex(hexInput);
  // Zabezpieczenie przed podwójnym tapnięciem (§375, audyt) — `saveToLibrary` dodaje NOWY
  // wpis do biblioteki (`addColor`), szybkie podwójne tapnięcie dawało dwa identyczne kolory.
  const saveGuard = usePressGuard();

  const applyCustom = () => {
    if (!normalized) return;
    haptic.tap();
    onSelect(normalized);
    setHexInput('');
    setAdding(false);
  };
  const saveToLibrary = () => {
    if (!normalized || !saveGuard.allow()) return;
    haptic.success();
    addColor(normalized);
    onSelect(normalized);
    setHexInput('');
    setAdding(false);
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={s.swatchRow}>
        {presets.map(hex => (
          <TouchableOpacity key={hex} onPress={() => { haptic.tap(); onSelect(hex); }}
            style={[s.swatch, { backgroundColor: hex }, current.toUpperCase() === hex.toUpperCase() && s.swatchOn]} />
        ))}
        {libraryColors.length > 0 && <View style={s.divider} />}
        {libraryColors.map(lc => (
          <TouchableOpacity key={lc.id}
            accessibilityLabel={lc.name || `kolor ${lc.hex}`}
            onPress={() => { if (manageMode) return; haptic.tap(); onSelect(lc.hex); }}
            onLongPress={() => { haptic.medium(); setManageMode(v => !v); }}
            style={[s.swatch, { backgroundColor: lc.hex }, current.toUpperCase() === lc.hex.toUpperCase() && s.swatchOn]}>
            {manageMode && (
              <>
                <TouchableOpacity
                  onPress={() => { haptic.tap(); setManageMode(false); setRenamingId(lc.id); setNameInput(lc.name ?? ''); }}
                  style={s.renameBadge} hitSlop={6}>
                  <Pencil size={9} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { haptic.medium(); removeColor(lc.id); }} style={s.removeBadge} hitSlop={6}>
                  <Trash2 size={9} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => { haptic.tap(); setManageMode(false); setAdding(v => !v); }}
          style={[s.addSwatch, adding && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
          <Plus size={14} color={adding ? c.accent.blue : c.text.secondary} />
        </TouchableOpacity>
        {onReset && (
          <TouchableOpacity onPress={() => { haptic.tap(); onReset(); }} style={s.swatchReset}>
            <RotateCcw size={12} color={c.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {adding && (
        <View style={s.addRow}>
          <View style={[s.hexPreview, { backgroundColor: normalized ?? c.bg.elevated }]} />
          <TextInput
            value={hexInput} onChangeText={setHexInput} placeholder="#RRGGBB"
            placeholderTextColor={c.text.muted} autoCapitalize="characters" autoCorrect={false} maxLength={7}
            style={s.hexInput}
          />
          <TouchableOpacity onPress={applyCustom} disabled={!normalized} style={[s.hexBtn, { backgroundColor: c.accent.blue, opacity: normalized ? 1 : 0.4 }]}>
            <Check size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={saveToLibrary} disabled={!normalized} style={[s.hexBtn, s.hexBtnGhost, { opacity: normalized ? 1 : 0.4 }]}>
            <BookmarkPlus size={14} color={c.accent.blue} />
          </TouchableOpacity>
        </View>
      )}
      {renamingId && (
        <View style={s.addRow}>
          <View style={[s.hexPreview, { backgroundColor: libraryColors.find(lc => lc.id === renamingId)?.hex ?? c.bg.elevated }]} />
          <TextInput
            value={nameInput} onChangeText={setNameInput} placeholder="Nazwa koloru…"
            placeholderTextColor={c.text.muted} maxLength={30} autoFocus
            style={s.hexInput} returnKeyType="done"
            onSubmitEditing={() => { renameColor(renamingId, nameInput.trim()); setRenamingId(null); setNameInput(''); }}
          />
          <TouchableOpacity
            onPress={() => { haptic.success(); renameColor(renamingId, nameInput.trim()); setRenamingId(null); setNameInput(''); }}
            style={[s.hexBtn, { backgroundColor: c.accent.blue }]}>
            <Check size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setRenamingId(null); setNameInput(''); }} style={[s.hexBtn, s.hexBtnGhost]}>
            <X size={14} color={c.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
      {manageMode && (
        <Text style={s.manageHint}>Tryb zarządzania biblioteką — tapnij ✏️ żeby nazwać kolor, 🗑 żeby usunąć, tapnij "+" żeby wyjść.</Text>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.primary },
  swatchReset: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  addSwatch: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.default,
  },
  divider: { width: 1, height: 18, backgroundColor: c.border.subtle },
  removeBadge: {
    position: 'absolute', right: -4, top: -4, width: 14, height: 14, borderRadius: 7,
    backgroundColor: c.accent.red, alignItems: 'center', justifyContent: 'center',
  },
  renameBadge: {
    position: 'absolute', left: -4, top: -4, width: 14, height: 14, borderRadius: 7,
    backgroundColor: c.accent.blue, alignItems: 'center', justifyContent: 'center',
  },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hexPreview: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: c.border.default },
  hexInput: {
    flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary, backgroundColor: c.bg.elevated,
    borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, letterSpacing: 0.5,
  },
  hexBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hexBtnGhost: { backgroundColor: c.bg.elevated },
  manageHint: { fontSize: 10.5, color: c.text.muted, lineHeight: 14 },
}));
