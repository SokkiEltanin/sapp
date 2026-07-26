import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, Hourglass, CalendarClock, Trash2, Pencil, Check, X, CalendarDays, RotateCcw, Ban, LayoutDashboard, Car, PersonStanding } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import DatePickerField from '@/components/ui/DatePickerField';
import WalkProgress from '@/components/counters/WalkProgress';
import StreakFlame, { streakColor } from '@/components/counters/StreakFlame';
import { WeekStrip } from '@/components/counters/StreakCard';
import { useCounters, Counter, daysSince, daysUntil, untilProgress, autoDaysWithout, AVOID_PRESETS, isDuringEvent, daysUntilEnd, isOver, eventProgress } from '@/store/countersStore';
import { WIDGET_TAGS } from '@/utils/statWidgets';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ACCENT = '#ECEEEE';   // mono (redesign czarno-biały)
const ON_ACCENT = '#12100F';   // ciemny tekst/ikona na białym akcencie
// Marker emojis for countdowns — the chosen one hops along the progress bar.
const EVENT_EMOJIS = ['🎂', '✈️', '🎁', '❤️', '🏖️', '🎄', '🎉', '🎓', '🏠', '🚗', '⚽', '🎸', '💍', '🍼', '🌸', '🎯', '🔥', '💸'];

const untilLabel = (n: number) => n > 1 ? `za ${n} dni` : n === 1 ? 'jutro!' : n === 0 ? 'dziś!' : 'minęło';
const sinceLabel = (n: number) => n === 0 ? 'dziś' : n === 1 ? '1 dzień temu' : `${n} dni temu`;

