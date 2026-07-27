import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { CalendarEvent } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

// POZIOMY timeline dnia — czas płynie lewo→prawo. Eventy to bloki ułożone w pasmach
// (lanes) żeby się nie nakładały, oś godzin pod spodem, czerwona linia „teraz", a
// wydarzenia całodniowe jako pille nad osią. Kompaktowy i czytelny (zamiast pionowej
// osi ~1000px). Kolory eventów zachowane (kalendarz = kolor).

function toMins(t?: string): number {
  if (!t) return 9 * 60;
  const [h, m] = t.split(':').map(Number);
  return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
}
const pad2 = (n: number) => String(n).padStart(2, '0');

interface Props {
  events: CalendarEvent[];
  date: string;
  onPress?: (id: string) => void;
  onAddAtTime?: (time: string) => void;
}

const LANE_H = 32;
const LANE_GAP = 5;
const AXIS_H = 20;
const MAX_LANES = 4;

export default function DayTimelineH({ events, date, onPress, onAddAtTime }: Props) {
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const isToday = date === today;
  const [w, setW] = useState(300);

  const timed = events.filter(e => e.startTime).sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
  const allDay = events.filter(e => !e.startTime);

  // Okno osi: od najwcześniejszego eventu (lub 7:00) do najpóźniejszego końca (lub 21:00),
  // zaokrąglone do pełnych godzin; „teraz" też mieści się w oknie.
  let startMin = 7 * 60, endMin = 21 * 60;
  if (timed.length) {
    const es = Math.min(...timed.map(e => toMins(e.startTime)));
    const ee = Math.max(...timed.map(e => Math.max(toMins(e.startTime) + 30, toMins(e.endTime ?? e.startTime))));
    startMin = Math.min(startMin, Math.floor(es / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(ee / 60) * 60);
  }
  if (isToday) {
    const nowM = now.getHours() * 60 + now.getMinutes();
    startMin = Math.min(startMin, Math.floor(nowM / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(nowM / 60) * 60);
  }
  startMin = Math.max(0, startMin);
  endMin = Math.min(24 * 60, endMin);
  const span = Math.max(60, endMin - startMin);
  const xOf = (min: number) => ((min - startMin) / span) * w;

  // Pasma (greedy) — event ląduje w pierwszym wolnym pasmie.
  const laneEnds: number[] = [];
  const laneOf: number[] = [];
  for (const ev of timed) {
    const s = toMins(ev.startTime);
    const e = Math.max(s + 30, toMins(ev.endTime ?? ev.startTime));
    let lane = laneEnds.findIndex(end => end <= s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
    laneOf.push(Math.min(lane, MAX_LANES - 1));
  }
  const lanes = Math.min(MAX_LANES, Math.max(1, laneEnds.length));
  const lanesH = lanes * LANE_H + (lanes - 1) * LANE_GAP;

  // Podziałka godzin — rzadsza przy szerokim oknie.
  const startH = Math.floor(startMin / 60), endH = Math.ceil(endMin / 60);
  const range = endH - startH;
  const step = range > 12 ? 3 : range > 7 ? 2 : 1;
  const ticks: number[] = [];
  for (let h = startH; h <= endH; h += step) ticks.push(h);

  const nowX = isToday ? xOf(now.getHours() * 60 + now.getMinutes()) : -1;

  return (
    <View>
      {allDay.length > 0 && (
        <View style={st.allDayRow}>
          {allDay.map(ev => {
            const col = ev.color ?? colors.accent.purple;
            return (
              <Pressable key={ev.id} onPress={() => { haptic.tap(); onPress?.(ev.id); }}
                style={[st.allDayPill, { backgroundColor: col + '28', borderColor: col + '55' }]}>
                <Text style={[st.allDayText, { color: col }]} numberOfLines={1}>{ev.title}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        activeOpacity={1}
        onLayout={e => setW(e.nativeEvent.layout.width)}
        onPress={e => {
          if (!onAddAtTime) return;
          haptic.tap();
          const frac = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
          const min = startMin + frac * span;
          const h = Math.floor(min / 60);
          const m = Math.min(45, Math.round((min % 60) / 15) * 15);
          onAddAtTime(`${pad2(h)}:${pad2(m)}`);
        }}
        style={{ height: lanesH + AXIS_H + 6 }}
      >
        {/* Pasma z eventami */}
        <View style={{ height: lanesH }}>
          {nowX >= 0 && nowX <= w && (
            <View style={[st.nowLine, { left: nowX, height: lanesH }]} pointerEvents="none">
              <View style={st.nowDot} />
            </View>
          )}
          {timed.map((ev, i) => {
            const s = toMins(ev.startTime);
            const e = Math.max(s + 30, toMins(ev.endTime ?? ev.startTime));
            const left = xOf(s);
            const width = Math.max(22, xOf(e) - left);
            const col = ev.color ?? colors.accent.purple;
            return (
              <Pressable
                key={ev.id}
                onPress={() => { haptic.tap(); onPress?.(ev.id); }}
                style={[st.block, {
                  left, width, top: laneOf[i] * (LANE_H + LANE_GAP),
                  backgroundColor: col + '26', borderLeftColor: col,
                }]}
              >
                <Text style={[st.blockTitle, { color: col }]} numberOfLines={1}>{ev.title}</Text>
                {width > 60 && (
                  <Text style={[st.blockTime, { color: col + 'CC' }]} numberOfLines={1}>{ev.startTime}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Oś godzin */}
        <View style={[st.axis, { height: AXIS_H }]}>
          <View style={st.axisLine} />
          {ticks.map(h => {
            const x = xOf(h * 60);
            return (
              <View key={h} style={[st.tick, { left: Math.min(x, w - 16) }]}>
                <View style={st.tickMark} />
                <Text style={st.tickLabel}>{pad2(h)}</Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>

      {timed.length === 0 && allDay.length === 0 && (
        <Text style={st.noEv}>Brak wydarzeń · dotknij oś, by dodać</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  allDayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginBottom: spacing[2] },
  allDayPill: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
  allDayText: { fontSize: 11, fontWeight: '600' },

  block: {
    position: 'absolute', height: LANE_H,
    borderLeftWidth: 3, borderRadius: radius.sm,
    paddingHorizontal: spacing[2], paddingVertical: 3,
    justifyContent: 'center', overflow: 'hidden',
  },
  blockTitle: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  blockTime: { fontSize: 9, fontWeight: '600', marginTop: 1 },

  nowLine: { position: 'absolute', top: 0, width: 1.5, backgroundColor: colors.accent.red, zIndex: 10 },
  nowDot: { position: 'absolute', top: -3, left: -3.5, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.red },

  axis: { position: 'relative', marginTop: 6 },
  axisLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  tick: { position: 'absolute', top: 0, alignItems: 'center' },
  tickMark: { width: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  tickLabel: { fontSize: 9, color: colors.text.muted, fontWeight: '600', marginTop: 2 },

  noEv: { fontSize: 12, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing[3] },
});
