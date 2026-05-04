import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export default function InputField({ label, error, leftSlot, rightSlot, containerStyle, ...props }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        {leftSlot && <View style={styles.slot}>{leftSlot}</View>}
        <TextInput
          placeholderTextColor={colors.text.muted}
          {...props}
          style={[styles.input, props.style]}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
        />
        {rightSlot && <View style={styles.slot}>{rightSlot}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing[1] },
  label: { ...typography.label, color: colors.text.secondary },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    minHeight: 48,
  },
  inputWrapFocused: { borderColor: colors.border.focus },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing[3],
  },
  slot: { marginHorizontal: spacing[1] },
  error: { ...typography.caption, color: colors.accent.danger },
});
