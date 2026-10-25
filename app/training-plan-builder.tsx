import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, X } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useProfileStore } from '@/store/profileStore';
import { useTrainingPlansStore } from '@/store/trainingPlansStore';
import { TrainingPlanItem, genId } from '@/utils/trainingPlans';
import { ageFrom, targetsFor, TrainingExercise } from '@/utils/personalQuests';
import { EXERCISE_META } from '@/utils/exerciseMeta';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

// Builder planu treningowego (2026-10-14, ARCHITECTURE.md §320) — jeden formularz obsługuje
// trzy wejścia: pusty nowy plan, `?editId=<id>` (edycja istniejącego), `?dupId=<id>`
// (duplikacja — wczytuje pozycje źródłowego planu do draftu BEZ `editId`, więc zapis tworzy
// NOWY byt, nazwa z sufiksem "(kopia)"; ten sam wzorzec co `app/food/add.tsx?dupPreset=`,
// żadna osobna akcja store'u `duplicatePlan` — patrz komentarz w trainingPlansStore.ts).
//
// Pozycja planu MOŻE (ale nie musi) być podpięta pod jedno z 6 kanonicznych ćwiczeń
// (`linkedExercise`, patrz trainingPlans.ts) — chipsy niżej to skrót wypełniający
// nazwę/jednostkę/cel z `targetsFor()` i wiążący pozycję z questem/nagrodą pupila; "Własne"
// czyści powiązanie i wszystkie pola zostają w pełni edytowalne (user: "dowolne, własne nazwy
// też").
export default function TrainingPlanBuilderScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { birthdate, gender, trainingLevel } = useProfileStore();
  const { editId, dupId } = useLocalSearchParams<{ editId?: string; dupId?: string }>();
  const plans = useTrainingPlansStore((st) => st.plans);
  const addPlan = useTrainingPlansStore((st) => st.addPlan);
  const updatePlan = useTrainingPlansStore((st) => st.updatePlan);

  // §416 (2026-10-25) — ten sam fix co usePetQuests.ts/useExerciseLogging.ts: `targetsFor`
  // samo domyślnie ląduje na poziom początkujący gdy `trainingLevel` jest `null`, więc gate
  // tutaj niepotrzebnie chował skrót-chip "uzupełnij z celu" dla userów bez ustawionego
  // poziomu.
  const targets = useMemo(
    () => targetsFor(trainingLevel, ageFrom(birthdate), gender),
    [trainingLevel, birthdate, gender],
  );

  // Lazy init (funkcja w useState) — czyta store/params RAZ, przy montowaniu, nie przy każdym
  // renderze; edycja i duplikacja ładują się tu, dalej to czysto lokalny draft do Zapisu.
  const sourcePlan = useMemo(
    () => plans.find((p) => p.id === editId) ?? plans.find((p) => p.id === dupId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [name, setName] = useState(sourcePlan ? (editId ? sourcePlan.name : `${sourcePlan.name} (kopia)`) : '');
  const [items, setItems] = useState<TrainingPlanItem[]>(sourcePlan ? sourcePlan.items.map((it) => ({ ...it })) : []);
  const isEdit = !!editId && !!sourcePlan;

  const addItem = () => {
    haptic.tap();
    setItems((prev) => [...prev, { id: genId(), name: '', targetAmount: 10, unit: 'powt.' }]);
  };
  const updateItem = (id: string, patch: Partial<TrainingPlanItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const removeItem = (id: string) => {
    haptic.tap();
    setItems((prev) => prev.filter((it) => it.id !== id));
  };
  const pickCanonical = (id: string, exId: TrainingExercise) => {
    const meta = EXERCISE_META.find((m) => m.id === exId);
    if (!meta) return;
    haptic.tap();
    updateItem(id, { name: meta.label, unit: meta.unit, linkedExercise: exId, targetAmount: targets ? meta.target(targets) : 10 });
  };
  const pickCustom = (id: string) => {
    haptic.tap();
    updateItem(id, { linkedExercise: undefined });
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { toast.error('Podaj nazwę planu'); return; }
    const cleaned = items
      .map((it) => ({ ...it, name: it.name.trim(), unit: it.unit.trim() || 'x' }))
      .filter((it) => it.name.length > 0 && it.targetAmount > 0);
    if (cleaned.length === 0) { toast.error('Dodaj przynajmniej jedną pozycję z nazwą i celem > 0'); return; }
    if (isEdit) updatePlan(editId!, trimmedName, cleaned); else addPlan(trimmedName, cleaned);
    haptic.success();
    router.back();
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>{isEdit ? 'Edytuj plan' : 'Nowy plan'}</Text>
        <PressableScale onPress={save} style={s.saveBtn}><Text style={s.saveBtnTxt}>Zapisz</Text></PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TextInput
          style={s.nameInput}
          placeholder="Nazwa planu, np. Poranna seria"
          placeholderTextColor={c.text.muted}
          value={name}
          onChangeText={setName}
        />

        {items.map((it) => (
          <View key={it.id} style={s.itemCard}>
            <View style={s.chipsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {EXERCISE_META.map((m) => (
                  <PressableScale key={m.id} onPress={() => pickCanonical(it.id, m.id)} style={[s.chip, it.linkedExercise === m.id && s.chipActive]}>
                    <Text style={[s.chipTxt, it.linkedExercise === m.id && s.chipTxtActive]}>{m.label}</Text>
                  </PressableScale>
                ))}
                <PressableScale onPress={() => pickCustom(it.id)} style={[s.chip, !it.linkedExercise && s.chipActive]}>
                  <Text style={[s.chipTxt, !it.linkedExercise && s.chipTxtActive]}>Własne</Text>
                </PressableScale>
              </ScrollView>
              <PressableScale onPress={() => removeItem(it.id)} style={s.removeBtn}><X size={15} color="#EF4444" /></PressableScale>
            </View>

            <TextInput
              style={s.itemNameInput}
              placeholder="Nazwa ćwiczenia"
              placeholderTextColor={c.text.muted}
              value={it.name}
              onChangeText={(v) => updateItem(it.id, { name: v })}
            />
            <View style={s.itemRow}>
              <TextInput
                style={[s.itemInput, { flex: 1 }]}
                keyboardType="numeric"
                placeholder="Cel"
                placeholderTextColor={c.text.muted}
                value={it.targetAmount ? String(it.targetAmount) : ''}
                onChangeText={(v) => updateItem(it.id, { targetAmount: parseFloat(v.replace(',', '.')) || 0 })}
              />
              <TextInput
                style={[s.itemInput, { flex: 1 }]}
                placeholder="Jednostka"
                placeholderTextColor={c.text.muted}
                value={it.unit}
                onChangeText={(v) => updateItem(it.id, { unit: v })}
              />
            </View>
          </View>
        ))}

        <PressableScale onPress={addItem} style={s.addItemBtn}>
          <Plus size={16} color="#FB923C" />
          <Text style={s.addItemTxt}>Dodaj pozycję</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  saveBtnTxt: { fontSize: 14, fontWeight: '800', color: '#2AC68F' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 60, gap: spacing[3] },

  nameInput: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '700', color: c.text.primary },

  itemCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: spacing[2] },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  chipActive: { backgroundColor: '#FB923C1F', borderColor: '#FB923C' },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary },
  chipTxtActive: { color: '#FB923C' },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  itemNameInput: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: c.text.primary },
  itemRow: { flexDirection: 'row', gap: spacing[2] },
  itemInput: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: c.text.primary },

  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FB923C14', borderRadius: radius.lg, borderWidth: 1, borderColor: '#FB923C44', paddingVertical: 12 },
  addItemTxt: { fontSize: 13.5, fontWeight: '800', color: '#FB923C' },
}));
