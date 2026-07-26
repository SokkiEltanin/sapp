import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Play, Share2, ExternalLink, CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react-native';

import { runHealthSelfTest, SelfTestReport, SelfTestStatus, openHealthConnect } from '@/services/healthConnectService';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#ECEEEE';   // mono (redesign czarno-biały)

export default function HealthTest() {
  const c = useColors();
  const s = makeS(c);
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    haptic.tap();
    try { setReport(await runHealthSelfTest()); } catch { /* never throws, but be safe */ }
    setRunning(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  const statusColor = (st: SelfTestStatus) => st === 'ok' ? '#2AC68F' : st === 'warn' ? colors.accent.amber : colors.accent.red;
  const StatusIcon = ({ st }: { st: SelfTestStatus }) => {
    const col = statusColor(st);
    if (st === 'ok') return <CheckCircle2 size={18} color={col} />;
    if (st === 'warn') return <AlertTriangle size={18} color={col} />;
    return <XCircle size={18} color={col} />;
  };

  const counts = report ? {
    ok: report.rows.filter(r => r.status === 'ok').length,
    warn: report.rows.filter(r => r.status === 'warn').length,
    fail: report.rows.filter(r => r.status === 'fail').length,
  } : null;

  const share = () => { if (report) Share.share({ message: report.raw }).catch(() => {}); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Test połączeń zdrowia</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.intro}>
          <Activity size={16} color={ACCENT} />
          <Text style={s.introTxt}>Sprawdza, co Health Connect naprawdę oddaje na DZIŚ (kroki wg źródła, sen, waga, kalorie, woda, tętno). Zielone = działa, żółte = brak danych, czerwone = problem.</Text>
        </View>

        {counts && (
          <View style={s.summary}>
            <View style={s.sumPill}><CheckCircle2 size={14} color="#2AC68F" /><Text style={s.sumTxt}>{counts.ok}</Text></View>
            <View style={s.sumPill}><AlertTriangle size={14} color={colors.accent.amber} /><Text style={s.sumTxt}>{counts.warn}</Text></View>
            <View style={s.sumPill}><XCircle size={14} color={colors.accent.red} /><Text style={s.sumTxt}>{counts.fail}</Text></View>
          </View>
        )}

        {running && !report && (
          <View style={s.loading}><ActivityIndicator color={ACCENT} /><Text style={s.loadingTxt}>Sprawdzam…</Text></View>
        )}

        {report && (
          <View style={s.card}>
            {report.rows.map((r, i) => (
              <View key={r.key} style={[s.row, i > 0 && s.rowBorder]}>
                <StatusIcon st={r.status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{r.label}</Text>
                  <Text style={s.rowDetail}>{r.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[s.runBtn, { backgroundColor: running ? c.fill.subtle : ACCENT }]} disabled={running} onPress={run}>
          {running ? <ActivityIndicator color={c.text.muted} /> : <Play size={18} color="#08222E" />}
          <Text style={[s.runTxt, { color: running ? c.text.muted : '#08222E' }]}>{running ? 'Testuję…' : 'Uruchom test'}</Text>
        </TouchableOpacity>

        <View style={s.actions}>
          <TouchableOpacity style={s.actBtn} onPress={share} disabled={!report}>
            <Share2 size={16} color={c.text.secondary} /><Text style={s.actTxt}>Wyślij raport</Text>
          </TouchableOpacity>
          {Platform.OS === 'android' && (
            <TouchableOpacity style={s.actBtn} onPress={() => openHealthConnect()}>
              <ExternalLink size={16} color={c.text.secondary} /><Text style={s.actTxt}>Otwórz Health Connect</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.hint}>Kroki „wg źródła" pokazują każdą apkę piszącą do Health Connect. Jeśli jest kilka źródeł — bierzemy MAX (nie sumę), żeby nie liczyć zegarka i telefonu podwójnie.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  headerTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  scroll:    { padding: spacing[4], gap: spacing[3], paddingBottom: 60 },

  intro:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: ACCENT + '14', borderRadius: radius.lg, borderWidth: 1, borderColor: ACCENT + '44', padding: spacing[3] },
  introTxt: { flex: 1, fontSize: 12, color: c.text.secondary, lineHeight: 17 },

  summary: { flexDirection: 'row', gap: spacing[2], justifyContent: 'center' },
  sumPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.bg.card },
  sumTxt:  { fontSize: 14, fontWeight: '800', color: c.text.primary },

  loading:    { alignItems: 'center', gap: 8, paddingVertical: spacing[6] },
  loadingTxt: { fontSize: 13, color: c.text.muted },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[3], borderWidth: 1, borderColor: c.border.subtle },
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  rowLabel:  { fontSize: 14, fontWeight: '700', color: c.text.primary },
  rowDetail: { fontSize: 12, color: c.text.muted, marginTop: 2, lineHeight: 16 },

  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.full },
  runTxt: { fontSize: 15, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: spacing[2] },
  actBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle },
  actTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  hint: { fontSize: 11.5, color: c.text.muted, lineHeight: 16, marginTop: 4 },
}));
