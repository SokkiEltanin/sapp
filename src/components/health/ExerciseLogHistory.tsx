import { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Pencil, Trash2, Check } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { ExerciseLogEntry } from '@/utils/personalQuests';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Historia wpisów dnia — edycja/usuwanie (2026-10-14, user: "nawet nie mają edycji klikną
// źle i pizda"). Do tej pory `exercisesStore.removeLog` istniał, ale nic w UI go nie wołało —
// pomyłka w ilości (literówka, zły quick-add) była nie do cofnięcia bez grzebania w kodzie.
// Współdzielony przez ekran Ćwiczenia, Dzisiejszą sesję planu I kalendarz historii
// (app/exercises-history.tsx, 2026-10-15) — JEDNO miejsce z listą/edycją/usuwaniem wpisów.
//
// `resolveLabel` (2026-10-15, kalendarz historii) — widok JEDNEGO dnia może mieć wpisy z
// RÓŻNYCH ćwiczeń naraz (różne jednostki), w przeciwieństwie do ekranu Ćwiczenia/sesji gdzie
// `entries` zawsze dotyczy jednego klucza i `unit` wystarcza. Gdy podane, pokazuje nazwę
// ćwiczenia przy każdym wpisie i czyta jednostkę PER WPIS zamiast jednej wspólnej.
export default function ExerciseLogHistory({ entries, unit, resolveLabel, onUpdate, onDelete }: {
  entries: ExerciseLogEntry[]; unit?: string;
  resolveLabel?: (exercise: string) => { label: string; unit: string };
  onUpdate: (id: string, amount: number) => void;
  onDelete: (id: string) => void;
}) {
  const c = useColors();
  const s = makeS(c);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sorted.length === 0) {
    return <Text style={s.empty}>Brak wpisów.</Text>;
  }

  const startEdit = (entry: ExerciseLogEntry) => {
    haptic.tap();
    setEditingId(entry.id);
    setDraft(String(entry.amount));
  };
  const confirmEdit = (id: string) => {
    const amount = parseFloat(draft.replace(',', '.'));
    if (!draft || isNaN(amount) || amount <= 0) return;
    onUpdate(id, amount);
    setEditingId(null);
  };

  return (
    <View style={s.wrap}>
      {sorted.map((entry) => {
        const time = new Date(entry.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        const editing = editingId === entry.id;
        const resolved = resolveLabel ? resolveLabel(entry.exercise) : null;
        const rowUnit = resolved ? resolved.unit : (unit ?? '');
        return (
          <View key={entry.id} style={s.row}>
            <Text style={s.time}>{time}</Text>
            {editing ? (
              <>
                <TextInput
                  style={s.editInput}
                  keyboardType="numeric"
                  autoFocus
                  value={draft}
                  onChangeText={setDraft}
                />
                <PressableScale onPress={() => confirmEdit(entry.id)} style={s.iconBtn}>
                  <Check size={14} color="#2AC68F" />
                </PressableScale>
              </>
            ) : (
              <>
                <Text style={s.amount} numberOfLines={1}>
                  {resolved && <Text style={s.amountLabel}>{resolved.label}: </Text>}
                  +{entry.amount} {rowUnit}
                </Text>
                <PressableScale onPress={() => startEdit(entry)} style={s.iconBtn}>
                  <Pencil size={13} color={c.text.muted} />
                </PressableScale>
              </>
            )}
            <PressableScale onPress={() => { haptic.tap(); onDelete(entry.id); if (editing) setEditingId(null); }} style={s.iconBtn}>
              <Trash2 size={13} color="#EF4444" />
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  wrap: { gap: 4, paddingTop: 2 },
  empty: { fontSize: 11.5, color: c.text.muted, paddingVertical: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  time: { fontSize: 11, color: c.text.muted, width: 40 },
  amount: { flex: 1, fontSize: 12.5, fontWeight: '700', color: c.text.secondary },
  amountLabel: { fontWeight: '800', color: c.text.primary },
  editInput: {
    flex: 1, backgroundColor: c.bg.elevated, borderRadius: radius.sm, borderWidth: 1,
    borderColor: c.border.default, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12.5, color: c.text.primary,
  },
  iconBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
}));
