import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, Plus, X, Trash2, Check, RotateCcw, Package, CalendarClock,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import DatePickerField from '@/components/ui/DatePickerField';
import { maintenanceService, dueInDays } from '@/services/maintenanceService';
import { MaintenanceItem } from '@/types';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

const COLORS = ['#46B0DE', '#2AC68F', '#A78BFA', '#FBBF24', '#F472B6', '#FB923C', '#E43434'];
const INTERVAL_PRESETS = [30, 60, 90, 120, 180, 365];

// Quick-add suggestions (name + interval days + color).
const SUGGESTIONS: { name: string; days: number; color: string }[] = [
  { name: 'Filtr oczyszczacza powietrza', days: 180, color: '#46B0DE' },
  { name: 'Worek do odkurzacza',          days: 60,  color: '#A78BFA' },
  { name: 'Filtr dzbanka Dafi',           days: 30,  color: '#2AC68F' },
  { name: 'Główka szczoteczki',           days: 90,  color: '#F472B6' },
  { name: 'Filtr w okapie',               days: 120, color: '#FB923C' },
];

function todayIso() { return new Date().toISOString().slice(0, 10); }

interface FormState { name: string; color: string; lastChangedDate: string; intervalDays: string; }
const emptyForm = (): FormState => ({ name: '', color: COLORS[0], lastChangedDate: todayIso(), intervalDays: '90' });

