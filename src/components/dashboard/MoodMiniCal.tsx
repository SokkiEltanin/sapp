import { View, Text } from 'react-native';
import { useColors } from '@/theme/useColors';
import { moodColor } from '@/utils/dashboard/format';
import { MoodEntry } from '@/types';

const MINI_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

export default function MoodMiniCal({ moodByDay }: { moodByDay: Record<string, MoodEntry[]> }) {
  const colors = useColors();
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const p2 = (n: number) => String(n).padStart(2, '0');

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {MINI_DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 7, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.4 }}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={{ flex: 1 }} />;
            const dateStr = `${year}-${p2(month + 1)}-${p2(day)}`;
            const entries = moodByDay[dateStr] ?? [];
            const avgM = entries.length ? entries.reduce((a, b) => a + b.mood, 0) / entries.length : null;
            const mc = avgM != null ? moodColor(avgM) : null;
            const isT = day === today;
            return (
              <View key={ci} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: mc ? mc : colors.border.subtle,
                  opacity: mc ? 0.88 : 1,
                  borderWidth: isT ? 1.5 : 0,
                  borderColor: isT ? colors.border.focus : 'transparent',
                }} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
