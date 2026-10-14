import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, Play, Pencil, Copy, Trash2, ClipboardList } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTrainingPlansStore } from '@/store/trainingPlansStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Biblioteka planów treningowych (2026-10-14, ARCHITECTURE.md §320) — user: "żebym mógł sobie
// go kopiować i edytowac i np zaznaczać jak w jedzeniu co zrobiłem". Ten sam układ co
// `app/food/products.tsx` (lista kart, tap=akcja główna, ikony akcji obok): tu tap na kartę
// = od razu "Dzisiejsza sesja" (najczęstsza akcja — odpalenie planu), ikony Edytuj/Duplikuj/
// Usuń są osobne, nie schowane za long-pressem (plany to zwykle garstka pozycji, nie setki jak
// baza produktów w jedzeniu — pełny rząd ikon się mieści bez zatłoczenia).
export default function TrainingPlansScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const plans = useTrainingPlansStore((st) => st.plans);
  const removePlan = useTrainingPlansStore((st) => st.removePlan);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const confirmDelete = () => {
    if (toDelete) removePlan(toDelete);
    setToDelete(null);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Plany treningowe</Text>
        <PressableScale onPress={() => { haptic.tap(); router.push('/training-plan-builder' as any); }} style={s.addBtn}>
          <Plus size={20} color={c.text.primary} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {plans.length === 0 ? (
          <View style={s.empty}>
            <ClipboardList size={36} color={c.text.muted} />
            <Text style={s.emptyTitle}>Brak planów</Text>
            <Text style={s.emptyTxt}>
              Zbuduj własną sesję treningową — dowolne ćwiczenia, swoje cele — i odpalaj ją
              jednym tapem zamiast wpisywać wszystko ręcznie za każdym razem.
            </Text>
            <PressableScale onPress={() => { haptic.tap(); router.push('/training-plan-builder' as any); }} style={s.emptyBtn}>
              <Plus size={16} color="#07160F" />
              <Text style={s.emptyBtnTxt}>Stwórz pierwszy plan</Text>
            </PressableScale>
          </View>
        ) : (
          plans.map((p) => (
            <View key={p.id} style={s.card}>
              <PressableScale
                onPress={() => { haptic.tap(); router.push(`/training-session?planId=${p.id}` as any); }}
                style={s.cardMain}
              >
                <View style={s.playBadge}><Play size={16} color="#07160F" fill="#07160F" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.cardSub}>{p.items.length} {p.items.length === 1 ? 'pozycja' : 'pozycji'}</Text>
                </View>
              </PressableScale>
              <View style={s.cardActions}>
                <PressableScale
                  onPress={() => { haptic.tap(); router.push(`/training-plan-builder?editId=${p.id}` as any); }}
                  style={s.actionBtn}
                >
                  <Pencil size={15} color={c.text.secondary} />
                </PressableScale>
                <PressableScale
                  onPress={() => { haptic.tap(); router.push(`/training-plan-builder?dupId=${p.id}` as any); }}
                  style={s.actionBtn}
                >
                  <Copy size={15} color={c.text.secondary} />
                </PressableScale>
                <PressableScale onPress={() => { haptic.tap(); setToDelete(p.id); }} style={s.actionBtn}>
                  <Trash2 size={15} color="#EF4444" />
                </PressableScale>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!toDelete}
        title="Usunąć plan?"
        message="Nie wpłynie to na już zalogowane ćwiczenia — tylko sam szablon zniknie."
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 60, gap: spacing[3] },

  empty: { alignItems: 'center', gap: 8, paddingTop: spacing[8], paddingHorizontal: spacing[4] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary, marginTop: 4 },
  emptyTxt: { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 18 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2AC68F', borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10, marginTop: spacing[2] },
  emptyBtnTxt: { fontSize: 13, fontWeight: '800', color: '#07160F' },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, flexDirection: 'row', alignItems: 'center', paddingRight: spacing[2] },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing[3] },
  playBadge: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: '#2AC68F', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  cardSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 2 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
}));
