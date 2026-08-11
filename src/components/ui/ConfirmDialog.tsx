import { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

// Custom-styled stand-in for Alert.alert's confirm-before-destructive-action pattern —
// user (2026-08-11): "potwierdzenia przed usunięciem nie są customowe, są jakimiś
// kwadratami bez naszego stylu, i to w wielu miejscach". Alert.alert renders the bare OS
// dialog (grey box, system font) — this matches the app's actual dark theme/card language
// (same overlay+centered-card shape as DatePickerField's modal, for a consistent "this is
// a Sapp modal" feel across the app).
//
// Deliberately a plain controlled component (visible/onConfirm/onCancel), not a global
// hook/promise API — mirrors how every other modal in this codebase works (BoxRevealModal,
// victory/defeat modals, DatePickerField's own internal Modal): local `useState` per
// screen, not a new app-wide pattern.
interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;   // true (default) = red confirm button, for delete-style actions
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible, title, message, confirmLabel = 'Usuń', cancelLabel = 'Anuluj', destructive = true, onConfirm, onCancel,
}: Props) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={s.overlay} onPress={onCancel}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.cancelTxt}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, destructive ? s.confirmBtnDanger : s.confirmBtnPlain]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[s.confirmTxt, destructive ? s.confirmTxtDanger : s.confirmTxtPlain]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5],
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: spacing[2],
  },
  title:   { fontSize: 16, fontWeight: '800', color: c.text.primary },
  message: { fontSize: 13, color: c.text.secondary, lineHeight: 18, marginTop: -2 },
  row: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 46,
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card,
  },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: c.text.secondary },
  confirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: radius.lg },
  confirmBtnDanger: { backgroundColor: colors.accent.red },
  confirmBtnPlain: { backgroundColor: c.text.primary },
  confirmTxt: { fontSize: 14, fontWeight: '800' },
  confirmTxtDanger: { color: '#fff' },
  confirmTxtPlain: { color: c.bg.primary },
}));
