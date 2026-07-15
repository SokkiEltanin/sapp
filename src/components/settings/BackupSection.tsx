import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { CloudUpload, RotateCcw, Cloud, ShieldCheck, ShieldAlert, FileDown, ChevronDown } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { createBackup, listBackups, restoreBackup, exportSnapshotToFile, BackupMeta } from '@/services/backupService';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `dziś ${time}`;
  return `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupSection({ appBuild, googleUser, onConnectGoogle }: {
  appBuild?: number;
  googleUser?: string | null;
  onConnectGoogle?: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [busy, setBusy] = useState<'create' | 'restore' | 'load' | 'export' | null>('load');
  const [showAll, setShowAll] = useState(false);
  const protectedByGoogle = !!googleUser;

  const refresh = useCallback(async () => {
    try { setBackups(await listBackups()); } catch { /* offline */ }
    finally { setBusy(null); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onCreate = async () => {
    haptic.tap();
    setBusy('create');
    try {
      await createBackup(false, appBuild);
      haptic.success();
      toast.success('Kopia zapasowa utworzona');
      await refresh();
    } catch (e: any) {
      haptic.error();
      toast.error('Nie udało się utworzyć kopii — sprawdź połączenie');
      setBusy(null);
    }
  };

  const onExport = async () => {
    haptic.tap();
    setBusy('export');
    try {
      const { bytes } = await exportSnapshotToFile(appBuild);
      haptic.success();
      toast.success(`Wyeksportowano dane + analizę (${fmtSize(bytes)}) — wybierz, gdzie wysłać`);
    } catch (e: any) {
      haptic.error();
      toast.error('Nie udało się wyeksportować danych');
    } finally {
      setBusy(null);
    }
  };

  const onRestore = (b: BackupMeta) => {
    const total = Object.values(b.counts ?? {}).reduce((s, n) => s + n, 0);
    Alert.alert(
      'Przywrócić kopię?',
      `Z dnia ${fmtWhen(b.createdAt)}.\n\nObecne dane zostaną zastąpione danymi z tej kopii (${total} rekordów + ustawienia). Tego nie można cofnąć.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Przywróć', style: 'destructive', onPress: async () => {
            setBusy('restore');
            try {
              await restoreBackup(b.id);
              haptic.success();
              Alert.alert(
                'Przywrócono',
                'Aplikacja zostanie przeładowana, aby wczytać przywrócone dane.',
                [{ text: 'OK', onPress: () => { Updates.reloadAsync().catch(() => {}); } }],
              );
            } catch (e: any) {
              haptic.error();
              toast.error('Nie udało się przywrócić kopii');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Cloud size={15} color={c.text.secondary} />
        <Text style={s.title}>Kopia zapasowa (chmura)</Text>
      </View>
      <Text style={s.sub}>
        Zapisuje wszystkie dane i ustawienia w chmurze (auto raz dziennie, trzymane ~3 dni w kółko). Możesz przywrócić ostatnią lub wybraną.
      </Text>

      {protectedByGoogle ? (
        <View style={[s.banner, { backgroundColor: '#2AC68F14', borderColor: '#2AC68F44' }]}>
          <ShieldCheck size={15} color="#2AC68F" />
          <Text style={[s.bannerText, { color: '#2AC68F' }]}>
            Chronione kontem Google — kopie przetrwają reinstal i zmianę telefonu.
          </Text>
        </View>
      ) : (
        <View style={[s.banner, { backgroundColor: '#FBBF2414', borderColor: '#FBBF2444', flexDirection: 'column', alignItems: 'stretch', gap: spacing[2] }]}>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <ShieldAlert size={15} color="#FBBF24" />
            <Text style={[s.bannerText, { color: '#FBBF24' }]}>
              Kopie są tylko na tym koncie urządzenia. Po reinstalu/zmianie telefonu przepadną. Połącz z Google, żeby przetrwały.
            </Text>
          </View>
          {onConnectGoogle && (
            <PressableScale onPress={onConnectGoogle}>
              <View style={s.connectBtn}>
                <Text style={s.connectText}>Połącz z Google</Text>
              </View>
            </PressableScale>
          )}
        </View>
      )}

      <PressableScale onPress={onCreate} disabled={busy != null}>
        <View style={[s.createBtn, busy != null && { opacity: 0.5 }]}>
          {busy === 'create'
            ? <ActivityIndicator size="small" color={c.accent.blue} />
            : <CloudUpload size={16} color={c.accent.blue} />}
          <Text style={s.createText}>{busy === 'create' ? 'Tworzę kopię…' : 'Utwórz kopię teraz'}</Text>
        </View>
      </PressableScale>

      <PressableScale onPress={onExport} disabled={busy != null}>
        <View style={[s.exportBtn, busy != null && { opacity: 0.5 }]}>
          {busy === 'export'
            ? <ActivityIndicator size="small" color={c.text.secondary} />
            : <FileDown size={15} color={c.text.secondary} />}
          <Text style={s.exportText}>{busy === 'export' ? 'Eksportuję…' : 'Eksportuj dane do pliku (JSON)'}</Text>
        </View>
      </PressableScale>
      <Text style={s.exportHint}>
        Zawiera surowe dane + ustawienia (w tym dashboard) + sekcję „derived": jak apka je interpretuje (wypłaty, stawka zł/h, karty miesiąca, zdrowie) i ostrzeżenia spójności. Do wglądu/analizy.
      </Text>

      {busy === 'load' ? (
        <ActivityIndicator size="small" color={c.text.muted} style={{ marginTop: spacing[2] }} />
      ) : backups.length === 0 ? (
        <Text style={s.empty}>Brak kopii jeszcze.</Text>
      ) : (
        <View style={s.list}>
          {(showAll ? backups : backups.slice(0, 1)).map((b, i) => (
            <View key={b.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowWhen}>{fmtWhen(b.createdAt)}{i === 0 && !showAll ? ' · ostatnia' : ''}</Text>
                <Text style={s.rowMeta}>
                  {b.auto ? 'auto' : 'ręczna'} · {fmtSize(b.sizeBytes)}
                  {b.counts?.expenses != null ? ` · ${b.counts.expenses} wydatków` : ''}
                </Text>
              </View>
              <PressableScale onPress={() => onRestore(b)} disabled={busy != null}>
                <View style={s.restoreBtn}>
                  <RotateCcw size={13} color={c.text.secondary} />
                  <Text style={s.restoreText}>Przywróć</Text>
                </View>
              </PressableScale>
            </View>
          ))}
          {backups.length > 1 && (
            <PressableScale onPress={() => { haptic.tap(); setShowAll(v => !v); }}>
              <View style={s.moreRow}>
                <Text style={s.moreText}>{showAll ? 'Pokaż tylko ostatnią' : `Pokaż starsze (${backups.length - 1})`}</Text>
                <ChevronDown size={14} color={c.text.muted} style={showAll ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </View>
            </PressableScale>
          )}
        </View>
      )}

      {busy === 'restore' && (
        <View style={s.overlay}>
          <ActivityIndicator size="small" color={c.accent.blue} />
          <Text style={s.overlayText}>Przywracam…</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: c.border.default,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.body, fontWeight: '700', color: c.text.primary },
  sub: { fontSize: 12, color: c.text.muted, lineHeight: 17, marginTop: -spacing[1] },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.md, borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  connectBtn: {
    alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.md,
    backgroundColor: '#FBBF2422', borderWidth: 1, borderColor: '#FBBF2455',
  },
  connectText: { fontSize: 12, fontWeight: '700', color: '#FBBF24' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: c.accent.blue + '18', borderWidth: 1, borderColor: c.accent.blue + '40',
  },
  createText: { fontSize: 13, fontWeight: '700', color: c.accent.blue },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
  },
  exportText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  exportHint: { fontSize: 11, color: c.text.muted, lineHeight: 15, marginTop: -spacing[1] },
  empty: { fontSize: 12, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  rowWhen: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  rowMeta: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  restoreText: { fontSize: 12, fontWeight: '600', color: c.text.secondary },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[2], marginTop: 2 },
  moreText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  overlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingTop: spacing[2] },
  overlayText: { fontSize: 12, color: c.text.secondary },
}));
