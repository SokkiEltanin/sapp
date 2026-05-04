import { View, StyleSheet, ViewStyle } from 'react-native';
import { radius } from '@/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
  padding?: number;
  intensity?: number; // kept for API compat, unused
}

export default function GlassCard({ children, style, accentColor, padding }: Props) {
  return (
    <View style={[styles.outer, style]}>
      <View style={styles.topHighlight} />
      {accentColor && <View style={[styles.accentBar, { backgroundColor: accentColor }]} />}
      <View style={padding !== undefined ? { padding } : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  accentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 2,
  },
});
