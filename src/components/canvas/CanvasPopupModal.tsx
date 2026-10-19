import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { X, SquareStack, Pencil } from 'lucide-react-native';
import ScreenCanvas from './ScreenCanvas';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

// Tryb "Dane" edytora — popup z zagnieżdżonym płótnem (Faza §391, 2026-10-19) — user: "jak masz
// grupy itp to po kliknięciu co się ma wyświetlać, jak ekran popup to dostajesz drugie canvas
// obok z tym do zaprojektowania co ma się wyświetlić i muszę mieć możliwość kliknięcia danych
// [i] wyświetlenia ich w dowolny sposób". Każdy item na płótnie może dostać
// `onTapAction: 'openPopup'` (patrz `canvasComponentsStore.ts`) — ten modal to WSPÓLNA
// prezentacja TEGO popupu, w dwóch trybach:
// - `mode: 'view'` — tap na ŻYWYM ekranie (poza edycją). Czysta treść (`viewOnly` na
//   `ScreenCanvas`/`ScreenCanvasBase` chowa CAŁE chrome edytora — nagłówek/odznaki/picker po
//   tapnięciu itemów), user widzi TYLKO to, co sam zaprojektował.
// - `mode: 'edit'` — przycisk "Edytuj zawartość popupu" w panelu właściwości triggera. Zwykłe
//   `ScreenCanvas` BEZ `viewOnly` — pełny edytor (dodawanie kafli/kształtów, podpięcia danych,
//   style), DOKŁADNIE ten sam mechanizm co każdy inny ekran z płótnem — zero nowego kodu
//   renderowania, `screenKey = 'popup:' + itemId` to po prostu kolejna, niezależna
//   "podprzestrzeń" w TYM SAMYM `canvasComponentsStore.ts`.
//
// `GestureHandlerRootView` WEWNĄTRZ tego komponentu — ten sam, udokumentowany wcześniej fix co
// `ColorPickerPanel.tsx` (§388)/`MoodCheckInModal.tsx` (§162): `Gesture.Pan()` (przeciąganie/
// resize itemów w `mode: 'edit'`) wewnątrz zwykłego `Modal` wymaga WŁASNEGO roota, inaczej nigdy
// nie dostaje poprawnie zroutowanych dotknięć.
export default function CanvasPopupModal({ visible, itemId, mode, onClose }: {
  visible: boolean;
  itemId: string | null;
  mode: 'view' | 'edit';
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  if (!itemId) return null;
  const screenKey = `popup:${itemId}`;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.head}>
              {mode === 'edit' ? <Pencil size={16} color={c.accent.blue} /> : <SquareStack size={16} color={c.accent.blue} />}
              <Text style={s.title}>{mode === 'edit' ? 'Zawartość popupu' : 'Szczegóły'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing[4] }} showsVerticalScrollIndicator={false}>
              <ScreenCanvas screenKey={screenKey} title="Zawartość popupu" viewOnly={mode === 'view'} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeS = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%', backgroundColor: c.bg.secondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
});
