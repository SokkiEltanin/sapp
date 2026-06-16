import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, Plus, X, Car, Bike, Trash2, Droplet, Snowflake, Sun,
  Fuel, Wrench, ChevronDown, ChevronUp, Check, Link2, CalendarClock, Package,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import DatePickerField from '@/components/ui/DatePickerField';
import { vehiclesService } from '@/services/vehiclesService';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { weatherService } from '@/services/weatherService';
import { Vehicle, VehicleKind, Expense } from '@/types';
import { summarizeVehicle, oilDueMonths, expenseMatchesVehicle } from '@/utils/vehicleMatch';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { colors, spacing, radius, typography } from '@/theme';

const ACCENT = '#55B4FF';

const KIND_META: Record<VehicleKind, { label: string; Icon: any }> = {
  car:        { label: 'Samochód',  Icon: Car },
  bike:       { label: 'Rower',     Icon: Bike },
  motorcycle: { label: 'Motocykl',  Icon: Bike },
  scooter:    { label: 'Hulajnoga', Icon: Bike },
  other:      { label: 'Inny',      Icon: Car },
};
const KINDS: VehicleKind[] = ['car', 'bike', 'motorcycle', 'scooter', 'other'];
const COLORS = ['#55B4FF', '#2AC68F', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#E43434'];

function slugTag(name: string): string {
  return name.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-ząćęłńóśźż0-9]/gi, '') ?? '';
}
function zl(n: number) { return `${Math.round(n)} zł`; }

interface FormState {
  name: string; kind: VehicleKind; tag: string; color: string;
  oilChangeDate: string; oilIntervalMonths: string;
  tireSeason: 'summer' | 'winter' | 'allseason';
}
const emptyForm = (): FormState => ({
  name: '', kind: 'car', tag: '', color: COLORS[0],
  oilChangeDate: '', oilIntervalMonths: '12', tireSeason: 'allseason',
});

