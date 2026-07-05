import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, Plus, ChevronLeft, RefreshCcw, Trash2,
  Check, Bell, BellOff, Calendar, Edit2, CreditCard,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { useSubscriptions, MONTHLY_FACTOR } from '@/hooks/useSubscriptions';
import { getCategoryMeta, CATEGORY_META } from '@/utils/categories';
import { todayISO, ymd } from '@/utils/date';
import { Subscription, BillingCycle, ExpenseCategory } from '@/types';
import { expensesService } from '@/services/expensesService';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLES: { value: BillingCycle; label: string; short: string }[] = [
  { value: 'weekly',    label: 'Co tydzień',  short: '/tydz.' },
  { value: 'monthly',  label: 'Co miesiąc',  short: '/mies.' },
  { value: 'quarterly',label: 'Co kwartał',  short: '/kw.'   },
  { value: 'yearly',   label: 'Co rok',      short: '/rok'   },
];

const REMINDER_OPTS = [
  { days: 0,  label: 'Brak' },
  { days: 1,  label: '1 dzień przed' },
  { days: 3,  label: '3 dni przed'   },
  { days: 7,  label: '7 dni przed'   },
];

const DURATION_OPTS: { value: number; label: string }[] = [
  { value: 0,  label: 'Zawsze' },
  { value: 1,  label: '1 mies.' },
  { value: 2,  label: '2 mies.' },
  { value: 3,  label: '3 mies.' },
  { value: 6,  label: '6 mies.' },
  { value: 12, label: '12 mies.' },
];

const ALL_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function urgencyColor(days: number): string {
  if (days < 0)  return colors.accent.red;
  if (days <= 3) return colors.accent.amber;
  if (days <= 7) return colors.accent.blue;
  return colors.accent.green;
}

function advanceNextBillingDate(current: string, cycle: BillingCycle): string {
  const d = new Date(current + 'T00:00:00');
  switch (cycle) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return ymd(d);
}

function isDurationExpired(sub: Subscription): boolean {
  if (!sub.durationMonths || sub.durationMonths === 0 || !sub.startDate) return false;
  const end = new Date(sub.startDate + 'T00:00:00');
  end.setMonth(end.getMonth() + sub.durationMonths);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return end <= today;
}

// ─── Add/Edit Form ────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  amount: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  reminderDaysBefore: number;
  category: ExpenseCategory;
  note: string;
  durationMonths: number;
  tags: string; // comma-separated input
}

const emptyForm = (): FormState => {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return {
    name: '', amount: '', billingCycle: 'monthly',
    nextBillingDate: ymd(d).split('-').reverse().join('.'),
    reminderDaysBefore: 3, category: 'subscriptions', note: '', durationMonths: 0, tags: '',
  };
};

// "prąd, dom" → ["prąd","dom"]
const parseTags = (s: string): string[] =>
  s.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

function subToForm(s: Subscription): FormState {
  return {
    name: s.name, amount: String(s.amount), billingCycle: s.billingCycle,
    nextBillingDate: s.nextBillingDate.split('-').reverse().join('.'),
    reminderDaysBefore: s.reminderDaysBefore, category: s.category, note: s.note ?? '',
    durationMonths: s.durationMonths ?? 0, tags: (s.tags ?? []).join(', '),
  };
}

