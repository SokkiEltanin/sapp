import { memo } from 'react';
import { View, Text } from 'react-native';
import { Flame } from 'lucide-react-native';
import { spacing } from '@/theme';

function CalorieBalanceSection(
  { s, cardBg, accentColor, colors, cb }: { s: any; cardBg: string; accentColor: string; colors: any; cb: any },
) {
  const t = cb.today;
  const bmax = Math.max(...cb.days.map((d: any) => Math.abs(d.balance)), 800);
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Flame size={13} color={accentColor} />
        <Text style={s.cardTitle}>Bilans kalorii</Text>
        <Text style={[s.foodTotal, { color: t.balance >= 0 ? colors.accent.green : colors.accent.red }]}>
          {t.balance >= 0 ? '−' : '+'}{Math.abs(t.balance).toLocaleString('pl-PL')} kcal
        </Text>
      </View>
      <Text style={s.statSub}>Dziś: zjedzone {t.eaten.toLocaleString('pl-PL')} · spalone {t.burn > 0 ? t.burn.toLocaleString('pl-PL') : '—'} · cel {cb.target.toLocaleString('pl-PL')}</Text>
      <View style={{ flexDirection: 'row', gap: 6, height: 50, alignItems: 'flex-end', marginTop: spacing[2] }}>
        {cb.days.map((d: any) => {
          const has = d.eaten > 0;
          const mag = Math.min(1, Math.abs(d.balance) / bmax);
          const col = !has ? 'rgba(255,255,255,0.10)' : d.balance >= 0 ? colors.accent.green : colors.accent.red;
          return (
            <View key={d.key} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <View style={{ width: '100%', height: 38, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'flex-end', overflow: 'hidden' }}>
                <View style={{ width: '100%', height: `${has ? Math.max(7, mag * 100) : 0}%`, backgroundColor: col, borderRadius: 3 }} />
              </View>
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.text.muted }}>{d.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[s.statSub, { marginTop: spacing[2] }]}>
        {cb.cumDeficit >= 0
          ? `Deficyt (${cb.loggedCount} ${cb.loggedCount === 1 ? 'dzień' : 'dni'}) ≈ −${Math.abs(cb.kg).toFixed(2)} kg · zielony = deficyt`
          : `Nadwyżka (${cb.loggedCount} ${cb.loggedCount === 1 ? 'dzień' : 'dni'}) ≈ +${Math.abs(cb.kg).toFixed(2)} kg · czerwony = nadwyżka`}
      </Text>
    </View>
  );
}

export default memo(CalorieBalanceSection);