export default function VehiclesScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { expenses, setExpenses, updateExpense } = useExpensesStore();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [todayCold, setTodayCold] = useState(false);
  const [todaySnow, setTodaySnow] = useState(false);

  // Add/edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<Vehicle | null>(null);
  const [form, setForm]         = useState<FormState>(emptyForm);
  const [saving, setSaving]     = useState(false);

  // Attach-existing-expense picker
  const [pickerFor, setPickerFor] = useState<Vehicle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setVehicles(await vehiclesService.getAll()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {}); }, []);
  useEffect(() => {
    weatherService.getWeather().then(days => {
      const today = days[days.length - 1];
      if (today) { setTodayCold(today.tempMin <= 2); setTodaySnow(today.icon === 'snowflake'); }
    }).catch(() => {});
  }, []);

  const sole = vehicles.length === 1;
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      name: v.name, kind: v.kind, tag: v.tag, color: v.color,
      oilChangeDate: v.oilChangeDate?.slice(0, 10) ?? '',
      oilIntervalMonths: v.oilIntervalMonths ? String(v.oilIntervalMonths) : '12',
      tireSeason: v.tireSeason ?? 'allseason',
    });
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.name.trim()) { Alert.alert('Błąd', 'Podaj nazwę pojazdu'); return; }
    setSaving(true);
    const tag = (form.tag.trim() || slugTag(form.name)).toLowerCase();
    const payload: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> = {
      name: form.name.trim(), kind: form.kind, tag, color: form.color,
      oilChangeDate: form.oilChangeDate || undefined,
      oilIntervalMonths: form.oilIntervalMonths ? parseInt(form.oilIntervalMonths) : undefined,
      tireSeason: form.tireSeason,
    };
    try {
      if (editing) { await vehiclesService.update(editing.id, payload); }
      else { await vehiclesService.add(payload); }
      haptic.success();
      setFormOpen(false);
      await load();
      toast.success(editing ? 'Zapisano pojazd' : 'Dodano pojazd');
    } catch { haptic.error(); toast.error('Nie zapisano — sprawdź połączenie'); }
    finally { setSaving(false); }
  };

  const removeVehicle = (v: Vehicle) => {
    Alert.alert('Usuń pojazd', `Usunąć „${v.name}"? Wydatki zostaną, tylko przestaną być przypisane.`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => {
        haptic.medium();
        await vehiclesService.remove(v.id).catch(() => {});
        setVehicles(prev => prev.filter(x => x.id !== v.id));
        toast.info('Usunięto');
      } },
    ]);
  };

  const markOilChanged = async (v: Vehicle) => {
    haptic.tap();
    const today = new Date().toISOString();
    await vehiclesService.update(v.id, { oilChangeDate: today }).catch(() => {});
    setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, oilChangeDate: today } : x));
    toast.success('Zapisano wymianę oleju');
  };

  const attachExpense = async (v: Vehicle, e: Expense) => {
    haptic.tap();
    updateExpense(e.id, { vehicleId: v.id });
    setPickerFor(null);
    try { await expensesService.update(e.id, { vehicleId: v.id }); toast.success('Przypisano wydatek'); }
    catch { toast.error('Nie przypisano — sprawdź połączenie'); }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={20} color={c.text.secondary} />
        </TouchableOpacity>
        <Text style={s.title}>Pojazdy</Text>
        <PressableScale onPress={() => { haptic.tap(); router.push('/items' as any); }} style={s.addBtn}>
          <Package size={18} color={c.text.secondary} />
        </PressableScale>
        <PressableScale onPress={openAdd} style={s.addBtn}>
          <Plus size={20} color={c.text.primary} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={s.hint}>Ładowanie…</Text>
        ) : vehicles.length === 0 ? (
          <View style={s.empty}>
            <Car size={34} color={c.text.muted} />
            <Text style={s.emptyTitle}>Brak pojazdów</Text>
            <Text style={s.emptyHint}>Dodaj rower, samochód czy motocykl — wydatki na paliwo i części będą się tu zbierać (po tagu lub ręcznie).</Text>
            <AnimatedButton onPress={openAdd} label="Dodaj pojazd" icon={<Plus size={16} color={c.bg.primary} />} size="md" />
          </View>
        ) : vehicles.map(v => {
          const sum = summarizeVehicle(v, expenses, sole);
          const Icon = KIND_META[v.kind].Icon;
          const oilM = oilDueMonths(v);
          const oilOverdue = oilM != null && oilM <= 0;
          const oilSoon = oilM != null && oilM > 0 && oilM <= 1;
          const tireWarn = v.tireSeason === 'summer' && (todayCold || todaySnow);
          const isOpen = expanded === v.id;
          return (
            <View key={v.id} style={[s.card, { borderColor: v.color + '40' }]}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => { haptic.tap(); setExpanded(isOpen ? null : v.id); }} style={s.cardHead}>
                <View style={[s.vIcon, { backgroundColor: v.color + '22', borderColor: v.color + '50' }]}>
                  <Icon size={20} color={v.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.vName} numberOfLines={1}>{v.name}</Text>
                  <Text style={s.vSub}>{KIND_META[v.kind].label} · #{v.tag} · {sum.count} wydatków</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.vTotal, { color: v.color }]}>{zl(sum.total)}</Text>
                  <Text style={s.vMonth}>{zl(sum.thisMonth)} ten mies.</Text>
                </View>
                {isOpen ? <ChevronUp size={16} color={c.text.muted} /> : <ChevronDown size={16} color={c.text.muted} />}
              </TouchableOpacity>

              {/* Reminders */}
              {(oilOverdue || oilSoon || tireWarn) && (
                <View style={s.remindRow}>
                  {(oilOverdue || oilSoon) && (
                    <TouchableOpacity onPress={() => markOilChanged(v)} style={[s.remindChip, oilOverdue ? s.remindBad : s.remindWarn]} activeOpacity={0.75}>
                      <Droplet size={11} color={oilOverdue ? c.accent.red : c.accent.amber} />
                      <Text style={[s.remindText, { color: oilOverdue ? c.accent.red : c.accent.amber }]}>
                        {oilOverdue ? 'Wymiana oleju zaległa' : `Olej za ~${Math.round(oilM!)} mies.`} · oznacz
                      </Text>
                    </TouchableOpacity>
                  )}
                  {tireWarn && (
                    <View style={[s.remindChip, s.remindBad]}>
                      <Snowflake size={11} color={c.accent.blue} />
                      <Text style={[s.remindText, { color: c.accent.blue }]}>
                        {todaySnow ? 'Śnieg' : 'Mróz'} — zmień opony na zimowe
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Fuel / parts split */}
              <View style={s.splitRow}>
                <View style={s.splitTile}>
                  <Fuel size={13} color={ACCENT} />
                  <Text style={s.splitVal}>{zl(sum.fuel)}</Text>
                  <Text style={s.splitLabel}>paliwo</Text>
                </View>
                <View style={s.splitTile}>
                  <Wrench size={13} color={c.text.secondary} />
                  <Text style={s.splitVal}>{zl(sum.other)}</Text>
                  <Text style={s.splitLabel}>części / inne</Text>
                </View>
              </View>

              {isOpen && (
                <View style={s.detail}>
                  <View style={s.detailActions}>
                    <TouchableOpacity onPress={() => setPickerFor(v)} style={s.detailBtn} activeOpacity={0.75}>
                      <Link2 size={13} color={ACCENT} /><Text style={s.detailBtnText}>Przypisz istniejący</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEdit(v)} style={s.detailBtn} activeOpacity={0.75}>
                      <CalendarClock size={13} color={c.text.secondary} /><Text style={[s.detailBtnText, { color: c.text.secondary }]}>Edytuj / serwis</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeVehicle(v)} style={s.detailBtnDel} activeOpacity={0.75}>
                      <Trash2 size={13} color={c.accent.red} />
                    </TouchableOpacity>
                  </View>
                  {sum.expenses.length === 0
                    ? <Text style={s.detailEmpty}>Brak przypisanych wydatków. Otaguj wydatek #{v.tag} albo przypisz istniejący.</Text>
                    : sum.expenses.slice(0, 12).map(e => (
                      <TouchableOpacity key={e.id} style={s.exRow} onPress={() => router.push(`/expenses/${e.id}` as any)} activeOpacity={0.7}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.exName} numberOfLines={1}>{e.storeName || e.note || 'Wydatek'}</Text>
                          <Text style={s.exMeta}>{new Date(e.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })}{e.vehicleId ? ' · ręcznie' : ''}</Text>
                        </View>
                        <Text style={s.exAmt}>{e.amount.toFixed(2)} zł</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Add/edit modal ── */}
      <Modal visible={formOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{editing ? 'Edytuj pojazd' : 'Nowy pojazd'}</Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fLabel}>Nazwa</Text>
              <TextInput
                value={form.name}
                onChangeText={t => { setF('name', t); if (!editing) setF('tag', slugTag(t)); }}
                placeholder="np. Mój rower / Octavia"
                placeholderTextColor={c.text.muted}
                style={s.fInput}
              />

              <Text style={s.fLabel}>Typ</Text>
              <View style={s.chipRow}>
                {KINDS.map(k => {
                  const active = form.kind === k; const KIcon = KIND_META[k].Icon;
                  return (
                    <TouchableOpacity key={k} onPress={() => setF('kind', k)} style={[s.kindChip, active && { backgroundColor: form.color + '20', borderColor: form.color }]} activeOpacity={0.75}>
                      <KIcon size={13} color={active ? form.color : c.text.muted} />
                      <Text style={[s.kindChipText, active && { color: form.color }]}>{KIND_META[k].label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fLabel}>Tag (auto-łapie wydatki z tym tagiem)</Text>
              <TextInput value={form.tag} onChangeText={t => setF('tag', t.toLowerCase())} placeholder="np. rower" placeholderTextColor={c.text.muted} autoCapitalize="none" style={s.fInput} />

              <Text style={s.fLabel}>Kolor</Text>
              <View style={s.colorRow}>
                {COLORS.map(col => (
                  <TouchableOpacity key={col} onPress={() => setF('color', col)} style={[s.colorDot, { backgroundColor: col }, form.color === col && s.colorDotActive]} activeOpacity={0.8}>
                    {form.color === col && <Check size={12} color="#000" />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fLabel}>Ostatnia wymiana oleju</Text>
              <DatePickerField value={form.oilChangeDate} onChange={d => setF('oilChangeDate', d)} placeholder="Data (opcjonalnie)" />
              <Text style={s.fLabel}>Interwał oleju (miesiące)</Text>
              <TextInput value={form.oilIntervalMonths} onChangeText={t => setF('oilIntervalMonths', t.replace(/[^0-9]/g, ''))} placeholder="12" placeholderTextColor={c.text.muted} keyboardType="number-pad" style={s.fInput} />

              <Text style={s.fLabel}>Opony (teraz założone)</Text>
              <View style={s.chipRow}>
                {([['summer', 'Letnie', Sun], ['winter', 'Zimowe', Snowflake], ['allseason', 'Całoroczne', Car]] as const).map(([val, lbl, TIcon]) => {
                  const active = form.tireSeason === val;
                  return (
                    <TouchableOpacity key={val} onPress={() => setF('tireSeason', val)} style={[s.kindChip, active && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]} activeOpacity={0.75}>
                      <TIcon size={13} color={active ? ACCENT : c.text.muted} />
                      <Text style={[s.kindChipText, active && { color: ACCENT }]}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AnimatedButton onPress={saveForm} label={saving ? 'Zapisuję…' : (editing ? 'Zapisz' : 'Dodaj pojazd')} icon={<Check size={16} color={c.bg.primary} />} size="md" />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Attach-existing picker ── */}
      <Modal visible={!!pickerFor} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPickerFor(null)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerCard}>
            <Text style={s.sheetTitle}>Przypisz wydatek do „{pickerFor?.name}"</Text>
            <Text style={s.detailEmpty}>Wydatki w kategorii Transport lub bez pojazdu, najnowsze.</Text>
            <ScrollView style={{ marginTop: spacing[2] }}>
              {expenses
                .filter(e => (!e.type || e.type === 'expense') && !e.vehicleId && (e.category === 'transport' || !pickerFor || !expenseMatchesVehicle(e, pickerFor, sole)))
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 40)
                .map(e => (
                  <TouchableOpacity key={e.id} style={s.exRow} onPress={() => pickerFor && attachExpense(pickerFor, e)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.exName} numberOfLines={1}>{e.storeName || e.note || 'Wydatek'}</Text>
                      <Text style={s.exMeta}>{new Date(e.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {e.category}</Text>
                    </View>
                    <Text style={s.exAmt}>{e.amount.toFixed(2)} zł</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setPickerFor(null)} style={s.pickerClose} activeOpacity={0.8}>
              <Text style={s.pickerCloseText}>Zamknij</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  backBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: c.text.primary },
  addBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], gap: spacing[3] },
  hint: { fontSize: 13, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  emptyHint: { fontSize: 13, color: c.text.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing[4] },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  vIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  vName: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  vSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  vTotal: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  vMonth: { fontSize: 10, color: c.text.muted },

  remindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  remindChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[2], paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  remindWarn: { backgroundColor: c.accent.amber + '14', borderColor: c.accent.amber + '40' },
  remindBad: { backgroundColor: c.accent.red + '12', borderColor: c.accent.red + '38' },
  remindText: { fontSize: 10.5, fontWeight: '700' },

  splitRow: { flexDirection: 'row', gap: spacing[2] },
  splitTile: { flex: 1, gap: 3, paddingVertical: spacing[2], paddingHorizontal: spacing[3], backgroundColor: c.border.subtle, borderRadius: radius.md },
  splitVal: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  splitLabel: { fontSize: 10, color: c.text.muted },

  detail: { gap: spacing[1], borderTopWidth: 1, borderTopColor: c.border.subtle, paddingTop: spacing[2] },
  detailActions: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[1] },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  detailBtnText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  detailBtnDel: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '40', backgroundColor: c.accent.red + '0E' },
  detailEmpty: { fontSize: 11.5, color: c.text.muted, lineHeight: 16, paddingVertical: spacing[1] },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  exName: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  exMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  exAmt: { fontSize: 13, fontWeight: '700', color: c.text.primary },

  // modal
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: c.bg.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing[4], maxHeight: '88%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border.focus, alignSelf: 'center', marginBottom: spacing[3] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  fLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[3], marginBottom: spacing[1] },
  fInput: { fontSize: 15, color: c.text.primary, backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  kindChipText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 2, borderColor: c.text.primary },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing[4] },
  pickerCard: { backgroundColor: c.bg.elevated, borderRadius: radius.xl, padding: spacing[4], maxHeight: '78%' },
  pickerClose: { marginTop: spacing[2], paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.bg.card, alignItems: 'center' },
  pickerCloseText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
});
