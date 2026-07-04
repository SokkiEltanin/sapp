import { useState, useEffect, useRef, useMemo } from 'react';
import { haptic } from '@/utils/haptics';
import {
  View, Text, StyleSheet, Modal, ScrollView, Alert,
  Animated, Pressable, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { X, Check, Plus } from 'lucide-react-native';

import MoodPicker from './MoodPicker';
import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import Chip from '@/components/ui/Chip';
import { MoodEntry, MoodLevel, MOOD_COLORS } from '@/types';
import { moodService } from '@/services/moodService';
import { useMoodStore } from '@/store/moodStore';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const PRESET_TAGS = [
  'skupiony', 'zmęczony', 'niespokojny', 'radosny', 'smutny',
  'produktywny', 'rozproszony', 'spokojny', 'motywowany', 'przytłoczony',
  'wdzięczny', 'zestresowany', 'szczęśliwy', 'sfrustrowany', 'zrelaksowany',
  'podekscytowany', 'samotny', 'pełen energii', 'bez motywacji', 'zadowolony',
  'przygnębiony', 'towarzyski', 'twórczy', 'zaniepokojony', 'pewny siebie',
];

const POSITIVE_TAGS = new Set([
  'skupiony', 'radosny', 'produktywny', 'spokojny', 'motywowany',
  'wdzięczny', 'szczęśliwy', 'zrelaksowany', 'podekscytowany',
  'pełen energii', 'zadowolony', 'towarzyski', 'twórczy', 'pewny siebie',
]);
const NEGATIVE_TAGS = new Set([
  'zmęczony', 'niespokojny', 'smutny', 'rozproszony', 'przytłoczony',
  'zestresowany', 'sfrustrowany', 'samotny', 'bez motywacji', 'przygnębiony',
  'zaniepokojony',
]);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const smooth = () => LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));

interface Props {
  visible: boolean;
  onClose: () => void;
  existingEntry?: MoodEntry | null;
}

