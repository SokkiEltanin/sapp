import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ChevronLeft, Check, Lock, Palette } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useSkinStore } from '@/store/skinStore';
import { SKINS, SkinProgress, EMPTY_PROGRESS, isSkinUnlocked, skinUnlockHint, Skin } from '@/theme/skins';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const ACCENT = '#A78BFA';

export default function Skins() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const active = useSkinStore(st => st.active);
  const setActive = useSkinStore(st => st.setActive);
  const [progress, setProgress] = useState<SkinProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    AsyncStorage.getItem('skin_progress')
      .then(raw => { if (raw) setProgress(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const unlockedCount = SKINS.filter(sk => isSkinUnlocked(sk, progress)).length;

  const onPick = (sk: Skin) => {
    if (!isSkinUnlocked(sk, progress)) { haptic.error(); toast.info(skinUnlockHint(sk)); return; }
    haptic.success();
    setActive(sk.id);
    toast.success(`Skórka: ${sk.name}`);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Skórki</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.intro}>
          <View style={s.introBadge}><Palette size={15} color={ACCENT} /></View>
          <Text style={s.introText}>
            <Text style={s.introNum}>{unlockedCount}</Text>/{SKINS.length} odblokowanych · zbieraj karty miesiąca, by odkryć kolejne
          </Text>
        </View>

        <View style={s.grid}>
          {SKINS.map(sk => {
            const unlocked = isSkinUnlocked(sk, progress);
            const selected = active === sk.id;
            return (
              <PressableScale key={sk.id} onPress={() => onPick(sk)} style={s.cell}>
                <LinearGradient colors={sk.preview} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.swatch, selected && { borderColor: sk.preview[0], borderWidth: 2 }, !unlocked && { opacity: 0.4 }]}>
                  <Text style={s.swatchEmoji}>{sk.emoji}</Text>
                  {selected && <View style={s.check}><Check size={13} color="#fff" /></View>}
                  {!unlocked && <View style={s.lock}><Lock size={16} color="#fff" /></View>}
                </LinearGradient>
                <Text style={[s.name, selected && { color: c.text.primary, fontWeight: '800' }]} numberOfLines={1}>{sk.name}</Text>
                <Text style={s.hint} numberOfLines={1}>{unlocked ? (selected ? 'Wybrana' : 'Dostępna') : skinUnlockHint(sk)}</Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8] },

  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing[4] },
  introBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, fontSize: 13, color: c.text.secondary, fontWeight: '600', lineHeight: 18 },
  introNum: { color: c.text.primary, fontWeight: '900', fontSize: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  cell: { width: '30%', alignItems: 'center' },
  swatch: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  swatchEmoji: { fontSize: 30 },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary, marginTop: 6 },
  hint: { fontSize: 10, color: c.text.muted, marginTop: 1, textAlign: 'center' },
});
