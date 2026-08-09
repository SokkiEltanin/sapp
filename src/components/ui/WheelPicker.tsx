import { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { colors, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Samsung-style scroll wheel: drag/flick through a column of values, the one
// under the center band is the selection. Native snapToInterval does the actual
// snapping (cheap, no gesture math of our own); JS only reads the settled offset
// to know which index is centered. `index` only re-syncs the scroll position on
// MOUNT (see the empty-dep effect) — re-syncing on every `index` change would
// fight the user's own scrolling, since onChange(index) flows straight back in
// as a new prop. Callers that need "jump to a fresh value" should remount via
// `key` (see TimePickerField, which bumps a key each time its modal opens).

const ITEM_H = 40;
const VISIBLE = 5;               // odd → a true center row
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

export default function WheelPicker({ values, index, onChange, width = 64 }: {
  values: string[]; index: number; onChange: (i: number) => void; width?: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const ref = useRef<ScrollView>(null);
  const [centered, setCentered] = useState(index);
  const lastHaptic = useRef(index);

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    Math.max(0, Math.min(values.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = settle(e);
    if (i !== centered) setCentered(i);
    if (i !== lastHaptic.current) { haptic.tap(); lastHaptic.current = i; }
  };
  const commit = (e: NativeSyntheticEvent<NativeScrollEvent>) => onChange(settle(e));

  return (
    <View style={[s.wrap, { width, height: ITEM_H * VISIBLE }]}>
      <View pointerEvents="none" style={[s.highlight, { top: PAD }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: PAD }}
        onScroll={onScroll}
        onMomentumScrollEnd={commit}
        onScrollEndDrag={commit}
      >
        {values.map((v, i) => (
          <View key={i} style={s.item}>
            <Text style={[s.itemText, i === centered && s.itemTextActive]}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  highlight: {
    position: 'absolute', left: 0, right: 0, height: ITEM_H,
    borderRadius: radius.md, backgroundColor: c.fill.subtle,
    borderWidth: 1, borderColor: c.border.default,
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 17, fontWeight: '600', color: c.text.muted },
  itemTextActive: { fontSize: 21, fontWeight: '800', color: c.text.primary },
}));
