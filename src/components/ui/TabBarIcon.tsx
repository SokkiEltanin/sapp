import { StyleSheet } from 'react-native';

// Using @expo/vector-icons bundled with Expo
// Replace with your preferred icon set if needed
let Ionicons: any;
try {
  Ionicons = require('@expo/vector-icons').Ionicons;
} catch {
  Ionicons = null;
}

interface Props {
  name: string;
  color: string;
  size: number;
}

export default function TabBarIcon({ name, color, size }: Props) {
  if (!Ionicons) return null;
  return <Ionicons name={name} size={size} color={color} />;
}