function parseDate(str: string): string | null {
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionsScreen() {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const { subscriptions, isLoading, add, update, remove, stats } = useSubscriptions();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  // Payment confirmation modal
  const [paymentQueue, setPaymentQueue] = useState<Subscription[]>([]);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const checkedRef = useRef(false);

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setModalVisible(true); };
  const openEdit = (s: Subscription) => { setEditing(s); setForm(subToForm(s)); setModalVisible(true); };

  // Auto-deactivate expired-duration subs and build payment queue on load
  useEffect(() => {
    if (checkedRef.current || subscriptions.length === 0) return;
    checkedRef.current = true;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = ymd(today);

    subscriptions.forEach((sub) => {
      if (sub.active && isDurationExpired(sub)) {
        update(sub.id, { active: false });
      }
    });

    const due = subscriptions.filter(
      (sub) => sub.active && !isDurationExpired(sub) && sub.nextBillingDate <= todayStr,
    );
    if (due.length > 0) setPaymentQueue(due);
  }, [subscriptions]);

  const currentPayment = paymentQueue[0] ?? null;

  const handlePaymentYes = useCallback(async () => {
    if (!currentPayment) return;
    haptic.success();
    setPaymentConfirming(true);
    try {
      const today = todayISO();
      await expensesService.add({
        type: 'expense',
        amount: currentPayment.amount,
        currency: currentPayment.currency,
        category: currentPayment.category,
        tags: currentPayment.tags ?? [],
        note: `Subskrypcja: ${currentPayment.name}`,
        date: today,
      });
      const next = advanceNextBillingDate(currentPayment.nextBillingDate, currentPayment.billingCycle);
      await update(currentPayment.id, { nextBillingDate: next });
    } catch {
      // silently skip
    } finally {
      setPaymentConfirming(false);
      setPaymentQueue((q) => q.slice(1));
    }
  }, [currentPayment, update]);

  const handlePaymentNo = useCallback(() => {
    haptic.tap();
    setPaymentQueue((q) => q.slice(1));
  }, []);

  const saveForm = useCallback(async () => {
    const { name, amount, billingCycle, nextBillingDate, reminderDaysBefore, category, note, durationMonths, tags } = form;
    const tagArr = parseTags(tags);
    if (!name.trim()) { Alert.alert('Brak nazwy', 'Podaj nazwę subskrypcji'); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) { Alert.alert('Błędna kwota', 'Podaj prawidłową kwotę'); return; }
    const dateIso = parseDate(nextBillingDate);
    if (!dateIso) { Alert.alert('Błędna data', 'Format: DD.MM.RRRR'); return; }

    const today = todayISO();

    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, {
          name: name.trim(), amount: amt, billingCycle, nextBillingDate: dateIso,
          reminderDaysBefore, category, note: note.trim() || undefined, durationMonths,
          tags: tagArr,
        });
      } else {
        await add({
          name: name.trim(), amount: amt, currency: 'PLN', billingCycle,
          nextBillingDate: dateIso, reminderDaysBefore, category, active: true,
          note: note.trim() || undefined, durationMonths, tags: tagArr,
          startDate: durationMonths > 0 ? today : undefined,
        });
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally {
      setSaving(false);
    }
  }, [form, editing]);

  const confirmDelete = (s: Subscription) =>
    Alert.alert('Usuń subskrypcję', `Usunąć "${s.name}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { haptic.medium(); remove(s.id); } },
    ]);

  const active   = subscriptions.filter((s) => s.active);
  const inactive = subscriptions.filter((s) => !s.active);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={s.closeBtn}>
          <ChevronLeft size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={s.title}>Subskrypcje</Text>
        <PressableScale onPress={openAdd} style={[s.closeBtn, { backgroundColor: colors.accent.blue + '20', borderColor: colors.accent.blue + '40' }]}>
          <Plus size={18} color={colors.accent.blue} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[3], paddingBottom: 40 }}>
        {/* Summary card */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{stats.monthlyTotal.toFixed(2)} zł</Text>
              <Text style={s.summaryLabel}>miesięcznie</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{stats.yearlyTotal.toFixed(2)} zł</Text>
              <Text style={s.summaryLabel}>rocznie</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryVal, { color: colors.accent.blue }]}>{stats.activeCount}</Text>
              <Text style={s.summaryLabel}>aktywnych</Text>
            </View>
          </View>
        </View>

        {/* Active subscriptions */}
        {active.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>AKTYWNE</Text>
            {active.map((sub) => (
              <SubItem key={sub.id} sub={sub} onEdit={openEdit} onDelete={confirmDelete} onToggle={(id) => update(id, { active: false })} />
            ))}
          </View>
        )}

        {/* Inactive subscriptions */}
        {inactive.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>NIEAKTYWNE</Text>
            {inactive.map((sub) => (
              <SubItem key={sub.id} sub={sub} onEdit={openEdit} onDelete={confirmDelete} onToggle={(id) => update(id, { active: true })} />
            ))}
          </View>
        )}

        {subscriptions.length === 0 && !isLoading && (
          <View style={s.empty}>
            <RefreshCcw size={32} color={colors.text.muted} />
            <Text style={s.emptyTitle}>Brak subskrypcji</Text>
            <Text style={s.emptyText}>Dodaj subskrypcje takie jak Netflix, Spotify, siłownia itp.</Text>
            <AnimatedButton onPress={openAdd} label="Dodaj pierwszą" icon={<Plus size={16} color={colors.bg.primary} />} size="md" />
          </View>
        )}
      </ScrollView>

      {/* Payment confirmation modal */}
      {currentPayment && (
        <Modal visible transparent animationType="fade" onRequestClose={handlePaymentNo}>
          <View style={s.payOverlay}>
            <View style={s.payCard}>
              <View style={s.payIconWrap}>
                <CreditCard size={24} color={colors.accent.blue} />
              </View>
              <Text style={s.payTitle}>Płatność należna</Text>
              <Text style={s.payName}>{currentPayment.name}</Text>
              <Text style={s.payAmount}>{currentPayment.amount.toFixed(2)} zł</Text>
              <Text style={s.payHint}>Czy opłaciłeś tę subskrypcję?</Text>
              {paymentQueue.length > 1 && (
                <Text style={s.payQueue}>+{paymentQueue.length - 1} kolejnych</Text>
              )}
              <View style={s.payBtns}>
                <PressableScale onPress={handlePaymentNo} style={s.payBtnNo}>
                  <Text style={s.payBtnNoText}>Nie teraz</Text>
                </PressableScale>
                <PressableScale
                  onPress={handlePaymentYes}
                  style={[s.payBtnYes, paymentConfirming && { opacity: 0.6 }]}
                  disabled={paymentConfirming}
                >
                  <Check size={16} color={colors.bg.primary} />
                  <Text style={s.payBtnYesText}>{paymentConfirming ? 'Zapisuję...' : 'Tak, opłaciłem'}</Text>
                </PressableScale>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
            <View style={s.modalHeader}>
              <PressableScale onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <X size={18} color={colors.text.secondary} />
              </PressableScale>
              <Text style={s.title}>{editing ? 'Edytuj' : 'Nowa subskrypcja'}</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <Text style={s.fieldLabel}>Nazwa</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={(v) => setF('name', v)}
                placeholder="Netflix, Spotify, siłownia..."
                placeholderTextColor={colors.text.muted}
                autoFocus={!editing}
              />

              {/* Amount + cycle */}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Kwota (zł)</Text>
                  <TextInput
                    style={s.input}
                    value={form.amount}
                    onChangeText={(v) => setF('amount', v)}
                    placeholder="49.99"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Cykl</Text>
                  <View style={s.pillRow}>
                    {CYCLES.map((c) => (
                      <PressableScale
                        key={c.value}
                        onPress={() => setF('billingCycle', c.value)}
                        style={[s.pill, form.billingCycle === c.value && s.pillActive]}
                      >
                        <Text style={[s.pillText, form.billingCycle === c.value && s.pillTextActive]}>
                          {c.label}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              </View>

              {/* Duration */}
              <Text style={s.fieldLabel}>Czas trwania</Text>
              <View style={s.pillRow}>
                {DURATION_OPTS.map((d) => (
                  <PressableScale
                    key={d.value}
                    onPress={() => setF('durationMonths', d.value)}
                    style={[s.pill, form.durationMonths === d.value && s.pillActive]}
                  >
                    <Text style={[s.pillText, form.durationMonths === d.value && s.pillTextActive]}>
                      {d.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>

              {/* Next billing date */}
              <Text style={s.fieldLabel}>Następna płatność</Text>
              <View style={s.inputRow}>
                <Calendar size={14} color={colors.text.muted} />
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  value={form.nextBillingDate}
                  onChangeText={(v) => setF('nextBillingDate', v)}
                  placeholder="DD.MM.RRRR"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              {/* Reminder */}
              <Text style={s.fieldLabel}>Przypomnienie o anulowaniu</Text>
              <View style={s.pillRow}>
                {REMINDER_OPTS.map((r) => (
                  <PressableScale
                    key={r.days}
                    onPress={() => setF('reminderDaysBefore', r.days)}
                    style={[s.pill, form.reminderDaysBefore === r.days && s.pillActive]}
                  >
                    <Text style={[s.pillText, form.reminderDaysBefore === r.days && s.pillTextActive]}>
                      {r.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>

              {/* Category */}
              <Text style={s.fieldLabel}>Kategoria</Text>
              <PressableScale onPress={() => setCatOpen((x) => !x)} style={s.catBtn}>
                {(() => {
                  const meta = getCategoryMeta(form.category);
                  const Icon = (LucideIcons as any)[meta.icon];
                  return (
                    <>
                      {Icon && <Icon size={14} color={meta.color} />}
                      <Text style={[s.catBtnText, { color: meta.color }]}>{meta.label}</Text>
                    </>
                  );
                })()}
              </PressableScale>
              {catOpen && (
                <View style={s.catGrid}>
                  {ALL_CATS.map(([cat, meta]) => {
                    const Icon = (LucideIcons as any)[meta.icon];
                    const active = cat === form.category;
                    return (
                      <PressableScale
                        key={cat}
                        onPress={() => { setF('category', cat); setCatOpen(false); }}
                        style={[s.catItem, active && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
                      >
                        {Icon && <Icon size={13} color={active ? meta.color : colors.text.muted} />}
                        <Text style={[s.catItemText, active && { color: meta.color }]}>{meta.label}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
              )}

              {/* Note */}
              <Text style={s.fieldLabel}>Tagi (opcjonalnie)</Text>
              <TextInput
                style={s.input}
                value={form.tags}
                onChangeText={(v) => setF('tags', v)}
                placeholder="np. prąd, dom — trafią na wydatek przy płatności"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="none"
              />

              <Text style={s.fieldLabel}>Notatka (opcjonalnie)</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                value={form.note}
                onChangeText={(v) => setF('note', v)}
                placeholder="np. plan Family, konto premium..."
                placeholderTextColor={colors.text.muted}
                multiline
              />

              <AnimatedButton
                onPress={saveForm}
                label={saving ? 'Zapisuję...' : editing ? 'Zapisz zmiany' : 'Dodaj subskrypcję'}
                icon={<Check size={18} color={colors.bg.primary} />}
                size="lg"
                fullWidth
                disabled={saving}
                style={{ marginTop: spacing[2] }}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Subscription item ────────────────────────────────────────────────────────

function SubItem({ sub, onEdit, onDelete, onToggle }: {
  sub: Subscription;
  onEdit: (s: Subscription) => void;
  onDelete: (s: Subscription) => void;
  onToggle: (id: string) => void;
}) {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const meta  = getCategoryMeta(sub.category);
  const Icon  = (LucideIcons as any)[meta.icon];
  const cycle = CYCLES.find((c) => c.value === sub.billingCycle);
  const days  = daysUntil(sub.nextBillingDate);
  const color = urgencyColor(days);
  const nextLabel = days < 0 ? 'zaległa' : days === 0 ? 'dziś!' : `za ${days} dni`;
  const durLabel = sub.durationMonths && sub.durationMonths > 0
    ? `${sub.durationMonths} mies.`
    : null;

  return (
    <View style={[s.item, !sub.active && s.itemInactive]}>
      <View style={[s.itemIcon, { backgroundColor: meta.color + '18' }]}>
        {Icon && <Icon size={16} color={sub.active ? meta.color : colors.text.muted} />}
      </View>
      <View style={s.itemBody}>
        <Text style={[s.itemName, !sub.active && { color: colors.text.muted }]}>{sub.name}</Text>
        <Text style={s.itemCycle}>
          {sub.amount.toFixed(2)} zł{cycle?.short}
          {durLabel ? ` · ${durLabel}` : ''}
          {' · '}{nextLabel}
        </Text>
        {sub.reminderDaysBefore > 0 && sub.active && (
          <View style={s.itemBell}>
            <Bell size={9} color={colors.accent.amber} />
            <Text style={s.itemBellText}>Przypomnienie {sub.reminderDaysBefore} dni przed</Text>
          </View>
        )}
      </View>
      <View style={s.itemActions}>
        <View style={[s.daysBadge, { backgroundColor: sub.active ? color + '20' : 'transparent' }]}>
          <Text style={[s.daysBadgeText, { color: sub.active ? color : colors.text.muted }]}>
            {sub.active ? nextLabel : 'off'}
          </Text>
        </View>
        <View style={s.actionBtns}>
          <PressableScale onPress={() => onToggle(sub.id)} style={s.iconBtn}>
            {sub.active
              ? <BellOff size={14} color={colors.text.muted} />
              : <Check size={14} color={colors.accent.green} />}
          </PressableScale>
          <PressableScale onPress={() => onEdit(sub)} style={s.iconBtn}>
            <Edit2 size={14} color={colors.text.muted} />
          </PressableScale>
          <PressableScale onPress={() => onDelete(sub)} style={s.iconBtn}>
            <Trash2 size={14} color={colors.accent.red} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  title: { ...typography.h4, color: c.text.primary },

  summaryCard: {
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default, overflow: 'hidden',
  },
  summaryRow: { flexDirection: 'row', padding: spacing[4] },
  summaryItem: { flex: 1, alignItems: 'center', gap: spacing[1] },
  summaryDivider: { width: 1, backgroundColor: c.border.default },
  summaryVal: { ...typography.h3, color: c.text.primary },
  summaryLabel: { ...typography.caption, color: c.text.muted },

  section: { gap: spacing[2] },
  sectionTitle: {
    ...typography.caption, color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[1],
  },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3],
  },
  itemInactive: { opacity: 0.5 },
  itemIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 3 },
  itemName: { ...typography.bodySmall, color: c.text.primary, fontWeight: '600' },
  itemCycle: { fontSize: 11, color: c.text.muted },
  itemBell: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  itemBellText: { fontSize: 10, color: c.accent.amber },
  itemActions: { alignItems: 'flex-end', gap: spacing[2] },
  daysBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm,
  },
  daysBadgeText: { fontSize: 10, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: spacing[1] },
  iconBtn: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingTop: spacing[12], gap: spacing[4] },
  emptyTitle: { ...typography.h3, color: c.text.secondary },
  emptyText: { ...typography.body, color: c.text.muted, textAlign: 'center', lineHeight: 22 },

  // ── Payment confirmation overlay ──────────────────────────────────────────
  payOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  payCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[6], alignItems: 'center', gap: spacing[2], width: '100%',
  },
  payIconWrap: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: c.accent.blue + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1],
  },
  payTitle: { ...typography.caption, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  payName: { ...typography.h3, color: c.text.primary, textAlign: 'center' },
  payAmount: { fontSize: 28, fontWeight: '800', color: c.accent.blue },
  payHint: { ...typography.body, color: c.text.secondary, textAlign: 'center', marginTop: spacing[1] },
  payQueue: { fontSize: 11, color: c.text.muted, marginTop: 2 },
  payBtns: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3], width: '100%' },
  payBtnNo: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center',
  },
  payBtnNoText: { ...typography.bodySmall, color: c.text.secondary, fontWeight: '600' },
  payBtnYes: {
    flex: 2, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: c.accent.blue, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  payBtnYesText: { ...typography.bodySmall, color: c.bg.primary, fontWeight: '700' },

  // ── Modal / form ──────────────────────────────────────────────────────────
  modal: { flex: 1, backgroundColor: c.bg.secondary },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  formScroll: { padding: spacing[4], gap: spacing[1], paddingBottom: 40 },
  fieldLabel: { ...typography.caption, color: c.text.muted, marginBottom: spacing[2], marginTop: spacing[3] },
  input: {
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    color: c.text.primary, fontSize: 14, marginBottom: spacing[1],
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], marginBottom: spacing[1],
  },
  row: { flexDirection: 'row', gap: spacing[3] },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[1] },
  pill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.bg.card,
  },
  pillActive: { backgroundColor: c.accent.blue + '20', borderColor: c.accent.blue },
  pillText: { fontSize: 12, fontWeight: '500', color: c.text.muted },
  pillTextActive: { color: c.accent.blue, fontWeight: '700' },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  catBtnText: { fontSize: 13, fontWeight: '600' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  catItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.bg.elevated,
  },
  catItemText: { fontSize: 11, fontWeight: '600', color: c.text.muted },
});
