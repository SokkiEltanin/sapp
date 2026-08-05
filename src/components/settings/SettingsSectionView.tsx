import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { SettingsSectionDef, SettingsItem } from '@/types/settings';
import SettingsRow from './SettingsRow';

// Collapsible settings section driven by a SettingsSectionDef. `items` is
// passed separately (not `section.items`) so a search match can narrow what
// renders inside without mutating the manifest. `forceOpen` is set by the
// search bar — while searching, matched sections stay expanded regardless of
// the user's own collapse state, and revert to it once the query clears.
export default function SettingsSectionView({ section, items, forceOpen }: {
  section: SettingsSectionDef; items: SettingsItem[]; forceOpen?: boolean;
}) {
  const c = useColors();
  const s = makeS(c);
  const [openState, setOpenState] = useState(section.defaultOpen ?? true);
  const open = forceOpen || openState;
  const Icon = section.icon;

  const toggle = () => {
    if (forceOpen) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    haptic.tap();
    setOpenState(o => !o);
  };

  return (
    <View style={s.wrap}>
      <Pressable onPress={toggle} style={s.head}>
        <View style={[s.iconWrap, { backgroundColor: section.color + '1A' }]}>
          <Icon size={15} color={section.color} />
        </View>
        <Text style={s.title}>{section.title}</Text>
        {section.headerRight}
        <ChevronDown size={18} color={c.text.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <View style={s.card}>
          {items.map((item, i) => <SettingsRow key={item.id} item={item} first={i === 0} />)}
        </View>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  wrap: { marginBottom: spacing[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], paddingHorizontal: spacing[1] },
  iconWrap: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary, letterSpacing: 0.2 },
  card: {
    marginTop: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
}));
