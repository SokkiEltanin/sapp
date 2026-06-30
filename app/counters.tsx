import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, Hourglass, CalendarClock, Trash2, Pencil, Check, X, CalendarDays, RotateCcw } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import DatePickerField from '@/components/ui/DatePickerField';
import WalkProgress from '@/components/counters/WalkProgress';
import { useCounters, Counter, CounterKind, daysSince, daysUntil, untilProgress } from '@/store/countersStore';
import { useCalendarStore } from '@/store/calendarStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ACCENT = '#46B0DE';

const untilLabel = (n: number) => n > 1 ? `za ${n} dni` : n === 1 ? 'jutro!' : n === 0 ? 'dziś!' : 'minęło';
const sinceLabel = (n: number) => n === 0 ? 'dziś' : n === 1 ? '1 dzień temu' : `${n} dni temu`;

export default function Counters() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { counters, add, update, remove, resetSince } = useCounters();
  const { events, gcalEvents } = useCalendarStore();

  const [editing, setEditing] = useState<Counter | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CounterKind>('until');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [pickCal, setPickCal] = useState(false);

  const untils = counters.filter(x => x.kind === 'until').sort((a, b) => a.date.localeCompare(b.date));
  const sinces = counters.filter(x => x.kind === 'since').sort((a, b) => daysSince(b) - daysSince(a));

  const upcoming = useMemo(() => {
    const t = todayStr();
    return [...events, ...gcalEvents]
      .filter(e => (e.date ?? '') >= t && e.title)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 30);
  }, [events, gcalEvents]);

  const openAdd = () => { setEditing(null); setKind('until'); setName(''); setDate(''); setPickCal(false); setOpen(true); };
  const openEdit = (cn: Counter) => { setEditing(cn); setKind(cn.kind); setName(cn.name); setDate(cn.date); setPickCal(false); setOpen(true); };

  const canSave = name.trim() && date;
  const save = () => {
    if (!canSave) return;
    haptic.success();
    if (editing) update(editing.id, { name: name.trim(), date, kind });
    else add({ kind, name: name.trim(), date, startDate: kind === 'until' ? todayStr() : todayStr() });
    setOpen(false);
  };
  const del = (cn: Counter) => Alert.alert('Usunąć?', `„${cn.name}" zniknie.`, [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: () => { haptic.medium(); remove(cn.id); } },
  ]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Liczniki</Text>
        <PressableScale onPress={openAdd} style={s.backBtn}>
          <Plus size={22} color={ACCENT} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {counters.length === 0 && (
          <View style={s.empty}>
            <Hourglass size={32} color={c.text.muted} />
            <Text style={s.emptyText}>Dodaj odliczanie do eventu albo licznik „ile dni temu…".</Text>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: ACCENT }]} onPress={openAdd} activeOpacity={0.85}>
              <Plus size={16} color="#fff" /><Text style={s.addBtnText}>Dodaj pierwszy</Text>
            </TouchableOpacity>
          </View>
        )}

        {untils.length > 0 && <Text style={s.section}>Odliczania</Text>}
        {untils.map(cn => {
          const left = daysUntil(cn);
          const prog = untilProgress(cn);
          const done = left < 0;
          return (
            <View key={cn.id} style={s.card}>
              <View style={s.cardTop}>
                <CalendarClock size={15} color={ACCENT} />
                <Text style={s.cardName} numberOfLines={1}>{cn.name}</Text>
                <Text style={[s.cardBig, done && { color: c.text.muted }]}>{untilLabel(left)}</Text>
                <TouchableOpacity onPress={() => openEdit(cn)} hitSlop={8} style={s.iconBtn}><Pencil size={15} color={c.text.muted} /></TouchableOpacity>
                <TouchableOpacity onPress={() => del(cn)} hitSlop={8} style={s.iconBtn}><Trash2 size={15} color={c.accent.red} /></TouchableOpacity>
              </View>
              <WalkProgress progress={prog} color={ACCENT} />
              <Text style={s.cardMeta}>{cn.date}{!done && left > 1 ? ` · ${Math.round(prog * 100)}% drogi za Tobą` : ''}</Text>
            </View>
          );
        })}

        {sinces.length > 0 && <Text style={s.section}>Ile dni temu…</Text>}
        {sinces.map(cn => {
          const n = daysSince(cn);
          return (
            <View key={cn.id} style={s.card}>
              <View style={s.cardTop}>
                <RotateCcw size={15} color={ACCENT} />
                <Text style={s.cardName} numberOfLines={1}>{cn.name}</Text>
                <TouchableOpacity onPress={() => openEdit(cn)} hitSlop={8} style={s.iconBtn}><Pencil size={15} color={c.text.muted} /></TouchableOpacity>
                <TouchableOpacity onPress={() => del(cn)} hitSlop={8} style={s.iconBtn}><Trash2 size={15} color={c.accent.red} /></TouchableOpacity>
              </View>
              <View style={s.sinceRow}>
                <Text style={s.sinceBig}>{n}<Text style={s.sinceUnit}> {n === 1 ? 'dzień' : 'dni'}</Text></Text>
                <TouchableOpacity style={s.doneBtn} onPress={() => { haptic.tap(); resetSince(cn.id); }} activeOpacity={0.8}>
                  <Check size={13} color={ACCENT} /><Text style={[s.doneBtnText, { color: ACCENT }]}>Zrobione dziś</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.cardMeta}>ostatnio: {cn.date}</Text>
            </View>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Add / edit */}
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{editing ? 'Edytuj' : 'Nowy licznik'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
            </View>

            <View style={s.kindRow}>
              {([['until', 'Odliczanie', CalendarClock], ['since', 'Ile dni temu', RotateCcw]] as const).map(([k, lbl, Ic]) => {
                const active = kind === k;
                return (
                  <TouchableOpacity key={k} style={[s.kindBtn, active && { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}
                    onPress={() => { haptic.tap(); setKind(k); }} activeOpacity={0.8}>
                    <Ic size={15} color={active ? ACCENT : c.text.muted} />
                    <Text style={[s.kindText, active && { color: ACCENT }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput value={name} onChangeText={setName} placeholder={kind === 'until' ? 'np. Urodziny, Wyjazd…' : 'np. Wizyta u dentysty, Olej w aucie…'}
              placeholderTextColor={c.text.muted} style={s.input} />

            <Text style={s.fieldLabel}>{kind === 'until' ? 'Data wydarzenia' : 'Ostatnio zrobione'}</Text>
            <DatePickerField value={date} onChange={setDate} placeholder={kind === 'until' ? 'Wybierz datę' : 'Domyślnie dziś'} />

            {kind === 'until' && upcoming.length > 0 && (
              <>
                <TouchableOpacity style={s.calToggle} onPress={() => { haptic.tap(); setPickCal(v => !v); }} activeOpacity={0.8}>
                  <CalendarDays size={14} color={ACCENT} />
                  <Text style={[s.calToggleText, { color: ACCENT }]}>{pickCal ? 'Ukryj kalendarz' : 'Wybierz z kalendarza'}</Text>
                </TouchableOpacity>
                {pickCal && (
                  <View style={s.calList}>
                    {upcoming.map(e => (
                      <TouchableOpacity key={e.id} style={s.calItem} activeOpacity={0.7}
                        onPress={() => { haptic.tap(); setName(e.title); setDate((e.date ?? '').slice(0, 10)); setPickCal(false); }}>
                        <Text style={s.calItemDate}>{(e.date ?? '').slice(5)}</Text>
                        <Text style={s.calItemName} numberOfLines={1}>{e.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: ACCENT }, !canSave && { opacity: 0.4 }]} onPress={save} disabled={!canSave} activeOpacity={0.85}>
              <Check size={17} color="#fff" /><Text style={s.saveText}>{editing ? 'Zapisz' : 'Dodaj'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260, lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.full },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  section: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[3], marginBottom: spacing[2] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing[2] },
  cardName: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text.primary },
  cardBig: { fontSize: 13, fontWeight: '800', color: c.tabs?.day ?? '#46B0DE' },
  iconBtn: { padding: 3 },
  cardMeta: { fontSize: 11, color: c.text.muted, marginTop: 6 },

  sinceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sinceBig: { fontSize: 30, fontWeight: '900', color: c.text.primary, letterSpacing: -1 },
  sinceUnit: { fontSize: 15, fontWeight: '700', color: c.text.muted },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: '#46B0DE55', backgroundColor: '#46B0DE14' },
  doneBtnText: { fontSize: 12.5, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.bg.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[5], gap: spacing[2], paddingBottom: spacing[8] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  kindRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  kindBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary },
  kindText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  input: { backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 12, fontSize: 15, color: c.text.primary },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing[2] },
  calToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: spacing[1] },
  calToggleText: { fontSize: 12.5, fontWeight: '700' },
  calList: { gap: 2, maxHeight: 200 },
  calItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: spacing[2], borderRadius: radius.sm },
  calItemDate: { fontSize: 12, fontWeight: '800', color: '#46B0DE', width: 44 },
  calItemName: { flex: 1, fontSize: 13, color: c.text.secondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg, marginTop: spacing[3] },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
