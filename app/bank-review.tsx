import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Check, X, Landmark, Zap, Sparkles } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useBankQueue, PendingBankTx } from '@/store/bankQueueStore';
import { commitBankTx } from '@/services/bankCommit';
import { loadMerchantMemory, setMerchantAuto, AUTO_THRESHOLD, MerchantMemory } from '@/utils/merchantMemory';
import { ExpenseCategory } from '@/types';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const CATS: [ExpenseCategory, string][] = [
  ['groceries', 'Spożywcze'], ['transport', 'Transport'], ['entertainment', 'Rozrywka'],
  ['health', 'Zdrowie'], ['clothing', 'Ubrania'], ['housing', 'Mieszkanie'],
  ['subscriptions', 'Subskrypcje'], ['other', 'Inne'],
];

export default function BankReview() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { pending, update, remove } = useBankQueue();
  const [mem, setMem] = useState<MerchantMemory>({});
  const reloadMem = useCallback(() => { loadMerchantMemory().then(setMem).catch(() => {}); }, []);
  useFocusEffect(reloadMem);

  const accept = async (p: PendingBankTx) => {
    haptic.success();
    const corrected = p.category !== p.suggestedCategory; // reader guessed wrong → don't reward trust
    const res = await commitBankTx(p, { corrected });
    if (!res.ok) { toast.error('Nie udało się dodać'); return; }
    if (res.matched) {
      toast.success(`Dopasowano do paragonu: ${p.store || 'płatność'}`);
    } else if (res.merchant?.auto && (res.merchant.cleanAccepts ?? 0) === AUTO_THRESHOLD) {
      toast.success(`${p.store || 'Sklep'} przechodzi na automat — kolejne płatności dodam sam`);
    } else if (!corrected && res.merchant) {
      const left = Math.max(0, AUTO_THRESHOLD - (res.merchant.cleanAccepts ?? 0));
      toast.success(left > 0 ? `Dodano · jeszcze ${left} do automatu` : `Dodano: ${p.amount.toFixed(2)} zł`);
    } else {
      toast.success(`Dodano: ${p.amount.toFixed(2)} zł · ${p.store || 'płatność'}`);
    }
    reloadMem();
    remove(p.id);
  };

  const reject = (p: PendingBankTx) => { haptic.tap(); remove(p.id); };

  const revoke = (storeKey: string, name?: string) => {
    haptic.tap();
    setMerchantAuto(storeKey, false).then(reloadMem).catch(() => {});
    toast.info(`${name || 'Sklep'} wróci do ręcznej akceptacji`);
  };

  // Shops that graduated to autopilot — shown so the user can revoke trust.
  const autoMerchants = useMemo(
    () => Object.entries(mem).filter(([, v]) => v.auto).map(([k, v]) => ({ key: k, name: v.name || k })),
    [mem],
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Płatności z banku</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {pending.length === 0 && (
          <View style={s.empty}>
            <Landmark size={30} color={c.text.muted} />
            <Text style={s.emptyText}>Brak płatności do zatwierdzenia. Gdy zapłacisz kartą, powiadomienie z banku pojawi się tu automatycznie.</Text>
          </View>
        )}
        {pending.map(p => {
          const d = new Date(p.dateISO);
          const info = mem[p.storeKey];
          const accepts = info?.cleanAccepts ?? 0;
          return (
            <View key={p.id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.amount}>{p.amount.toFixed(2)} zł</Text>
                <Text style={s.time}>{d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={s.fieldLabel}>Sklep</Text>
              <TextInput value={p.store} onChangeText={v => update(p.id, { store: v })} style={s.input} placeholderTextColor={c.text.muted} placeholder="Sklep" />
              <Text style={s.fieldLabel}>Kategoria</Text>
              <View style={s.catRow}>
                {CATS.map(([cat, lbl]) => {
                  const active = p.category === cat;
                  return (
                    <TouchableOpacity key={cat} style={[s.catChip, active && { backgroundColor: '#46B0DE22', borderColor: '#46B0DE' }]}
                      onPress={() => { haptic.tap(); update(p.id, { category: cat }); }} activeOpacity={0.8}>
                      <Text style={[s.catText, active && { color: '#46B0DE' }]}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {info?.auto ? (
                <View style={s.trustRow}>
                  <Zap size={13} color="#2AC68F" />
                  <Text style={s.trustAuto}>Sklep na automacie — kolejne dodam sam</Text>
                </View>
              ) : (
                <View style={s.trustRow}>
                  <Sparkles size={13} color={c.text.muted} />
                  <Text style={s.trustText}>Zaufanie {accepts}/{AUTO_THRESHOLD} → automat</Text>
                  <View style={s.trustBar}>
                    <View style={[s.trustFill, { width: `${Math.min(100, (accepts / AUTO_THRESHOLD) * 100)}%` }]} />
                  </View>
                </View>
              )}
              <View style={s.actions}>
                <TouchableOpacity style={[s.actBtn, s.rejectBtn]} onPress={() => reject(p)} activeOpacity={0.85}>
                  <X size={16} color={c.accent.red} /><Text style={[s.actText, { color: c.accent.red }]}>Odrzuć</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, s.acceptBtn]} onPress={() => accept(p)} activeOpacity={0.85}>
                  <Check size={16} color="#fff" /><Text style={[s.actText, { color: '#fff' }]}>Zatwierdź</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {autoMerchants.length > 0 && (
          <View style={s.trusted}>
            <View style={s.trustedHead}>
              <Zap size={16} color="#2AC68F" />
              <Text style={s.trustedTitle}>Zaufane sklepy (automat)</Text>
            </View>
            <Text style={s.trustedSub}>Płatności z tych sklepów dodaję automatycznie. Stuknij ×, by wrócić do ręcznej akceptacji.</Text>
            {autoMerchants.map(m => (
              <View key={m.key} style={s.trustedRow}>
                <Text style={s.trustedName} numberOfLines={1}>{m.name}</Text>
                <TouchableOpacity onPress={() => revoke(m.key, m.name)} style={s.trustedRevoke} activeOpacity={0.8} hitSlop={8}>
                  <X size={15} color={c.text.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  emptyText: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  amount: { fontSize: 24, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  time: { fontSize: 12, color: c.text.muted, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing[3], marginBottom: spacing[1] },
  input: { backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 15, color: c.text.primary },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catChip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary },
  catText: { fontSize: 12.5, fontWeight: '600', color: c.text.secondary },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3] },
  trustText: { fontSize: 11.5, fontWeight: '700', color: c.text.muted },
  trustAuto: { fontSize: 11.5, fontWeight: '800', color: '#2AC68F' },
  trustBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.border.default, overflow: 'hidden', marginLeft: 4 },
  trustFill: { height: '100%', borderRadius: 3, backgroundColor: '#2AC68F' },
  trusted: { marginTop: spacing[4], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  trustedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustedTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  trustedSub: { fontSize: 12, color: c.text.muted, lineHeight: 17, marginTop: spacing[1], marginBottom: spacing[2] },
  trustedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border.default },
  trustedName: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text.secondary },
  trustedRevoke: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: c.bg.primary },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg },
  rejectBtn: { borderWidth: 1, borderColor: c.accent.red + '55', backgroundColor: c.accent.red + '12' },
  acceptBtn: { backgroundColor: '#46B0DE' },
  actText: { fontSize: 14, fontWeight: '800' },
});
