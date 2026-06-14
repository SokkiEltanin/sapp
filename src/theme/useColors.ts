import { useColorScheme } from 'react-native';
import { colors as darkColors, Colors } from './colors';
import { lightColors } from './lightColors';
import { useThemeStore } from '@/store/themeStore';

// Reactive palette. Components built on this re-render and flip when the user
// switches the theme (dark / light / follow system). Existing screens still
// import the static `colors` (dark) until migrated to this hook.
export function useColors(): Colors {
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme();
  const isLight = mode === 'light' || (mode === 'system' && system === 'light');
  return (isLight ? lightColors : darkColors) as Colors;
}
