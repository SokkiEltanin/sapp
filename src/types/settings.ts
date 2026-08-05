import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react-native';

export type LucideIcon = ComponentType<LucideProps>;

// Every control a settings row can render, kept generic so ONE row renderer
// (SettingsRow) covers switches/inputs/links — instead of ~15 near-identical
// inline TextInput/Switch blocks copy-pasted per row. `custom` is the escape
// hatch for genuinely bespoke bodies (diagnostics boxes, list builders) that
// don't reduce to label+control — they still get a title/keywords entry so
// search reaches them, they just own their own layout.
export type SettingsControl =
  | { kind: 'switch'; value: boolean; onChange: (v: boolean) => void }
  | {
      kind: 'text';
      value: string;
      onChangeText: (v: string) => void;
      onBlur?: () => void;
      placeholder?: string;
      // 'accent' = placeholder shows a live computed value (looks like real
      // data); 'muted' = placeholder is an example/hint. Defaults to 'muted'.
      placeholderColor?: 'accent' | 'muted';
      keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad';
      width?: number;
      align?: 'left' | 'right' | 'center';
      maxLength?: number;
    }
  | { kind: 'link'; onPress: () => void }
  | { kind: 'value'; text: string }
  | { kind: 'custom'; render: () => ReactNode }
  | { kind: 'none' };

// One row's worth of text + search metadata. `title`/`subtitle` are the CURRENT
// (Polish) UI strings — kept as plain strings, not JSX, specifically so a future
// locale swap is "replace this string" rather than "find it inside 1800 lines
// of markup". `keywords` are extra search terms a user might type that don't
// appear verbatim in the title (synonyms, abbreviations, related concepts).
export interface SettingsItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accentColor?: string;
  keywords: string[];
  control: SettingsControl;
}

export interface SettingsSectionDef {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  keywords: string[];
  defaultOpen?: boolean;
  headerRight?: ReactNode;
  items: SettingsItem[];
}