export default function Counters() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { counters, add, update, remove, resetSince } = useCounters();
  const { events, gcalEvents } = useCalendarStore();
  const { expenses } = useExpensesStore();

  type UiKind = 'until' | 'since' | 'avoid';
  const [editing, setEditing] = useState<Counter | null>(null);
  const [open, setOpen] = useState(false);
  const [uiKind, setUiKind] = useState<UiKind>('until');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');   // until: optional event-window end (trip)
  const [emoji, setEmoji] = useState('');       // until: hopping marker (blank = walker)
  const [keyword, setKeyword] = useState('');
  const [onDash, setOnDash] = useState(true);
  const [pickCal, setPickCal] = useState(false);

  const daysFor = (cn: Counter) => cn.mode === 'auto' ? autoDaysWithout(cn, expenses) : daysSince(cn);
  const untils = counters.filter(x => x.kind === 'until').sort((a, b) => a.date.localeCompare(b.date));
  const sinces = counters.filter(x => x.kind === 'since').sort((a, b) => daysFor(b) - daysFor(a));

  const upcoming = useMemo(() => {
    const t = todayStr();
    return [...events, ...gcalEvents]
      .filter(e => (e.date ?? '') >= t && e.title)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 10);
  }, [events, gcalEvents]);

  const openAdd = () => { setEditing(null); setUiKind('until'); setName(''); setDate(''); setEndDate(''); setEmoji(''); setKeyword(''); setOnDash(true); setPickCal(false); setOpen(true); };
  const openEdit = (cn: Counter) => {
    setEditing(cn);
    setUiKind(cn.mode === 'auto' ? 'avoid' : cn.kind === 'until' ? 'until' : 'since');
    setName(cn.name); setDate(cn.date); setEndDate(cn.endDate ?? ''); setEmoji(cn.emoji ?? ''); setKeyword(cn.keyword ?? ''); setOnDash(cn.onDashboard !== false); setPickCal(false); setOpen(true);
  };

  const canSave = !!name.trim() && (uiKind === 'avoid' ? !!keyword.trim() : !!date);
  const save = () => {
    if (!canSave) return;
    haptic.success();
    if (uiKind === 'avoid') {
      const patch = { kind: 'since' as const, mode: 'auto' as const, name: name.trim(), keyword: keyword.trim(), onDashboard: onDash };
      if (editing) update(editing.id, patch);
      else add({ ...patch, date: todayStr(), startDate: todayStr() });
    } else {
      const kind = uiKind as 'until' | 'since';
      const evEnd = (kind === 'until' && endDate && endDate >= date) ? endDate : undefined;
      const evEmoji = kind === 'until' ? (emoji || undefined) : undefined;
      const patch = { kind, name: name.trim(), date, endDate: evEnd, emoji: evEmoji, mode: undefined, keyword: undefined, onDashboard: onDash };
      if (editing) update(editing.id, patch);
      else add({ kind, name: name.trim(), date, endDate: evEnd, emoji: evEmoji, startDate: todayStr(), onDashboard: onDash });
    }
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
              <Plus size={16} color={ON_ACCENT} /><Text style={s.addBtnText}>Dodaj pierwszy</Text>
            </TouchableOpacity>
          </View>
        )}

        {untils.length > 0 && <Text style={s.section}>Odliczania</Text>}
        {untils.map(cn => {
          const during = isDuringEvent(cn);
          const over = isOver(cn);
          const left = daysUntil(cn);
          const endLeft = daysUntilEnd(cn);
          const prog = during ? eventProgress(cn) : untilProgress(cn);
          const bigLabel = over ? 'minęło'
            : during ? (endLeft > 1 ? `koniec za ${endLeft} dni` : endLeft === 1 ? 'ostatni dzień!' : 'kończy się dziś!')
            : untilLabel(left);
          const meta = during ? `w trakcie · wróć ${cn.endDate}`
            : cn.endDate && !over ? `${cn.date} → ${cn.endDate}${left > 1 ? ` · start za ${left} dni` : ''}`
            : `${cn.date}${!over && left > 1 ? ` · ${Math.round(prog * 100)}% drogi za Tobą` : ''}`;
          return (
            <View key={cn.id} style={s.card}>
              <View style={s.cardTop}>
                {during ? <Car size={16} color="#2AC68F" /> : <CalendarClock size={15} color={ACCENT} />}
                <Text style={s.cardName} numberOfLines={1}>{cn.name}</Text>
                <Text style={[s.cardBig, over && { color: c.text.muted }, during && { color: '#2AC68F' }]}>{bigLabel}</Text>
                <TouchableOpacity onPress={() => openEdit(cn)} hitSlop={8} style={s.iconBtn}><Pencil size={15} color={c.text.muted} /></TouchableOpacity>
                <TouchableOpacity onPress={() => del(cn)} hitSlop={8} style={s.iconBtn}><Trash2 size={15} color={c.accent.red} /></TouchableOpacity>
              </View>
              <WalkProgress progress={prog} color={during ? '#2AC68F' : ACCENT} mode={during ? 'drive' : 'walk'} emoji={cn.emoji} />
              <Text style={s.cardMeta}>{meta}</Text>
            </View>
          );
        })}

        {sinces.length > 0 && <Text style={s.section}>Ile dni temu / bez…</Text>}
        {sinces.map(cn => {
          const auto = cn.mode === 'auto';
          const n = daysFor(cn);
          return (
            <View key={cn.id} style={s.card}>
              <View style={s.cardTop}>
                {auto ? <Ban size={15} color={ACCENT} /> : <RotateCcw size={15} color={ACCENT} />}
                <Text style={s.cardName} numberOfLines={1}>{auto ? `bez ${cn.name}` : cn.name}</Text>
                {cn.onDashboard !== false && <LayoutDashboard size={13} color={c.text.muted} />}
                <TouchableOpacity onPress={() => openEdit(cn)} hitSlop={8} style={s.iconBtn}><Pencil size={15} color={c.text.muted} /></TouchableOpacity>
                <TouchableOpacity onPress={() => del(cn)} hitSlop={8} style={s.iconBtn}><Trash2 size={15} color={c.accent.red} /></TouchableOpacity>
              </View>
              <View style={s.sinceRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <StreakFlame days={n} size={42} />
                  <Text style={s.sinceUnit}>{n === 1 ? 'dzień' : 'dni'}</Text>
                </View>
                {!auto && (
                  <TouchableOpacity style={s.doneBtn} onPress={() => { haptic.tap(); resetSince(cn.id); }} activeOpacity={0.8}>
                    <Check size={13} color={ACCENT} /><Text style={[s.doneBtnText, { color: ACCENT }]}>Zrobione dziś</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ marginTop: spacing[3] }}><WeekStrip days={n} color={streakColor(n)} /></View>
              <Text style={s.cardMeta}>{auto ? 'liczy się automatycznie z paragonów' : `ostatnio: ${cn.date}`}</Text>
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

            <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.kindRow}>
              {([['until', 'Odliczanie', CalendarClock], ['since', 'Dni temu', RotateCcw], ['avoid', 'Dni bez', Ban]] as const).map(([k, lbl, Ic]) => {
                const active = uiKind === k;
                return (
                  <TouchableOpacity key={k} style={[s.kindBtn, active && { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}
                    onPress={() => { haptic.tap(); setUiKind(k); }} activeOpacity={0.8}>
                    <Ic size={15} color={active ? ACCENT : c.text.muted} />
                    <Text style={[s.kindText, active && { color: ACCENT }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput value={name} onChangeText={setName}
              placeholder={uiKind === 'until' ? 'np. Urodziny, Wyjazd…' : uiKind === 'avoid' ? 'np. słodyczy, papierosów…' : 'np. Wizyta u dentysty…'}
              placeholderTextColor={c.text.muted} style={s.input} />

            {uiKind === 'avoid' ? (
              <>
                {/* Pick from YOUR tags — the counter then catches every receipt item with
                    that tag. Beats the fixed presets (alcohol/energy you don't buy). */}
                <Text style={s.fieldLabel}>Śledź po tagach (łapie produkty z paragonów)</Text>
                <View style={s.presetRow}>
                  {WIDGET_TAGS.map(tag => {
                    const parts = keyword.split('|').map(x => x.trim()).filter(Boolean);
                    const active = parts.includes(tag);
                    return (
                      <TouchableOpacity key={tag} style={[s.presetChip, active && { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}
                        onPress={() => {
                          haptic.tap();
                          const next = active ? parts.filter(x => x !== tag) : [...parts, tag];
                          setKeyword(next.join('|'));
                          if (!name.trim() && !active) setName(tag);
                        }} activeOpacity={0.8}>
                        <Text style={[s.presetText, active && { color: ACCENT }]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.fieldLabel}>…lub gotowe zestawy</Text>
                <View style={s.presetRow}>
                  {AVOID_PRESETS.map(p => {
                    const active = keyword === p.keyword;
                    return (
                      <TouchableOpacity key={p.key} style={[s.presetChip, active && { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}
                        onPress={() => { haptic.tap(); setKeyword(p.keyword); if (!name.trim()) setName(p.label); }} activeOpacity={0.8}>
                        <Text style={[s.presetText, active && { color: ACCENT }]}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.fieldLabel}>…lub własne słowa (oddziel znakiem |)</Text>
                <TextInput value={keyword} onChangeText={setKeyword} placeholder="np. cola|fanta|sprite" placeholderTextColor={c.text.muted} style={s.input} autoCapitalize="none" />
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>{uiKind === 'until' ? 'Data wydarzenia' : 'Ostatnio zrobione'}</Text>
                <DatePickerField value={date} onChange={setDate} placeholder={uiKind === 'until' ? 'Wybierz datę' : 'Domyślnie dziś'} />
                {uiKind === 'until' && (
                  <>
                    <Text style={s.fieldLabel}>Koniec wyjazdu (opcjonalnie)</Text>
                    <DatePickerField value={endDate} onChange={setEndDate} placeholder="Bez okresu — tylko odliczanie" />
                    {!!endDate && endDate < date && <Text style={s.warnText}>Koniec musi być po dacie wydarzenia.</Text>}
                    {!!endDate && endDate >= date && <Text style={s.hintTextSm}>W trakcie wyjazdu pojedzie samochodzik i pokaże ile dni do końca.</Text>}
                  </>
                )}
                {uiKind === 'until' && upcoming.length > 0 && (
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
              </>
            )}

            {uiKind === 'until' && (
              <>
                <Text style={s.fieldLabel}>Ikonka na pasku (skacze do celu)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.emojiRow} keyboardShouldPersistTaps="handled">
                  <TouchableOpacity style={[s.emojiChip, !emoji && s.emojiChipOn]} onPress={() => { haptic.tap(); setEmoji(''); }} activeOpacity={0.8}>
                    <PersonStanding size={18} color={!emoji ? ACCENT : c.text.muted} />
                  </TouchableOpacity>
                  {EVENT_EMOJIS.map(em => (
                    <TouchableOpacity key={em} style={[s.emojiChip, emoji === em && s.emojiChipOn]} onPress={() => { haptic.tap(); setEmoji(em); }} activeOpacity={0.8}>
                      <Text style={s.emojiChar}>{em}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={s.dashToggle} onPress={() => { haptic.tap(); setOnDash(v => !v); }} activeOpacity={0.8}>
              <LayoutDashboard size={15} color={onDash ? ACCENT : c.text.muted} />
              <Text style={[s.dashToggleText, onDash && { color: ACCENT }]}>Pokaż na dashboardzie</Text>
              <View style={[s.checkbox, onDash && { backgroundColor: ACCENT, borderColor: ACCENT }]}>{onDash && <Check size={12} color={ON_ACCENT} />}</View>
            </TouchableOpacity>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: ACCENT }, !canSave && { opacity: 0.4 }]} onPress={save} disabled={!canSave} activeOpacity={0.85}>
              <Check size={17} color={ON_ACCENT} /><Text style={s.saveText}>{editing ? 'Zapisz' : 'Dodaj'}</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260, lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.full },
  addBtnText: { color: ON_ACCENT, fontWeight: '800', fontSize: 14 },

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
  // maxHeight + inner ScrollView so a long form (calendar picker + emoji row) scrolls
  // instead of spilling its list over the Save button (the old "chaos").
  sheet: { backgroundColor: c.bg.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing[5], paddingTop: spacing[5], maxHeight: '90%' },
  sheetScroll: { marginHorizontal: -spacing[1] },
  sheetScrollContent: { gap: spacing[2], paddingBottom: spacing[8], paddingHorizontal: spacing[1] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  kindRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  kindBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary },
  kindText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  input: { backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 12, fontSize: 15, color: c.text.primary },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing[2] },
  warnText: { fontSize: 11.5, color: c.accent.red, marginTop: 4, fontWeight: '600' },
  hintTextSm: { fontSize: 11.5, color: '#2AC68F', marginTop: 4, fontWeight: '600' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
  presetChip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary },
  presetText: { fontSize: 12.5, fontWeight: '600', color: c.text.secondary },
  dashToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3], paddingVertical: spacing[2] },
  dashToggleText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: c.text.secondary },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  calToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: spacing[1] },
  calToggleText: { fontSize: 12.5, fontWeight: '700' },
  calList: { gap: 2, overflow: 'hidden' },
  emojiRow: { flexDirection: 'row', gap: spacing[2], paddingVertical: spacing[1], paddingRight: spacing[2] },
  emojiChip: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary, alignItems: 'center', justifyContent: 'center' },
  emojiChipOn: { backgroundColor: ACCENT + '22', borderColor: ACCENT },
  emojiChar: { fontSize: 22 },
  calItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: spacing[2], borderRadius: radius.sm },
  calItemDate: { fontSize: 12, fontWeight: '800', color: '#46B0DE', width: 44 },
  calItemName: { flex: 1, fontSize: 13, color: c.text.secondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg, marginTop: spacing[3] },
  saveText: { color: ON_ACCENT, fontWeight: '800', fontSize: 15 },
}));
