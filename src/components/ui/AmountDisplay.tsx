import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/theme';

interface Props {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

const SIZES = { sm: 15, md: 20, lg: 28, xl: 38 };

export default function AmountDisplay({ amount, currency = 'PLN', size = 'md', color = colors.text.primary }: Props) {
  const formatted = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

  return (
    <Text style={[styles.text, { fontSize: SIZES[size], color }]}>{formatted}</Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    color: colors.text.primary,
  },
});
