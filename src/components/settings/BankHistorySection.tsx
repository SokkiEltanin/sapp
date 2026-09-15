import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { History, Trash2, ChevronDown, ArrowLeftRight, ArrowDownCircle, Briefcase } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { useBankQueue, BankIngestHistoryEntry } from '@/store/bankQueueStore';
import { CATEGORY_META } from '@/utils/categories';

function fmtWhen(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `dziś ${time}`;
  return `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function sourceLabel(src?: 'template' | 'learned' | 'guess'): string | null {
  if (src === 'template') return 'wg szablonu';
  if (src === 'learned') return 'nauczony sklep';
  if (src === 'guess') return 'zgadywane';
  return null;
}

// Wygląd i kolor wiersza (2026-09-15, user: "dodajmy informacje itp zeby szablony
// przepisywała do kategorii i tagow") — pokazuje wprost SKĄD wzięła się kategoria
// (szablon / nauczony sklep / zgadywane), nie tylko samą kategorię, żeby było widać że
// szablony faktycznie działają.
function rowMeta(entry: BankIngestHistoryEntry): { label: string; color: string; Icon: any } {
  if (entry.category === 'transfer') return { label: 'Przelew własny', color: '#55B4FF', Icon: ArrowLeftRight };
  if (entry.direction === 'in') {
    return entry.jd
      ? { label: 'Wypłata', color: '#43D98F', Icon: Briefcase }
      : { label: 'Przychód', color: '#43D98F', Icon: ArrowDownCircle };
  }
  const meta = CATEGORY_META[entry.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.other;
  const Icon = (LucideIcons as any)[meta.icon] ?? LucideIcons.CircleDollarSign;
  return { label: meta.label, color: meta.color, Icon };
}

// Historia odczytów (2026-09-15, user dwukrotnie: "dodajmy historie zczytywania tutaj...
// żeby szablony przepisywała do kategorii i tagow") — log tego co realnie odczytał
// `bankIngest.ts` z powiadomień banku, niezależny od `pending` (który znika po
// zatwierdzeniu). Patrz `bankQueueStore.history` — capped, tylko do wglądu, nic go z
// powrotem nie czyta przy księgowaniu.
export default function BankHistorySection() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const history = useBankQueue(st => st.history);
  const clearHistory = useBankQueue(st => st.clearHistory);
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <View style={[s.row, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
      <View style={s.header}>
        <History size={14} color={c.text.secondary} />
        <Text style={s.title}>Historia odczytów</Text>
      </View>
      <Text style={s.sub}>
        Ostatnie powiadomienia z banku, które apka rozpoznała i dodała do kolejki — z jaką kategorią/tagami i skąd (szablon, nauczony sklep czy zgadywane). Tylko na tym urządzeniu.
      </Text>

      {history.length === 0 ? (
        <Text style={s.empty}>Jeszcze nic nie odczytano.</Text>
      ) : (
        <>
          <View style={s.list}>
            {(showAll ? history : history.slice(0, 6)).map((entry, i) => {
              const { label, color, Icon } = rowMeta(entry);
              const src = sourceLabel(entry.matchedSource);
              const sign = entry.direction === 'in' ? '+' : '−';
              return (
                <View key={entry.id} style={[s.entryRow, i > 0 && s.entryRowBorder]}>
                  <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                    <Icon size={15} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryStore} numberOfLines={1}>{entry.store || '(bez nazwy)'}</Text>
                    <Text style={s.entryDetail} numberOfLines={1}>
                      {label}{entry.tags?.length ? ` · ${entry.tags.join(', ')}` : ''}{src ? ` · ${src}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.entryAmount, { color }]}>{sign}{entry.amount.toFixed(2)} {entry.currency}</Text>
                    <Text style={s.entryWhen}>{fmtWhen(entry.at)}{entry.auto ? ' · auto' : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          {history.length > 6 && (
            <PressableScale onPress={() => { haptic.tap(); setShowAll(v => !v); }}>
              <View style={s.moreRow}>
                <Text style={s.moreText}>{showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${history.length})`}</Text>
                <ChevronDown size={14} color={c.text.muted} style={showAll ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </View>
            </PressableScale>
          )}
          <PressableScale onPress={() => { haptic.tap(); setConfirmClear(true); }}>
            <View style={s.clearBtn}>
              <Trash2 size={13} color={c.text.muted} />
              <Text style={s.clearText}>Wyczyść historię</Text>
            </View>
          </PressableScale>
        </>
      )}

      <ConfirmDialog
        visible={confirmClear}
        title="Wyczyścić historię odczytów?"
        message="Lista rozpoznanych powiadomień zniknie. Zapisanych szablonów i wydatków to nie dotyczy."
        confirmLabel="Wyczyść"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { setConfirmClear(false); clearHistory(); haptic.medium(); toast.success('Historia odczytów wyczyszczona'); }}
      />
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  row: {
    padding: spacing[4],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.bodySmall, fontWeight: '700', color: c.text.primary },
  sub: { fontSize: 12, color: c.text.muted, lineHeight: 17 },
  empty: { fontSize: 12, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  entryRowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  iconWrap: {
    width: 28, height: 28, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  entryStore: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  entryDetail: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  entryAmount: { fontSize: 13, fontWeight: '800' },
  entryWhen: { fontSize: 10, color: c.text.muted, marginTop: 1 },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[1] },
  moreText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  clearText: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
}));
