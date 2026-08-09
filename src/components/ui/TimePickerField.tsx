import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import WheelPicker from './WheelPicker';

// Same field-that-opens-a-modal shape as DatePickerField, but a step/scroll wheel
// instead of tap-only chevrons — "jak w Samsungu... scroll... krokowy" (user).
interface Props {
  value: string;          // 'HH:MM' or ''
  onChange: (time: string) => void;
  placeholder?: string;
  style?: any;
  minuteStep?: number;    // default 5 — matches the old chevron picker's granularity
}

function pad(n: number) { return String(n).padStart(2, '0'); }
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

export default function TimePickerField({ value, onChange, placeholder, style, minuteStep = 5 }: Props) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);   // bumped each open → remounts the wheels at the right spot

  const MINUTES = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad(i * minuteStep)),
    [minuteStep],
  );

  const parse = (v: string) => {
    const [h, m] = (v || '09:00').split(':').map(Number);
    const hIndex = Math.max(0, Math.min(23, h || 0));
    const mIndex = Math.max(0, Math.min(MINUTES.length - 1, Math.round((m || 0) / minuteStep)));
    return { hIndex, mIndex };
  };

  const [draftH, setDraftH] = useState(0);
  const [draftM, setDraftM] = useState(0);

  const openPicker = () => {
    const { hIndex, mIndex } = parse(value);
    setDraftH(hIndex); setDraftM(mIndex);
    setOpenCount(n => n + 1);
    setOpen(true);
  };
  const confirm = () => {
    haptic.tap();
    onChange(`${HOURS[draftH]}:${MINUTES[draftM]}`);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity onPress={openPicker} style={[s.field, style]} activeOpacity={0.75}>
        <Clock size={14} color={c.text.muted} />
        <Text style={[s.value, !value && s.placeholder]}>
          {value || placeholder || 'Wybierz godzinę'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View style={s.overlay} />
        </Pressable>
        <View style={s.modal} pointerEvents="box-none">
          <View style={s.inner}>
            <Text style={s.title}>Godzina przypomnienia</Text>
            <View style={s.wheels}>
              <WheelPicker key={`h-${openCount}`} values={HOURS} index={draftH} onChange={setDraftH} />
              <Text style={s.sep}>:</Text>
              <WheelPicker key={`m-${openCount}`} values={MINUTES} index={draftM} onChange={setDraftM} />
            </View>
            <TouchableOpacity onPress={confirm} style={s.confirmBtn} activeOpacity={0.85}>
              <Text style={s.confirmText}>Gotowe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  value: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text.primary },
  placeholder: { color: c.text.muted },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  inner: {
    width: '100%', maxWidth: 300, backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: spacing[3], alignItems: 'center',
  },
  title: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  wheels: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sep: { fontSize: 21, fontWeight: '800', color: c.text.muted },

  confirmBtn: {
    alignSelf: 'stretch', alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.lg, backgroundColor: c.text.primary,
  },
  confirmText: { fontSize: 14, fontWeight: '800', color: c.bg.primary },
}));
