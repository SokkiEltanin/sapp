import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export default function InputField({ label, error, leftSlot, rightSlot, containerStyle, ...props }: Props) {
  const c = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={[typography.label, { color: c.text.secondary }]}>{label}</Text>}
      <View style={[
        styles.inputWrap,
        { backgroundColor: c.bg.card, borderColor: focused ? c.border.focus : c.border.default },
      ]}>
        {leftSlot && <View style={styles.slot}>{leftSlot}</View>}
        <TextInput
          placeholderTextColor={c.text.muted}
          {...props}
          style={[styles.input, { color: c.text.primary }, props.style]}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
        />
        {rightSlot && <View style={styles.slot}>{rightSlot}</View>}
      </View>
      {error && <Text style={[typography.caption, { color: c.accent.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing[1] },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: spacing[3], minHeight: 48,
  },
  input: { flex: 1, ...typography.body, paddingVertical: spacing[3] },
  slot: { marginHorizontal: spacing[1] },
});
