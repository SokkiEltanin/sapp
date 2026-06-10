import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { CloudUpload, RotateCcw, Cloud, ShieldCheck, ShieldAlert } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { createBackup, listBackups, restoreBackup, BackupMeta } from '@/services/backupService';

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
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [busy, setBusy] = useState<'create' | 'restore' | 'load' | null>('load');
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
        <Cloud size={15} color={colors.text.secondary} />
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
            ? <ActivityIndicator size="small" color={colors.accent.blue} />
            : <CloudUpload size={16} color={colors.accent.blue} />}
          <Text style={s.createText}>{busy === 'create' ? 'Tworzę kopię…' : 'Utwórz kopię teraz'}</Text>
        </View>
      </PressableScale>

      {busy === 'load' ? (
        <ActivityIndicator size="small" color={colors.text.muted} style={{ marginTop: spacing[2] }} />
      ) : backups.length === 0 ? (
        <Text style={s.empty}>Brak kopii jeszcze.</Text>
      ) : (
        <View style={s.list}>
          {backups.map((b, i) => (
            <View key={b.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowWhen}>{fmtWhen(b.createdAt)}{i === 0 ? ' · ostatnia' : ''}</Text>
                <Text style={s.rowMeta}>
                  {b.auto ? 'auto' : 'ręczna'} · {fmtSize(b.sizeBytes)}
                  {b.counts?.expenses != null ? ` · ${b.counts.expenses} wydatków` : ''}
                </Text>
              </View>
              <PressableScale onPress={() => onRestore(b)} disabled={busy != null}>
                <View style={s.restoreBtn}>
                  <RotateCcw size={13} color={colors.text.secondary} />
                  <Text style={s.restoreText}>Przywróć</Text>
                </View>
              </PressableScale>
            </View>
          ))}
        </View>
      )}

      {busy === 'restore' && (
        <View style={s.overlay}>
          <ActivityIndicator size="small" color={colors.accent.blue} />
          <Text style={s.overlayText}>Przywracam…</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: colors.border.default,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.body, fontWeight: '700', color: colors.text.primary },
  sub: { fontSize: 12, color: colors.text.muted, lineHeight: 17, marginTop: -spacing[1] },
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
    backgroundColor: colors.accent.blue + '18', borderWidth: 1, borderColor: colors.accent.blue + '40',
  },
  createText: { fontSize: 13, fontWeight: '700', color: colors.accent.blue },
  empty: { fontSize: 12, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rowWhen: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  rowMeta: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.elevated,
  },
  restoreText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  overlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingTop: spacing[2] },
  overlayText: { fontSize: 12, color: colors.text.secondary },
});
