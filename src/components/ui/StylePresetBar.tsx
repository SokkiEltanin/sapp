import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Plus, Check, BookmarkPlus, Trash2 } from 'lucide-react-native';
import { useTileStylePresetsStore, presetsForFamily, StylePresetFamily } from '@/store/tileStylePresetsStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { usePressGuard } from '@/hooks/usePressGuard';

// Presety stylu (§370) — korelacja Kreator ↔ płótno: ten sam, dropuj-i-gotowe komponent w obu
// miejscach dla danej `family` ('streak'/'countdown'/'notes' — patrz `tileStylePresetsStore.ts`
// dla pełnego wyjaśnienia zakresu). Ten sam UX co `ColorSwatchPicker` (§354) — chip zamiast
// kółka koloru, tap aplikuje CAŁY zapisany styl (`onApply`, partial-merge po stronie wołającego,
// jak każdy `onChange`/`setDraft` w tym systemie), długie przytrzymanie wchodzi w tryb
// zarządzania (🗑 na każdym chipie), "+" otwiera pole na nazwę i zapisuje PRZEKAZANY `style`
// (aktualny draft/instancja w momencie zapisu, nie jakiś wybrany wcześniej stan).
export default function StylePresetBar({ family, style, onApply }: {
  family: StylePresetFamily;
  style: Record<string, unknown>;
  onApply: (style: Record<string, unknown>) => void;
}) {
  const c = useColors();
  const s = makeS(c);
  // FIX (§374, realny crash na urządzeniu — "Maximum update depth exceeded") — selektor
  // `st => presetsForFamily(st.presets, family)` zwracał NOWĄ tablicę (`.filter()`) przy
  // KAŻDYM wywołaniu, więc `useSyncExternalStore`/Zustand nigdy nie widział tej samej
  // referencji dwa razy — nieskończona pętla re-renderów (`forceStoreRerender`/
  // `updateStoreInstance` w stack trace to dokładnie ten mechanizm). Fix: selektor zwraca
  // SUROWĄ, stabilną referencję (`st.presets` — zmienia się TYLKO gdy `addPreset`/
  // `removePreset`/`renamePreset` faktycznie mutują stan), filtr po `family` przeniesiony do
  // `useMemo` w ciele komponentu — ten sam wzorzec co `ScreenCanvas.tsx`'s `myItems`/
  // `orderedItems` (selektor surowy ze store'u, filtr/sort osobno, zmemoizowany).
  const allPresets = useTileStylePresetsStore(st => st.presets);
  const presets = useMemo(() => presetsForFamily(allPresets, family), [allPresets, family]);
  const addPreset = useTileStylePresetsStore(st => st.addPreset);
  const removePreset = useTileStylePresetsStore(st => st.removePreset);
  const [adding, setAdding] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [manageMode, setManageMode] = useState(false);

  const trimmed = nameInput.trim();
  // Zabezpieczenie przed podwójnym tapnięciem (§375, audyt) — `if (!trimmed) return` chroni
  // TYLKO przed pustą nazwą, nie przed dwoma tapnięciami zanim `setNameInput('')` zdąży się
  // przerenderować (szybkie podwójne tapnięcie "Zapisz" → dwa identyczne presety).
  const saveGuard = usePressGuard();
  const save = () => {
    if (!trimmed || !saveGuard.allow()) return;
    haptic.success();
    addPreset(family, trimmed, style);
    setNameInput('');
    setAdding(false);
  };

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={s.row}>
        {presets.map(p => (
          <TouchableOpacity key={p.id}
            onPress={() => { if (manageMode) return; haptic.tap(); onApply(p.style); }}
            onLongPress={() => { haptic.medium(); setManageMode(v => !v); }}
            style={s.chip}>
            <Text style={s.chipText} numberOfLines={1}>{p.name}</Text>
            {manageMode && (
              <TouchableOpacity onPress={() => { haptic.medium(); removePreset(p.id); }} style={s.removeBadge} hitSlop={6}>
                <Trash2 size={9} color="#fff" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => { haptic.tap(); setManageMode(false); setAdding(v => !v); }}
          style={[s.addChip, adding && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
          <Plus size={13} color={adding ? c.accent.blue : c.text.secondary} />
          <Text style={[s.addChipText, adding && { color: c.accent.blue }]}>Zapisz jako preset</Text>
        </TouchableOpacity>
      </View>

      {adding && (
        <View style={s.addRow}>
          <BookmarkPlus size={14} color={c.text.secondary} />
          <TextInput
            value={nameInput} onChangeText={setNameInput} placeholder="Nazwa presetu…"
            placeholderTextColor={c.text.muted} maxLength={30} autoFocus
            style={s.nameInput} onSubmitEditing={save} returnKeyType="done"
          />
          <TouchableOpacity onPress={save} disabled={!trimmed} style={[s.saveBtn, { backgroundColor: c.accent.blue, opacity: trimmed ? 1 : 0.4 }]}>
            <Check size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {manageMode && (
        <Text style={s.manageHint}>Tryb zarządzania presetami — tapnij 🗑 żeby usunąć, tapnij "Zapisz jako preset" żeby wyjść.</Text>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: c.text.primary },
  removeBadge: {
    width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.accent.red, marginLeft: 2,
  },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.default,
  },
  addChipText: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameInput: {
    flex: 1, fontSize: 13, fontWeight: '600', color: c.text.primary, backgroundColor: c.bg.elevated,
    borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6,
  },
  saveBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  manageHint: { fontSize: 10.5, color: c.text.muted, lineHeight: 14 },
}));
