import { useState, useEffect, useRef } from 'react';
import { haptic } from '@/utils/haptics';
import {
  View, Text, StyleSheet, Modal, ScrollView, Alert,
  Animated, Pressable, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';

import MoodPicker from './MoodPicker';
import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import PressableScale from '@/components/ui/PressableScale';
import Chip from '@/components/ui/Chip';
import { MoodEntry, MoodLevel, MOOD_COLORS } from '@/types';
import { moodService } from '@/services/moodService';
import { useMoodStore } from '@/store/moodStore';
import { colors, spacing, radius, typography } from '@/theme';

const MOOD_TAGS = [
  'skupiony', 'zmęczony', 'niespokojny', 'radosny', 'smutny',
  'produktywny', 'rozproszony', 'spokojny', 'motywowany', 'przytłoczony',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  existingEntry?: MoodEntry | null;
}

export default function MoodCheckInModal({ visible, onClose, existingEntry }: Props) {
  const [mood, setMood]     = useState<MoodLevel | undefined>(existingEntry?.mood);
  const [energy, setEnergy] = useState<MoodLevel | undefined>(existingEntry?.energy);
  const [note, setNote]     = useState(existingEntry?.note ?? '');
  const [tags, setTags]     = useState<string[]>(existingEntry?.tags ?? []);
  const [saving, setSaving] = useState(false);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const { addEntry, updateEntry } = useMoodStore();
  const chipColor = mood ? MOOD_COLORS[mood] : undefined;

  // Sync state when existingEntry changes (re-open)
  useEffect(() => {
    if (visible) {
      setMood(existingEntry?.mood);
      setEnergy(existingEntry?.energy);
      setNote(existingEntry?.note ?? '');
      setTags(existingEntry?.tags ?? []);
    }
  }, [visible, existingEntry?.id]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const toggleTag = (tag: string) => {
    haptic.tap();
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!mood || !energy) {
      Alert.alert('Uzupełnij', 'Wybierz nastrój i poziom energii');
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

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {existingEntry ? 'Edytuj check-in' : 'Codzienny check-in'}
              </Text>
              <Text style={styles.subtitle}>
                {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <MoodPicker value={mood} onChange={setMood} label="Jak się czujesz?" />
            <MoodPicker value={energy} onChange={setEnergy} label="Poziom energii" mode="energy" />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Co czujesz?</Text>
              <View style={styles.tagsWrap}>
                {MOOD_TAGS.map(tag => (
                  <Chip
                    key={tag} label={tag}
                    selected={tags.includes(tag)}
                    onPress={() => toggleTag(tag)}
                    color={chipColor}
                  />
                ))}
              </View>
            </View>

            <InputField
              label="Notatka (opcjonalnie)"
              value={note}
              onChangeText={setNote}
              placeholder="Co słychać? Jak minął dzień..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              containerStyle={{ minHeight: 90 }}
            />
          </ScrollView>

          <View style={styles.footer}>
            <AnimatedButton
              onPress={handleSave}
              label={saving ? 'Zapisuję...' : (existingEntry ? 'Zaktualizuj' : 'Zapisz check-in')}
              icon={<Check size={18} color={colors.bg.primary} />}
              size="lg"
              fullWidth
              disabled={saving || !mood || !energy}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: spacing[5], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: { ...typography.h3, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  scroll: { padding: spacing[5], paddingTop: spacing[4], gap: spacing[5], paddingBottom: spacing[4] },
  section: { gap: spacing[3] },
  sectionLabel: {
    ...typography.label, color: colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  footer: {
    padding: spacing[4], paddingBottom: spacing[8],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
});
