import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import AnimatedButton from './AnimatedButton';
import { colors, spacing, radius, typography } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  icon?: React.ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onDismiss: () => void;
}

export default function FullScreenAlert({
  visible, title, message, icon,
  primaryLabel = 'OK', secondaryLabel,
  onPrimary, onSecondary, onDismiss,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.sheet}>
          <Pressable onPress={onDismiss} style={styles.closeBtn}>
            <X size={18} color={colors.text.secondary} />
          </Pressable>

          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryLabel && (
              <AnimatedButton
                onPress={() => { onSecondary?.(); onDismiss(); }}
                label={secondaryLabel}
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
              />
            )}
            <AnimatedButton
              onPress={() => { onPrimary?.(); onDismiss(); }}
              label={primaryLabel}
              variant="primary"
              size="md"
              style={{ flex: secondaryLabel ? 1 : undefined }}
              fullWidth={!secondaryLabel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: spacing[6],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.bg.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  iconWrap: { alignItems: 'center', paddingVertical: spacing[2] },
  title:   { ...typography.h3, color: colors.text.primary, textAlign: 'center' },
  message: { ...typography.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
});
