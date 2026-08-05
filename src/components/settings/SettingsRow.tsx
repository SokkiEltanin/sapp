import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, typography } from '@/theme';
import { SettingsItem } from '@/types/settings';

// One generic renderer for the ~90% of settings rows that are "icon + label
// (+ subtitle) + one control" — switch, text input, or a chevron link. Reduces
// ~15 near-identical inline TextInput/Switch blocks that used to live in
// settings.tsx to this single component. `custom` items opt out entirely and
// render their own bespoke body (diagnostics boxes, list builders).
export default function SettingsRow({ item, first }: { item: SettingsItem; first?: boolean }) {
  const c = useColors();
  const s = makeS(c);

  if (item.control.kind === 'custom') return <>{item.control.render()}</>;

  const accent = item.accentColor ?? c.text.secondary;
  const Icon = item.icon;

  const body = (
    <View style={[s.row, !first && s.rowBorder]}>
      {Icon && (
        <View style={[s.iconWrap, item.accentColor ? { backgroundColor: item.accentColor + '18' } : null]}>
          <Icon size={16} color={accent} />
        </View>
      )}
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{item.title}</Text>
        {item.subtitle ? <Text style={s.rowSub}>{item.subtitle}</Text> : null}
      </View>

      {item.control.kind === 'switch' && (
        <Switch
          value={item.control.value}
          onValueChange={item.control.onChange}
          trackColor={{ false: c.fill.strong, true: accent + '99' }}
          thumbColor={item.control.value ? accent : c.text.muted}
        />
      )}

      {item.control.kind === 'text' && (
        <TextInput
          value={item.control.value}
          onChangeText={item.control.onChangeText}
          onBlur={item.control.onBlur}
          placeholder={item.control.placeholder}
          placeholderTextColor={item.control.placeholderColor === 'accent' ? accent : c.text.muted}
          keyboardType={item.control.keyboardType ?? 'default'}
          maxLength={item.control.maxLength}
          autoCapitalize="none"
          style={[s.textInput, {
            color: accent,
            minWidth: item.control.width ?? 72,
            textAlign: item.control.align ?? 'right',
            backgroundColor: accent + '12',
            borderColor: accent + '30',
          }]}
        />
      )}

      {item.control.kind === 'link' && (
        <ChevronLeft size={16} color={c.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
      )}

      {item.control.kind === 'value' && (
        <Text style={s.valueText}>{item.control.text}</Text>
      )}
    </View>
  );

  if (item.control.kind === 'link') {
    const onPress = item.control.onPress;
    return <PressableScale onPress={onPress}>{body}</PressableScale>;
  }
  return body;
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowText: { flex: 1 },
  rowLabel: { ...typography.bodySmall, color: c.text.primary, fontWeight: '500' },
  rowSub: { ...typography.caption, color: c.text.muted, marginTop: 1 },
  textInput: {
    fontSize: 14, fontWeight: '700',
    paddingVertical: 4, paddingHorizontal: spacing[2],
    borderRadius: radius.md, borderWidth: 1,
  },
  valueText: { ...typography.h4, fontWeight: '800', color: c.text.primary },
}));
