import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Sparkles, X, Copy, LayoutTemplate, Square } from 'lucide-react-native';
import { CANVAS_TEMPLATES } from '@/data/canvasTemplates';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

// Wspólny "jak zaczynamy?" picker startu projektu (§409, 2026-10-21) — WYDZIELONY z
// `EditorProjectsList` (app/settings.tsx), bo teraz ma DWA miejsca wywołania: tam (gdy draft
// jest pusty — bez potwierdzenia, nic do stracenia) i nowy przycisk "Zacznij od nowa" w
// `canvas-draft-editor.tsx` (gdy draft NIE jest pusty — za potwierdzeniem w ConfirmDialog
// PRZED otwarciem tego modala, bo każda z trzech opcji zakłada czysty draft).
//
// User, po tym jak opisał niespójność między ekranami: "wybieram ZDROWIE → pokazuje mi się że
// miałem już projekt zaczęty (mogę go wybrać lub pusty kanwas lub aktualną zakładkę do
// edycji)" — TRZY równoprawne sposoby startu. "Kopiuj aktualny ekran" to NOWA, trzecia opcja
// (dotąd było tylko szablon/pusty) — `hasLiveContent=false` chowa ją (CLAUDE.md #7, nie
// zostawiaj martwej opcji, która skopiowałaby zero itemów).
export default function CanvasStartChooserModal({ visible, hasLiveContent, onClose, onPickLive, onPickTemplate, onPickEmpty }: {
  visible: boolean;
  hasLiveContent: boolean;
  onClose: () => void;
  onPickLive: () => void;
  onPickTemplate: (templateId: string) => void;
  onPickEmpty: () => void;
}) {
  const c = useColors();
  const s = makeS(c);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Sparkles size={16} color={c.accent.blue} />
            <Text style={s.title}>Jak zaczynamy?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <Text style={s.hint}>To tylko punkt startowy — dalej zawsze możesz wszystko przestawić.</Text>

          {hasLiveContent && (
            <TouchableOpacity onPress={onPickLive} style={s.row} activeOpacity={0.8}>
              <View style={[s.rowIcon, { backgroundColor: c.accent.blue + '18' }]}>
                <Copy size={15} color={c.accent.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Kopiuj aktualny ekran</Text>
                <Text style={s.rowSub}>Zacznij od tego, co jest TERAZ wdrożone — dalej tylko dostrajasz.</Text>
              </View>
            </TouchableOpacity>
          )}

          {CANVAS_TEMPLATES.map(t => (
            <TouchableOpacity key={t.id} onPress={() => onPickTemplate(t.id)} style={s.row} activeOpacity={0.8}>
              <View style={[s.rowIcon, { backgroundColor: c.accent.purple + '18' }]}>
                <LayoutTemplate size={15} color={c.accent.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{t.label}</Text>
                <Text style={s.rowSub}>{t.description}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={onPickEmpty} style={[s.row, s.rowGhost]} activeOpacity={0.8}>
            <View style={[s.rowIcon, { backgroundColor: c.bg.elevated }]}>
              <Square size={15} color={c.text.muted} />
            </View>
            <Text style={[s.rowLabel, { color: c.text.secondary }]}>Pusty canvas</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[6] },
  card: {
    width: '100%', maxWidth: 420, borderRadius: radius.xl, borderWidth: 1, padding: spacing[4], gap: spacing[2],
    backgroundColor: c.bg.secondary, borderColor: c.border.default,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  hint: { fontSize: 12, lineHeight: 16, marginBottom: spacing[1], color: c.text.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card,
    padding: spacing[3],
  },
  rowGhost: { backgroundColor: 'transparent' },
  rowIcon: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  rowSub: { fontSize: 11, lineHeight: 15, color: c.text.muted, marginTop: 1 },
}));
