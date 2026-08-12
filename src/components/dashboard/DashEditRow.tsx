import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { GripVertical, ChevronUp, ChevronDown, Pencil, Eye, EyeOff, Trash2 } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

// Row pitch used to turn a drag distance into an index. Measured, not guessed:
// editCtrlBtn2 height 40 + editRow paddingVertical 8×2 + borderWidth 1×2 = 58, plus the
// list's gap: spacing[2] = 8  →  66. (It was 68, which drifted a row every ~16 rows.)
const EDIT_ROW_H = 66;

export default function DashEditRow({
  id, index, count, title, desc, isCustom, hiddenNow, empty, accent, cardBg,
  onMoveDir, onMoveTo, onToggleHidden, onRemove, onEdit,
}: {
  id: string; index: number; count: number; title: string; desc?: string;
  isCustom: boolean; hiddenNow: boolean; empty?: boolean; accent: string; cardBg: string;
  onMoveDir: (id: string, dir: -1 | 1) => void;
  onMoveTo: (id: string, target: number) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Dragging used to be unreadable: the row slid freely, every other row stayed put, and
  // nothing said where it would land — you let go and it teleported. Now it SNAPS to slot
  // positions, so the row visibly clicks into the slot it will take, and it's clamped to
  // the list so you can't drag it into nowhere.
  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => { lifted.value = 1; })
    .onUpdate(e => {
      const minY = -index * EDIT_ROW_H;                 // can't go above the first slot
      const maxY = (count - 1 - index) * EDIT_ROW_H;    // ...or below the last
      const raw = Math.max(minY, Math.min(maxY, e.translationY));
      ty.value = Math.round(raw / EDIT_ROW_H) * EDIT_ROW_H;
    })
    .onEnd(() => {
      const target = index + Math.round(ty.value / EDIT_ROW_H);
      lifted.value = 0;
      ty.value = withTiming(0, { duration: 140 });
      if (target !== index) runOnJS(onMoveTo)(id, target);
    });

  // A lifted row reads as picked up: bigger, opaque, on top, with a real shadow.
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(ty.value, { duration: 90 }) }, { scale: lifted.value ? 1.04 : 1 }],
    zIndex: lifted.value ? 20 : 0,
    elevation: lifted.value ? 12 : 0,
    shadowOpacity: lifted.value ? 0.35 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowColor: '#000',
  }));

  // keep the row's normal subtle border when it's down — only the lifted row goes accent
  const idleBorder = colors.border.subtle;
  const liftStyle = useAnimatedStyle(() => ({
    borderColor: lifted.value ? accent : idleBorder,
    borderWidth: lifted.value ? 1.5 : 1,
  }));

  return (
    <Reanimated.View style={aStyle}>
      <Reanimated.View style={[s.editRow, { backgroundColor: cardBg }, liftStyle]}>
        <GestureDetector gesture={pan}>
          {/* the grab handle is the whole left block, not a 20px icon */}
          <View style={[s.editCtrlBtn2, { width: 44 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}>
            <GripVertical size={22} color={accent} />
          </View>
        </GestureDetector>
        <View style={s.editArrows}>
          <TouchableOpacity disabled={index === 0} onPress={() => { haptic.tap(); onMoveDir(id, -1); }} style={s.editArrowBtn2} hitSlop={8}>
            <ChevronUp size={20} color={index === 0 ? colors.text.muted + '50' : colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity disabled={index === count - 1} onPress={() => { haptic.tap(); onMoveDir(id, 1); }} style={s.editArrowBtn2} hitSlop={8}>
            <ChevronDown size={20} color={index === count - 1 ? colors.text.muted + '50' : colors.text.secondary} />
          </TouchableOpacity>
        </View>
        {/* name + a plain-language "what it shows" line, so rows aren't just cryptic
            titles you can't tell apart while dragging */}
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={[s.editRowTitle, empty && { opacity: 0.5 }]} numberOfLines={1}>
            {title}{isCustom ? '  · własny' : ''}
          </Text>
          {(desc || empty) ? (
            <Text style={s.editRowDesc} numberOfLines={1}>
              {empty ? 'brak danych teraz — pokaże się, gdy będą' : desc}
            </Text>
          ) : null}
        </View>
        {onEdit && (
          <TouchableOpacity onPress={() => { haptic.tap(); onEdit(id); }} style={s.editCtrlBtn2} hitSlop={10}>
            <Pencil size={19} color={accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { haptic.tap(); onToggleHidden(id); }} style={s.editCtrlBtn2} hitSlop={10}>
          {hiddenNow ? <EyeOff size={20} color={colors.text.muted} /> : <Eye size={20} color={accent} />}
        </TouchableOpacity>
        {isCustom && (
          <TouchableOpacity onPress={() => { haptic.medium(); onRemove(id); }} style={[s.editCtrlBtn2, { backgroundColor: 'rgba(228,52,52,0.12)' }]} hitSlop={10}>
            <Trash2 size={19} color={colors.accent.red} />
          </TouchableOpacity>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingLeft: spacing[2], paddingRight: spacing[1],
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle,
  },
  editCtrlBtn2: { width: 38, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  editArrows: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  editArrowBtn2: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  editRowTitle: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  editRowDesc: { fontSize: 10.5, color: c.text.muted },
}));