export default function MoodCheckInModal({ visible, onClose, existingEntry }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const kb = useKeyboardHeight();
  const [mood, setMood]         = useState<MoodLevel | undefined>(existingEntry?.mood);
  const [energy, setEnergy]     = useState<MoodLevel | undefined>(existingEntry?.energy);
  const [note, setNote]         = useState(existingEntry?.note ?? '');
  const [tags, setTags]         = useState<string[]>(existingEntry?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [customTagOpen, setCustomTagOpen] = useState(false);
  const [saving, setSaving]     = useState(false);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const tagsScrollRef = useRef<ScrollView>(null);

  const { addEntry, updateEntry, entries: allEntries } = useMoodStore();
  const chipColor = mood ? MOOD_COLORS[mood] : undefined;

  // You can log mood several times a day. Show which check-in of the day this is.
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = useMemo(() => allEntries.filter(e => e.date === todayStr).length, [allEntries, todayStr]);
  const ordinal = existingEntry ? null : todayCount + 1;

  // Tag usage frequency across all past entries
  const tagFrequency = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of allEntries) {
      for (const t of e.tags) map.set(t, (map.get(t) ?? 0) + 1);
    }
    return map;
  }, [allEntries]);

  // Sort tags: by sentiment (based on current mood) then by frequency
  const sortedPresetTags = useMemo(() => {
    const byFreq = (a: string, b: string) => (tagFrequency.get(b) ?? 0) - (tagFrequency.get(a) ?? 0);
    const positive = PRESET_TAGS.filter(t => POSITIVE_TAGS.has(t));
    const negative = PRESET_TAGS.filter(t => NEGATIVE_TAGS.has(t));
    const neutral  = PRESET_TAGS.filter(t => !POSITIVE_TAGS.has(t) && !NEGATIVE_TAGS.has(t));

    let ordered: string[];
    if (!mood) {
      ordered = [...PRESET_TAGS].sort(byFreq);
    } else if (mood <= 2) {
      // Bad mood → negative first
      ordered = [
        ...negative.sort(byFreq),
        ...neutral.sort(byFreq),
        ...positive.sort(byFreq),
      ];
    } else if (mood >= 4) {
      // Good mood → positive first
      ordered = [
        ...positive.sort(byFreq),
        ...neutral.sort(byFreq),
        ...negative.sort(byFreq),
      ];
    } else {
      // Neutral mood → pure frequency sort
      ordered = [...PRESET_TAGS].sort(byFreq);
    }
    return ordered;
  }, [mood, tagFrequency]);

  useEffect(() => {
    if (visible) {
      setMood(existingEntry?.mood);
      setEnergy(existingEntry?.energy);
      setNote(existingEntry?.note ?? '');
      setTags(existingEntry?.tags ?? []);
      setCustomTag('');
    }
  }, [visible, existingEntry?.id]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const toggleTag = (tag: string) => {
    haptic.tap();
    smooth();
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    smooth();
    if (!t || tags.includes(t)) { setCustomTag(''); setCustomTagOpen(false); return; }
    haptic.tap();
    setTags(prev => [...prev, t]);
    setCustomTag('');
    setCustomTagOpen(false);
    // Snap the tag rail back to the start so the new custom tag is visible at once.
    setTimeout(() => tagsScrollRef.current?.scrollTo({ x: 0, animated: true }), 60);
  };

  const handleSave = async () => {
    if (!mood || !energy) {
      Alert.alert('Uzupełnij', 'Wybierz nastrój i poziom energii');
      return;
    }
    if (!note.trim()) {
      Alert.alert('Uzupełnij', 'Wpisz notatkę dnia — to pomaga budować statystyki słów kluczowych');
      return;
    }
    setSaving(true);
    try {
      if (existingEntry) {
        const updates = { mood, energy, note: note.trim() || undefined, tags };
        await moodService.update(existingEntry.id, updates);
        updateEntry(existingEntry.id, updates);
      } else {
        const entry = await moodService.add({
          date: new Date().toISOString().split('T')[0],
          mood, energy,
          note: note.trim() || undefined,
          tags,
        });
        addEntry(entry);
      }
      haptic.success();
      onClose();
    } catch (e: any) {
      haptic.error();
      Alert.alert('Błąd', e.message);
    } finally {
      setSaving(false);
    }
  };

  // Custom (non-preset) tags are pinned to the FRONT (right after the + button) so a
  // just-added one is visible immediately on the left instead of scrolled off the end.
  const allDisplayTags = [
    ...tags.filter(t => !PRESET_TAGS.includes(t)),
    ...sortedPresetTags,
  ];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim, paddingBottom: kb }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {existingEntry ? 'Edytuj check-in' : ordinal === 1 ? 'Jak się czujesz?' : `Humor ${ordinal}. raz dziś`}
              </Text>
              <Text style={styles.subtitle}>
                {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                {!existingEntry && todayCount > 0 ? ` · masz już ${todayCount} dziś` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={c.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
              <MoodPicker value={mood} onChange={setMood} label="Nastrój" />
              <MoodPicker value={energy} onChange={setEnergy} label="Energia" mode="energy" />

              {/* Tags — custom-add plus pinned on the LEFT, tags scroll to the right */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Co czujesz?</Text>
                <View style={styles.tagsRow}>
                  {customTagOpen ? (
                    <TextInput
                      style={styles.customTagInputInline}
                      value={customTag}
                      onChangeText={setCustomTag}
                      placeholder="własny…"
                      placeholderTextColor={c.text.muted}
                      onSubmitEditing={addCustomTag}
                      onBlur={() => { if (!customTag.trim()) setCustomTagOpen(false); }}
                      autoFocus
                      returnKeyType="done"
                      maxLength={30}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => { haptic.tap(); smooth(); setCustomTagOpen(true); }}
                      style={[styles.customTagPlus, chipColor ? { borderColor: chipColor + '70' } : null]}
                      activeOpacity={0.8}
                    >
                      <Plus size={16} color={chipColor ?? c.text.secondary} strokeWidth={2.6} />
                    </TouchableOpacity>
                  )}
                  <ScrollView
                    ref={tagsScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tagsScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {allDisplayTags.map(tag => (
                      <Chip
                        key={tag} label={tag}
                        selected={tags.includes(tag)}
                        onPress={() => toggleTag(tag)}
                        color={chipColor}
                        count={tagFrequency.get(tag)}
                      />
                    ))}
                  </ScrollView>
                </View>
              </View>

              <InputField
                label="Notatka dnia"
                value={note}
                onChangeText={setNote}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
                placeholder="Co słychać? Opisz dzień — dobra lub zła, każda notatka buduje Twoje statystyki."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                containerStyle={{ minHeight: 100 }}
              />

              <View style={styles.footer}>
                <AnimatedButton
                  onPress={handleSave}
                  label={saving ? 'Zapisuję...' : (existingEntry ? 'Zaktualizuj' : 'Zapisz')}
                  icon={<Check size={18} color={c.bg.primary} />}
                  size="lg"
                  fullWidth
                  disabled={saving || !mood || !energy || !note.trim()}
                />
              </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: typeof colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.border.glass,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: spacing[5], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  title:    { ...typography.h3, color: c.text.primary },
  subtitle: { ...typography.caption, color: c.text.muted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  scroll: { padding: spacing[5], paddingTop: spacing[4], gap: spacing[5], paddingBottom: spacing[4] },
  section: { gap: spacing[3] },
  sectionLabel: {
    ...typography.label, color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  tagsScroll: { flexDirection: 'row', gap: spacing[2], paddingRight: spacing[2] },

  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  customTagPlus: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.elevated,
    borderWidth: 1, borderColor: c.border.default,
  },

  customTagInline: {
    height: 30, justifyContent: 'center',
  },
  customTagInputInline: {
    height: 30, minWidth: 80,
    backgroundColor: c.bg.elevated,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3],
    fontSize: 12, color: c.text.primary,
  },

  footer: {
    padding: spacing[4], paddingBottom: spacing[8],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
});