export default function ItemsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [items, setItems]   = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [form, setForm]     = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await maintenanceService.getAll()); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => [...items].sort((a, b) => dueInDays(a) - dueInDays(b)), [items]);
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = (preset?: { name: string; days: number; color: string }) => {
    setEditing(null);
    setForm(preset ? { name: preset.name, color: preset.color, lastChangedDate: todayIso(), intervalDays: String(preset.days) } : emptyForm());
    setFormOpen(true);
  };
  const openEdit = (it: MaintenanceItem) => {
    setEditing(it);
    setForm({ name: it.name, color: it.color, lastChangedDate: it.lastChangedDate.slice(0, 10), intervalDays: String(it.intervalDays) });
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.name.trim()) { Alert.alert('Błąd', 'Podaj nazwę'); return; }
    const interval = parseInt(form.intervalDays) || 0;
    if (interval <= 0) { Alert.alert('Błąd', 'Podaj interwał w dniach'); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), color: form.color, lastChangedDate: form.lastChangedDate || todayIso(), intervalDays: interval };
    try {
      if (editing) await maintenanceService.update(editing.id, payload);
      else await maintenanceService.add(payload);
      haptic.success();
      setFormOpen(false);
      await load();
      toast.success(editing ? 'Zapisano' : 'Dodano przedmiot');
    } catch { haptic.error(); toast.error('Nie zapisano — sprawdź połączenie'); }
    finally { setSaving(false); }
  };

  const markChanged = async (it: MaintenanceItem) => {
    haptic.success();
    const today = todayIso();
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, lastChangedDate: today } : x));
    await maintenanceService.update(it.id, { lastChangedDate: today }).catch(() => {});
    toast.success(`Odświeżono: ${it.name}`);
  };

  const removeItem = (it: MaintenanceItem) => {
    Alert.alert('Usuń przedmiot', `Usunąć „${it.name}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => {
        haptic.medium();
        await maintenanceService.remove(it.id).catch(() => {});
        setItems(prev => prev.filter(x => x.id !== it.id));
        toast.info('Usunięto');
      } },
    ]);
  };

  const dueLabel = (d: number) => d < 0 ? `${-d} dni po terminie` : d === 0 ? 'dziś!' : d === 1 ? 'jutro' : `za ${d} dni`;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={20} color={c.text.secondary} />
        </TouchableOpacity>
        <Text style={s.title}>Przedmioty / serwis</Text>
        <PressableScale onPress={() => openAdd()} style={s.addBtn}>
          <Plus size={20} color={c.text.primary} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={s.hint}>Ładowanie…</Text>
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Package size={34} color={c.text.muted} />
            <Text style={s.emptyTitle}>Brak przedmiotów</Text>
            <Text style={s.emptyHint}>Śledź wymiany: filtry, worki, wkłady. Przypomni, gdy zbliża się termin.</Text>
            <View style={s.suggWrap}>
              {SUGGESTIONS.map(sg => (
                <TouchableOpacity key={sg.name} onPress={() => openAdd(sg)} style={[s.suggChip, { borderColor: sg.color + '50' }]} activeOpacity={0.75}>
                  <Plus size={11} color={sg.color} />
                  <Text style={[s.suggText, { color: sg.color }]}>{sg.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <>
            {sorted.map(it => {
              const d = dueInDays(it);
              const overdue = d < 0, soon = d >= 0 && d <= 7;
              const tone = overdue ? c.accent.red : soon ? c.accent.amber : c.accent.green;
              return (
                <View key={it.id} style={[s.card, { borderColor: it.color + '40' }]}>
                  <View style={[s.dot, { backgroundColor: it.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{it.name}</Text>
                    <Text style={s.meta}>co {it.intervalDays} dni · ostatnio {new Date(it.lastChangedDate).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })}</Text>
                    <Text style={[s.due, { color: tone }]}>{dueLabel(d)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => markChanged(it)} style={[s.markBtn, { borderColor: it.color + '60' }]} activeOpacity={0.75}>
                    <RotateCcw size={14} color={it.color} />
                    <Text style={[s.markText, { color: it.color }]}>Wymieniono</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(it)} style={s.iconBtn} hitSlop={6}><CalendarClock size={15} color={c.text.muted} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(it)} style={s.iconBtn} hitSlop={6}><Trash2 size={15} color={c.accent.red} /></TouchableOpacity>
                </View>
              );
            })}
            <PressableScale onPress={() => openAdd()} style={s.addRow}><Plus size={16} color={c.text.secondary} /><Text style={s.addRowText}>Dodaj przedmiot</Text></PressableScale>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/edit modal */}
      <Modal visible={formOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{editing ? 'Edytuj' : 'Nowy przedmiot'}</Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fLabel}>Nazwa</Text>
              <TextInput value={form.name} onChangeText={t => setF('name', t)} placeholder="np. Filtr Dafi" placeholderTextColor={c.text.muted} style={s.fInput} />

              <Text style={s.fLabel}>Ostatnia wymiana</Text>
              <DatePickerField value={form.lastChangedDate} onChange={d => setF('lastChangedDate', d)} placeholder="Data" />

              <Text style={s.fLabel}>Co ile dni</Text>
              <View style={s.chipRow}>
                {INTERVAL_PRESETS.map(d => {
                  const active = form.intervalDays === String(d);
                  return (
                    <TouchableOpacity key={d} onPress={() => setF('intervalDays', String(d))} style={[s.presetChip, active && { backgroundColor: form.color + '20', borderColor: form.color }]} activeOpacity={0.75}>
                      <Text style={[s.presetText, active && { color: form.color }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TextInput value={form.intervalDays} onChangeText={t => setF('intervalDays', t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="dni" placeholderTextColor={c.text.muted} style={s.presetInput} />
              </View>

              <Text style={s.fLabel}>Kolor</Text>
              <View style={s.colorRow}>
                {COLORS.map(col => (
                  <TouchableOpacity key={col} onPress={() => setF('color', col)} style={[s.colorDot, { backgroundColor: col }, form.color === col && s.colorDotActive]} activeOpacity={0.8}>
                    {form.color === col && <Check size={12} color="#000" />}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: spacing[3] }} />
              <AnimatedButton onPress={saveForm} label={saving ? 'Zapisuję…' : (editing ? 'Zapisz' : 'Dodaj')} icon={<Check size={16} color={c.bg.primary} />} size="md" />
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  backBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: c.text.primary },
  addBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], gap: spacing[3] },
  hint: { fontSize: 13, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  emptyHint: { fontSize: 13, color: c.text.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing[4] },
  suggWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[2] },
  suggChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  suggText: { fontSize: 12, fontWeight: '600' },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, padding: spacing[3] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  meta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  due: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  markText: { fontSize: 11, fontWeight: '700' },
  iconBtn: { padding: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, borderStyle: 'dashed' },
  addRowText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: c.bg.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing[4], maxHeight: '88%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border.focus, alignSelf: 'center', marginBottom: spacing[3] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  fLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[3], marginBottom: spacing[1] },
  fInput: { fontSize: 15, color: c.text.primary, backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  presetChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  presetText: { fontSize: 13, fontWeight: '700', color: c.text.muted },
  presetInput: { minWidth: 60, fontSize: 13, color: c.text.primary, backgroundColor: c.bg.card, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: spacing[2], textAlign: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 2, borderColor: c.text.primary },
});
