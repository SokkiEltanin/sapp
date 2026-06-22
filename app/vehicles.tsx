import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, Plus, X, Car, Bike, Trash2, Snowflake, Sun,
  Fuel, Wrench, ChevronDown, ChevronUp, Check, Link2, RotateCcw, Star,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import DatePickerField from '@/components/ui/DatePickerField';
import { vehiclesService } from '@/services/vehiclesService';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { weatherService } from '@/services/weatherService';
import { Vehicle, VehicleKind, VehicleMaintenance, Expense } from '@/types';
import {
  summarizeVehicle, expenseMatchesVehicle, mainCarId,
  maintenanceDueMonths, maintenancePresets,
} from '@/utils/vehicleMatch';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

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
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

interface VForm {
  name: string; kind: VehicleKind; tag: string; color: string;
  isMainCar: boolean; tireSeason: 'summer' | 'winter' | 'allseason';
}
const emptyVForm = (): VForm => ({ name: '', kind: 'car', tag: '', color: COLORS[0], isMainCar: false, tireSeason: 'allseason' });

interface MForm { label: string; date: string; intervalMonths: string; expenseId?: string; }

export default function VehiclesScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { expenses, setExpenses, updateExpense } = useExpensesStore();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [todayCold, setTodayCold] = useState(false);
  const [todaySnow, setTodaySnow] = useState(false);

  const [vForm, setVForm] = useState<VForm>(emptyVForm);
  const [vEditing, setVEditing] = useState<Vehicle | null>(null);
  const [vOpen, setVOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Maintenance add/edit (for a specific vehicle)
  const [mFor, setMFor] = useState<Vehicle | null>(null);
  const [mForm, setMForm] = useState<MForm>({ label: '', date: new Date().toISOString().slice(0, 10), intervalMonths: '' });
  // Expense picker — target is either { vehicle } (attach) or { maintenance } (link)
  const [picker, setPicker] = useState<{ mode: 'attach' | 'link'; vehicle: Vehicle } | null>(null);

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

  const mainId = useMemo(() => mainCarId(vehicles), [vehicles]);
  const setVF = <K extends keyof VForm>(k: K, v: VForm[K]) => setVForm(f => ({ ...f, [k]: v }));

  // ── Vehicle CRUD ──────────────────────────────────────────────────────────
  const openAddVehicle = () => { setVEditing(null); setVForm(emptyVForm()); setVOpen(true); };
  const openEditVehicle = (v: Vehicle) => {
    setVEditing(v);
    setVForm({ name: v.name, kind: v.kind, tag: v.tag, color: v.color, isMainCar: !!v.isMainCar, tireSeason: v.tireSeason ?? 'allseason' });
    setVOpen(true);
  };
  const saveVehicle = async () => {
    if (!vForm.name.trim()) { Alert.alert('Błąd', 'Podaj nazwę pojazdu'); return; }
    setSaving(true);
    const tag = (vForm.tag.trim() || slugTag(vForm.name)).toLowerCase();
    const payload: Partial<Vehicle> = {
      name: vForm.name.trim(), kind: vForm.kind, tag, color: vForm.color,
      isMainCar: vForm.kind === 'car' ? vForm.isMainCar : false,
      tireSeason: vForm.tireSeason,
    };
    try {
      if (vEditing) await vehiclesService.update(vEditing.id, payload);
      else await vehiclesService.add({ ...(payload as Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>), maintenance: [] });
      haptic.success(); setVOpen(false); await load();
      toast.success(vEditing ? 'Zapisano pojazd' : 'Dodano pojazd');
    } catch { haptic.error(); toast.error('Nie zapisano — sprawdź połączenie'); }
    finally { setSaving(false); }
  };
  const removeVehicle = (v: Vehicle) => {
    Alert.alert('Usuń pojazd', `Usunąć „${v.name}"? Wydatki zostaną.`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => {
        haptic.medium();
        await vehiclesService.remove(v.id).catch(() => {});
        setVehicles(prev => prev.filter(x => x.id !== v.id));
        toast.info('Usunięto');
      } },
    ]);
  };

  // ── Maintenance ───────────────────────────────────────────────────────────
  const persistMaintenance = async (v: Vehicle, list: VehicleMaintenance[]) => {
    setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, maintenance: list } : x));
    await vehiclesService.update(v.id, { maintenance: list }).catch(() => toast.error('Nie zapisano serwisu'));
  };
  const openMaintenance = (v: Vehicle, preset?: { label: string; intervalMonths?: number }) => {
    setMFor(v);
    setMForm({ label: preset?.label ?? '', date: new Date().toISOString().slice(0, 10), intervalMonths: preset?.intervalMonths ? String(preset.intervalMonths) : '' });
  };
  const saveMaintenance = async () => {
    if (!mFor || !mForm.label.trim()) { Alert.alert('Błąd', 'Podaj nazwę serwisu'); return; }
    const entry: VehicleMaintenance = {
      id: uid(), label: mForm.label.trim(), date: mForm.date || new Date().toISOString().slice(0, 10),
      intervalMonths: mForm.intervalMonths ? parseInt(mForm.intervalMonths) : undefined,
      expenseId: mForm.expenseId,
    };
    haptic.success();
    await persistMaintenance(mFor, [entry, ...(mFor.maintenance ?? [])]);
    setMFor(null);
    toast.success('Dodano serwis');
  };
  const saveAndAddExpense = async () => {
    if (!mFor || !mForm.label.trim()) { Alert.alert('Błąd', 'Podaj nazwę serwisu'); return; }
    const v = mFor; const label = mForm.label.trim();
    await saveMaintenance();
    router.push({ pathname: '/expenses/add', params: { type: 'expense', prefillCategory: 'transport', prefillVehicleId: v.id, prefillNote: label } } as any);
  };
  const redoMaintenance = async (v: Vehicle, m: VehicleMaintenance) => {
    haptic.tap();
    const today = new Date().toISOString().slice(0, 10);
    await persistMaintenance(v, (v.maintenance ?? []).map(x => x.id === m.id ? { ...x, date: today } : x));
    toast.success('Zapisano nową datę');
  };
  const deleteMaintenance = async (v: Vehicle, m: VehicleMaintenance) => {
    haptic.medium();
    await persistMaintenance(v, (v.maintenance ?? []).filter(x => x.id !== m.id));
  };

  // ── Expense linking ───────────────────────────────────────────────────────
  const attachExpense = async (v: Vehicle, e: Expense) => {
    haptic.tap();
    updateExpense(e.id, { vehicleId: v.id });
    setPicker(null);
    try { await expensesService.update(e.id, { vehicleId: v.id }); toast.success('Przypisano wydatek'); }
    catch { toast.error('Nie przypisano'); }
  };
  const linkToMaintenance = (e: Expense) => {
    setMForm(f => ({ ...f, expenseId: e.id }));
    setPicker(null);
  };

  const linkedExpense = mForm.expenseId ? expenses.find(e => e.id === mForm.expenseId) : undefined;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={20} color={c.text.secondary} />
        </TouchableOpacity>
        <View style={s.segment}>
          <View style={[s.segBtn, s.segBtnOn]}><Text style={[s.segText, s.segTextOn]}>Pojazdy</Text></View>
          <TouchableOpacity onPress={() => { haptic.tap(); router.replace('/items' as any); }} style={s.segBtn} activeOpacity={0.7}>
            <Text style={s.segText}>Przedmioty</Text>
          </TouchableOpacity>
        </View>
        <PressableScale onPress={openAddVehicle} style={s.addBtn}>
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
            <Text style={s.emptyHint}>Dodaj rower lub auto. Wydatki łapią się ściśle po tagu (#rower / [R]); paliwo trafia do głównego auta. Serwis (olej, łańcuch, opony) z przypomnieniami.</Text>
            <AnimatedButton onPress={openAddVehicle} label="Dodaj pojazd" icon={<Plus size={16} color={c.bg.primary} />} size="md" />
          </View>
        ) : vehicles.map(v => {
          const sum = summarizeVehicle(v, expenses, mainId);
          const Icon = KIND_META[v.kind].Icon;
          const isOpen = expanded === v.id;
          const maint = v.maintenance ?? [];
          const dueList = maint.map(m => ({ m, due: maintenanceDueMonths(m) })).filter(x => x.due != null && x.due <= 1);
          const tireWarn = v.tireSeason === 'summer' && (todayCold || todaySnow);
          return (
            <View key={v.id} style={[s.card, { borderColor: v.color + '40' }]}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); setExpanded(isOpen ? null : v.id); }} style={s.cardHead}>
                <View style={[s.vIcon, { backgroundColor: v.color + '22', borderColor: v.color + '50' }]}>
                  <Icon size={20} color={v.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={s.vName} numberOfLines={1}>{v.name}</Text>
                    {v.id === mainId && v.kind === 'car' && <Star size={11} color={ACCENT} fill={ACCENT} />}
                  </View>
                  <Text style={s.vSub}>{KIND_META[v.kind].label} · #{v.tag} · {sum.count} wyd.</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.vTotal, { color: v.color }]}>{zl(sum.total)}</Text>
                  <Text style={s.vMonth}>{zl(sum.thisMonth)} ten mies.</Text>
                </View>
                {isOpen ? <ChevronUp size={16} color={c.text.muted} /> : <ChevronDown size={16} color={c.text.muted} />}
              </TouchableOpacity>

              {(dueList.length > 0 || tireWarn) && (
                <View style={s.remindRow}>
                  {dueList.map(({ m, due }) => (
                    <TouchableOpacity key={m.id} onPress={() => redoMaintenance(v, m)} style={[s.remindChip, (due! <= 0) ? s.remindBad : s.remindWarn]} activeOpacity={0.75}>
                      <Wrench size={11} color={due! <= 0 ? c.accent.red : c.accent.amber} />
                      <Text style={[s.remindText, { color: due! <= 0 ? c.accent.red : c.accent.amber }]}>
                        {m.label}: {due! <= 0 ? 'zaległe' : `za ~${Math.round(due!)} mies.`} · zrobione
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {tireWarn && (
                    <View style={[s.remindChip, s.remindBad]}>
                      <Snowflake size={11} color={c.accent.blue} />
                      <Text style={[s.remindText, { color: c.accent.blue }]}>{todaySnow ? 'Śnieg' : 'Mróz'} — zmień opony na zimowe</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={s.splitRow}>
                {v.kind === 'car' && (
                  <View style={s.splitTile}>
                    <Fuel size={13} color={ACCENT} />
                    <Text style={s.splitVal}>{zl(sum.fuel)}</Text>
                    <Text style={s.splitLabel}>paliwo</Text>
                  </View>
                )}
                <View style={s.splitTile}>
                  <Wrench size={13} color={c.text.secondary} />
                  <Text style={s.splitVal}>{zl(v.kind === 'car' ? sum.other : sum.total)}</Text>
                  <Text style={s.splitLabel}>części / akcesoria</Text>
                </View>
              </View>

              {isOpen && (
                <View style={s.detail}>
                  {/* Maintenance presets */}
                  <Text style={s.detailLabel}>Serwis</Text>
                  <View style={s.presetRow}>
                    {maintenancePresets(v.kind).map(p => (
                      <TouchableOpacity key={p.label} onPress={() => openMaintenance(v, p)} style={s.presetChip} activeOpacity={0.75}>
                        <Plus size={10} color={ACCENT} /><Text style={s.presetText}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => openMaintenance(v)} style={s.presetChip} activeOpacity={0.75}>
                      <Plus size={10} color={c.text.muted} /><Text style={[s.presetText, { color: c.text.muted }]}>Własne</Text>
                    </TouchableOpacity>
                  </View>
                  {maint.length > 0 && maint.map(m => {
                    const due = maintenanceDueMonths(m);
                    const linked = m.expenseId ? expenses.find(e => e.id === m.expenseId) : undefined;
                    return (
                      <View key={m.id} style={s.mRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.mLabel} numberOfLines={1}>{m.label}</Text>
                          <Text style={s.mMeta}>
                            {new Date(m.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: '2-digit' })}
                            {m.intervalMonths ? ` · co ${m.intervalMonths} mies.` : ''}
                            {due != null ? (due <= 0 ? ' · zaległe' : ` · za ~${Math.round(due)} mies.`) : ''}
                            {linked ? ` · ${linked.amount.toFixed(0)} zł` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => redoMaintenance(v, m)} style={s.mIcon} hitSlop={6}><RotateCcw size={14} color={ACCENT} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteMaintenance(v, m)} style={s.mIcon} hitSlop={6}><Trash2 size={14} color={c.accent.red} /></TouchableOpacity>
                      </View>
                    );
                  })}

                  {/* Expenses */}
                  <View style={s.detailActions}>
                    <TouchableOpacity onPress={() => setPicker({ mode: 'attach', vehicle: v })} style={s.detailBtn} activeOpacity={0.75}>
                      <Link2 size={13} color={ACCENT} /><Text style={s.detailBtnText}>Przypisz wydatek</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEditVehicle(v)} style={s.detailBtn} activeOpacity={0.75}>
                      <Wrench size={13} color={c.text.secondary} /><Text style={[s.detailBtnText, { color: c.text.secondary }]}>Edytuj</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeVehicle(v)} style={s.detailBtnDel} activeOpacity={0.75}>
                      <Trash2 size={13} color={c.accent.red} />
                    </TouchableOpacity>
                  </View>
                  {sum.expenses.length === 0
                    ? <Text style={s.detailEmpty}>Brak wydatków. Otaguj wydatek #{v.tag}{v.kind === 'car' && v.id === mainId ? ' (paliwo łapie się tu automatycznie)' : ''} albo przypisz istniejący.</Text>
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

      {/* Vehicle add/edit modal */}
      <Modal visible={vOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setVOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{vEditing ? 'Edytuj pojazd' : 'Nowy pojazd'}</Text>
              <TouchableOpacity onPress={() => setVOpen(false)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fLabel}>Nazwa</Text>
              <TextInput value={vForm.name} onChangeText={t => { setVF('name', t); if (!vEditing) setVF('tag', slugTag(t)); }} placeholder="np. Mój rower / Octavia" placeholderTextColor={c.text.muted} style={s.fInput} />

              <Text style={s.fLabel}>Typ</Text>
              <View style={s.chipRow}>
                {KINDS.map(k => {
                  const active = vForm.kind === k; const KIcon = KIND_META[k].Icon;
                  return (
                    <TouchableOpacity key={k} onPress={() => setVF('kind', k)} style={[s.kindChip, active && { backgroundColor: vForm.color + '20', borderColor: vForm.color }]} activeOpacity={0.75}>
                      <KIcon size={13} color={active ? vForm.color : c.text.muted} />
                      <Text style={[s.kindChipText, active && { color: vForm.color }]}>{KIND_META[k].label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fLabel}>Tag (łapie wydatki #{vForm.tag || 'tag'})</Text>
              <TextInput value={vForm.tag} onChangeText={t => setVF('tag', t.toLowerCase())} placeholder="np. rower" placeholderTextColor={c.text.muted} autoCapitalize="none" style={s.fInput} />

              {vForm.kind === 'car' && (
                <TouchableOpacity onPress={() => setVF('isMainCar', !vForm.isMainCar)} style={[s.mainToggle, vForm.isMainCar && { borderColor: ACCENT, backgroundColor: ACCENT + '14' }]} activeOpacity={0.8}>
                  <Star size={14} color={vForm.isMainCar ? ACCENT : c.text.muted} fill={vForm.isMainCar ? ACCENT : 'transparent'} />
                  <Text style={[s.mainToggleText, vForm.isMainCar && { color: ACCENT }]}>Główne auto — łapie paliwo</Text>
                </TouchableOpacity>
              )}

              <Text style={s.fLabel}>Kolor</Text>
              <View style={s.colorRow}>
                {COLORS.map(col => (
                  <TouchableOpacity key={col} onPress={() => setVF('color', col)} style={[s.colorDot, { backgroundColor: col }, vForm.color === col && s.colorDotActive]} activeOpacity={0.8}>
                    {vForm.color === col && <Check size={12} color="#000" />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fLabel}>Opony (założone)</Text>
              <View style={s.chipRow}>
                {([['summer', 'Letnie', Sun], ['winter', 'Zimowe', Snowflake], ['allseason', 'Całoroczne', Car]] as const).map(([val, lbl, TIcon]) => {
                  const active = vForm.tireSeason === val;
                  return (
                    <TouchableOpacity key={val} onPress={() => setVF('tireSeason', val)} style={[s.kindChip, active && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]} activeOpacity={0.75}>
                      <TIcon size={13} color={active ? ACCENT : c.text.muted} />
                      <Text style={[s.kindChipText, active && { color: ACCENT }]}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: spacing[3] }} />
              <AnimatedButton onPress={saveVehicle} label={saving ? 'Zapisuję…' : (vEditing ? 'Zapisz' : 'Dodaj pojazd')} icon={<Check size={16} color={c.bg.primary} />} size="md" />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Maintenance add modal */}
      <Modal visible={!!mFor} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setMFor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Serwis — {mFor?.name}</Text>
              <TouchableOpacity onPress={() => setMFor(null)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fLabel}>Co</Text>
              <TextInput value={mForm.label} onChangeText={t => setMForm(f => ({ ...f, label: t }))} placeholder="np. Wymiana oleju" placeholderTextColor={c.text.muted} style={s.fInput} />
              <Text style={s.fLabel}>Kiedy była</Text>
              <DatePickerField value={mForm.date} onChange={d => setMForm(f => ({ ...f, date: d }))} placeholder="Data" />
              <Text style={s.fLabel}>Przypominaj co (miesiące, opcjonalnie)</Text>
              <TextInput value={mForm.intervalMonths} onChangeText={t => setMForm(f => ({ ...f, intervalMonths: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="np. 12" placeholderTextColor={c.text.muted} style={s.fInput} />
              <Text style={s.fLabel}>Transakcja (opcjonalnie)</Text>
              {linkedExpense ? (
                <View style={s.linkedRow}>
                  <Text style={s.linkedText} numberOfLines={1}>{linkedExpense.storeName || linkedExpense.note || 'Wydatek'} · {linkedExpense.amount.toFixed(2)} zł</Text>
                  <TouchableOpacity onPress={() => setMForm(f => ({ ...f, expenseId: undefined }))} hitSlop={8}><X size={15} color={c.text.muted} /></TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <TouchableOpacity onPress={() => mFor && setPicker({ mode: 'link', vehicle: mFor })} style={s.linkBtn} activeOpacity={0.75}>
                    <Link2 size={13} color={ACCENT} /><Text style={s.detailBtnText}>Z istniejących</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveAndAddExpense} style={s.linkBtn} activeOpacity={0.75}>
                    <Plus size={13} color={ACCENT} /><Text style={s.detailBtnText}>Nowy wydatek</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ height: spacing[3] }} />
              <AnimatedButton onPress={saveMaintenance} label="Zapisz serwis" icon={<Check size={16} color={c.bg.primary} />} size="md" />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Expense picker */}
      <Modal visible={!!picker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPicker(null)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerCard}>
            <Text style={s.sheetTitle}>{picker?.mode === 'link' ? 'Wybierz transakcję' : `Przypisz do „${picker?.vehicle.name}"`}</Text>
            <ScrollView style={{ marginTop: spacing[2] }}>
              {expenses
                .filter(e => (!e.type || e.type === 'expense') && (picker?.mode === 'link' ? true : !e.vehicleId))
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 50)
                .map(e => (
                  <TouchableOpacity key={e.id} style={s.exRow} onPress={() => picker && (picker.mode === 'link' ? linkToMaintenance(e) : attachExpense(picker.vehicle, e))} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.exName} numberOfLines={1}>{e.storeName || e.note || 'Wydatek'}</Text>
                      <Text style={s.exMeta}>{new Date(e.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {e.category}</Text>
                    </View>
                    <Text style={s.exAmt}>{e.amount.toFixed(2)} zł</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setPicker(null)} style={s.pickerClose} activeOpacity={0.8}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  backBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  segment: { flex: 1, flexDirection: 'row', backgroundColor: c.border.subtle, borderRadius: radius.full, padding: 2 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.full },
  segBtnOn: { backgroundColor: c.bg.card },
  segText: { fontSize: 12, fontWeight: '700', color: c.text.muted },
  segTextOn: { color: c.text.primary },
  addBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], gap: spacing[3] },
  hint: { fontSize: 13, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  emptyHint: { fontSize: 13, color: c.text.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing[3] },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  vIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  detailLabel: { fontSize: 10, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[1] },
  presetChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2], paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  presetText: { fontSize: 11, fontWeight: '700', color: ACCENT },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  mLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  mMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  mIcon: { padding: 5 },

  detailActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2], marginBottom: spacing[1] },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  detailBtnText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  detailBtnDel: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '40', backgroundColor: c.accent.red + '0E' },
  detailEmpty: { fontSize: 11.5, color: c.text.muted, lineHeight: 16, paddingVertical: spacing[1] },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  exName: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  exMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  exAmt: { fontSize: 13, fontWeight: '700', color: c.text.primary },

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
  mainToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3], paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  mainToggleText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 2, borderColor: c.text.primary },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: ACCENT + '14', borderWidth: 1, borderColor: ACCENT + '30' },
  linkedText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text.primary },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing[4] },
  pickerCard: { backgroundColor: c.bg.elevated, borderRadius: radius.xl, padding: spacing[4], maxHeight: '78%' },
  pickerClose: { marginTop: spacing[2], paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.bg.card, alignItems: 'center' },
  pickerCloseText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
});
