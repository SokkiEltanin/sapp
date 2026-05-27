import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Modal, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, Plus, Trash2, ChevronRight, ClipboardList, Check, TrendingDown, TrendingUp,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { templatesService } from '@/services/templatesService';
import { CATEGORY_META, INCOME_CATEGORY_META } from '@/utils/categories';
import { ExpenseTemplate, ExpenseCategory, IncomeCategory, TransactionType } from '@/types';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

const EXPENSE_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, any][];
const INCOME_CATS  = Object.entries(INCOME_CATEGORY_META) as [IncomeCategory, any][];

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName]     = useState('');
  const [formType, setFormType]     = useState<TransactionType>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote]     = useState('');
  const [formCat, setFormCat]       = useState<ExpenseCategory>('other');
  const [formIncCat, setFormIncCat] = useState<IncomeCategory>('salary');
  const [saving, setSaving]         = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await templatesService.getAll();
      setTemplates(list);
    } catch { } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormName(''); setFormType('expense'); setFormAmount('');
    setFormNote(''); setFormCat('other'); setFormIncCat('salary');
    setCreating(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Błąd', 'Podaj nazwę szablonu'); return; }
    const amount = parseFloat(formAmount.replace(',', '.'));
    if (!amount || isNaN(amount) || amount <= 0) { Alert.alert('Błąd', 'Podaj kwotę'); return; }
    setSaving(true);
    try {
      const tmpl = await templatesService.add({
        name: formName.trim(),
        type: formType,
        amount,
        currency: 'PLN',
        category: formType === 'income' ? formIncCat : formCat,
        tags: [],
        note: formNote.trim(),
      });
      setTemplates(prev => [...prev, tmpl].sort((a, b) => a.name.localeCompare(b.name)));
      setCreating(false);
      toast.success('Szablon zapisany');
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Usuń szablon', `Usunąć "${name}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive',
        onPress: async () => {
          haptic.medium();
          await templatesService.remove(id).catch(() => {});
          setTemplates(prev => prev.filter(t => t.id !== id));
          toast.success('Szablon usunięty');
        },
      },
    ]);
  };

  const useTemplate = (tmpl: ExpenseTemplate) => {
    haptic.tap();
    router.back();
    setTimeout(() => {
      router.push({
        pathname: '/expenses/add',
        params: {
          type: tmpl.type,
          prefillAmount: String(tmpl.amount),
          prefillCategory: String(tmpl.category),
          prefillNote: tmpl.note,
        },
      } as any);
    }, 150);
  };

  const isIncome = formType === 'income';
  const catList  = isIncome ? INCOME_CATS : EXPENSE_CATS;
  const catMeta  = isIncome ? INCOME_CATEGORY_META : CATEGORY_META;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={s.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={s.title}>Szablony wydatków</Text>
        <PressableScale onPress={openCreate} style={s.addBtn}>
          <Plus size={20} color={colors.text.primary} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={s.hint}>Ładowanie...</Text>
        ) : templates.length === 0 ? (
          <View style={s.empty}>
            <ClipboardList size={32} color={colors.text.muted} />
            <Text style={s.emptyTitle}>Brak szablonów</Text>
            <Text style={s.emptyHint}>Stwórz pierwszy szablon by szybko dodawać powtarzające się transakcje.</Text>
            <AnimatedButton onPress={openCreate} label="Utwórz szablon" icon={<Plus size={16} color={colors.bg.primary} />} size="md" />
          </View>
        ) : (
          templates.map(tmpl => {
            const meta = (catMeta as any)[tmpl.category];
            const IconComp = meta?.icon ? (LucideIcons as any)[meta.icon] : null;
            const isInc = tmpl.type === 'income';
            return (
              <PressableScale key={tmpl.id} onPress={() => useTemplate(tmpl)}>
                <View style={s.row}>
                  <View style={[s.iconWrap, { backgroundColor: (meta?.color ?? colors.text.muted) + '18' }]}>
                    {IconComp
                      ? <IconComp size={16} color={meta?.color ?? colors.text.muted} />
                      : (isInc
                          ? <TrendingUp size={16} color={colors.accent.green} />
                          : <TrendingDown size={16} color={colors.accent.red} />)
                    }
                  </View>
                  <View style={s.rowInfo}>
                    <Text style={s.rowName}>{tmpl.name}</Text>
                    <Text style={s.rowSub}>{meta?.label ?? tmpl.category}{tmpl.note ? ` · ${tmpl.note}` : ''}</Text>
                  </View>
                  <Text style={[s.rowAmount, { color: isInc ? colors.accent.green : colors.text.primary }]}>
                    {isInc ? '+' : '-'}{tmpl.amount.toFixed(2)} zł
                  </Text>
                  <PressableScale onPress={() => handleDelete(tmpl.id, tmpl.name)} style={s.deleteBtn}>
                    <Trash2 size={15} color={colors.text.muted} />
                  </PressableScale>
                </View>
              </PressableScale>
            );
          })
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={creating} animationType="slide" transparent onRequestClose={() => setCreating(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nowy szablon</Text>
              <PressableScale onPress={() => setCreating(false)} style={s.closeBtn}>
                <X size={18} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Nazwa szablonu</Text>
              <TextInput
                style={s.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="np. Lunch w biurze"
                placeholderTextColor={colors.text.muted}
              />

              <Text style={s.fieldLabel}>Typ</Text>
              <View style={s.typeRow}>
                <TouchableOpacity
                  style={[s.typeBtn, formType === 'expense' && s.typeBtnActive]}
                  onPress={() => setFormType('expense')}
                >
                  <TrendingDown size={14} color={formType === 'expense' ? colors.accent.red : colors.text.muted} />
                  <Text style={[s.typeBtnText, formType === 'expense' && { color: colors.accent.red }]}>Wydatek</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, formType === 'income' && s.typeBtnActive]}
                  onPress={() => setFormType('income')}
                >
                  <TrendingUp size={14} color={formType === 'income' ? colors.accent.green : colors.text.muted} />
                  <Text style={[s.typeBtnText, formType === 'income' && { color: colors.accent.green }]}>Przychód</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>Kwota (zł)</Text>
              <TextInput
                style={s.input}
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder="0,00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
              />

              <Text style={s.fieldLabel}>Kategoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
                {catList.map(([key, meta]) => {
                  const selected = isIncome ? formIncCat === key : formCat === key;
                  const IconC = meta?.icon ? (LucideIcons as any)[meta.icon] : null;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[s.catChip, selected && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
                      onPress={() => isIncome ? setFormIncCat(key as IncomeCategory) : setFormCat(key as ExpenseCategory)}
                    >
                      {IconC && <IconC size={12} color={selected ? meta.color : colors.text.muted} />}
                      <Text style={[s.catChipText, selected && { color: meta.color }]}>{meta.label}</Text>
                      {selected && <Check size={10} color={meta.color} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.fieldLabel}>Notatka (opcjonalnie)</Text>
              <TextInput
                style={s.input}
                value={formNote}
                onChangeText={setFormNote}
                placeholder="Dodatkowy opis..."
                placeholderTextColor={colors.text.muted}
              />

              <AnimatedButton
                onPress={handleSave}
                label={saving ? 'Zapisuję...' : 'Zapisz szablon'}
                icon={<Check size={16} color={colors.bg.primary} />}
                size="md"
                fullWidth
                disabled={saving}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
    gap: spacing[3],
  },
  title: { flex: 1, ...typography.h3, color: colors.text.primary, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: spacing[4], gap: spacing[2], paddingBottom: 40 },
  hint: { color: colors.text.muted, fontSize: 13, textAlign: 'center', marginTop: spacing[6] },
  empty: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[8], paddingHorizontal: spacing[4] },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  emptyHint: { fontSize: 13, color: colors.text.muted, textAlign: 'center', lineHeight: 20 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4],
  },
  iconWrap: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  rowSub: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700' },
  deleteBtn: { padding: spacing[1] },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text.primary },
  modalBody: { padding: spacing[4], gap: spacing[3], paddingBottom: 40 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    color: colors.text.primary, fontSize: 15,
  },
  typeRow: { flexDirection: 'row', gap: spacing[2] },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  typeBtnActive: { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: colors.bg.card },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.muted },

  catScroll: { marginBottom: spacing[1] },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated, marginRight: spacing[2],
  },
  catChipText: { fontSize: 11, fontWeight: '600', color: colors.text.secondary },
});
