import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft, Plus, Pin, PinOff, Trash2, Search, X, Tag,
  FileText, ChevronRight, ClipboardList,
} from 'lucide-react-native';

import { useTasks } from '@/hooks/useTasks';

import PressableScale from '@/components/ui/PressableScale';
import { Note, getAllNotes, createNote, updateNote, deleteNote } from '@/utils/notesStorage';
import { colors, spacing, radius, typography } from '@/theme';
import { toast } from '@/store/toastStore';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60_000);
  if (diffM < 1)  return 'przed chwilą';
  if (diffM < 60) return `${diffM} min temu`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH} h temu`;
  return `${d.getDate()}.${pad(d.getMonth() + 1)}`;
}

// ─── Note editor modal ────────────────────────────────────────────────────────

function NoteEditorModal({ note, visible, onClose, onSave }: {
  note: Note | null;
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, body: string, tags: string[]) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags]   = useState<string[]>([]);
  const bodyRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? '');
      setBody(note?.body ?? '');
      setTags(note?.tags ?? []);
      setTagInput('');
    }
  }, [visible, note]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleSave = () => {
    if (!title.trim() && !body.trim()) { onClose(); return; }
    onSave(title.trim(), body.trim(), tags);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleSave}>
      <SafeAreaView style={em.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Header */}
          <View style={em.header}>
            <PressableScale onPress={handleSave} style={em.backBtn}>
              <ArrowLeft size={20} color={colors.text.secondary} />
            </PressableScale>
            <Text style={em.headerTitle}>{note ? 'Edytuj notatkę' : 'Nowa notatka'}</Text>
            <TouchableOpacity onPress={handleSave} style={em.saveBtn} activeOpacity={0.75}>
              <Text style={em.saveBtnText}>Zapisz</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={em.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Tytuł (opcjonalnie)"
              placeholderTextColor={colors.text.muted}
              style={em.titleInput}
              returnKeyType="next"
              onSubmitEditing={() => bodyRef.current?.focus()}
            />

            {/* Body */}
            <TextInput
              ref={bodyRef}
              value={body}
              onChangeText={setBody}
              placeholder="Zacznij pisać..."
              placeholderTextColor={colors.text.muted + 'BB'}
              style={em.bodyInput}
              multiline
              textAlignVertical="top"
              autoFocus={!note}
            />

            {/* Tags */}
            <View style={em.tagSection}>
              <View style={em.tagInputRow}>
                <Tag size={13} color={colors.text.muted} />
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Dodaj tag..."
                  placeholderTextColor={colors.text.muted}
                  style={em.tagInput}
                  returnKeyType="done"
                  onSubmitEditing={addTag}
                />
                {tagInput.length > 0 && (
                  <TouchableOpacity onPress={addTag} activeOpacity={0.7}>
                    <Text style={em.tagAddText}>Dodaj</Text>
                  </TouchableOpacity>
                )}
              </View>
              {tags.length > 0 && (
                <View style={em.tagRow}>
                  {tags.map(t => (
                    <TouchableOpacity key={t} onPress={() => removeTag(t)} style={em.tagChip} activeOpacity={0.7}>
                      <Text style={em.tagChipText}>#{t}</Text>
                      <X size={9} color={colors.accent.blue + 'BB'} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const em = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h4, color: colors.text.primary, flex: 1 },
  saveBtn: {
    backgroundColor: colors.text.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: 60 },
  titleInput: {
    fontSize: 22, fontWeight: '800', color: colors.text.primary,
    paddingVertical: spacing[2],
  },
  bodyInput: {
    fontSize: 16, color: colors.text.primary,
    lineHeight: 26,
    minHeight: 200,
    paddingVertical: spacing[2],
  },
  tagSection: { gap: spacing[2], marginTop: spacing[2] },
  tagInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  tagInput: { flex: 1, fontSize: 13, color: colors.text.primary, paddingVertical: 0 },
  tagAddText: { fontSize: 12, fontWeight: '700', color: colors.accent.blue },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent.blue + '18',
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent.blue + '30',
    paddingHorizontal: spacing[2], paddingVertical: 4,
  },
  tagChipText: { fontSize: 11, fontWeight: '600', color: colors.accent.blue },
});

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({ note, onPress, onPin, onDelete, onConvert }: {
  note: Note;
  onPress: () => void;
  onPin: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const preview = note.body.trim().replace(/\n+/g, ' ');
  return (
    <PressableScale onPress={onPress} style={[nc.wrap, note.pinned && nc.pinned]}>
      <View style={nc.topRow}>
        {note.title ? (
          <Text style={nc.title} numberOfLines={1}>{note.title}</Text>
        ) : (
          <Text style={nc.titleEmpty} numberOfLines={1}>{preview || 'Pusta notatka'}</Text>
        )}
        <View style={nc.actions}>
          <TouchableOpacity onPress={onConvert} hitSlop={8} style={nc.actionBtn}>
            <ClipboardList size={13} color={colors.accent.purple + 'BB'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPin} hitSlop={8} style={nc.actionBtn}>
            {note.pinned
              ? <PinOff size={13} color={colors.accent.amber} />
              : <Pin size={13} color={colors.text.muted} />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={nc.actionBtn}>
            <Trash2 size={13} color='rgba(255,255,255,0.18)' />
          </TouchableOpacity>
        </View>
      </View>

      {note.title && preview.length > 0 && (
        <Text style={nc.body} numberOfLines={2}>{preview}</Text>
      )}

      <View style={nc.footer}>
        <Text style={nc.time}>{fmtDate(note.updatedAt)}</Text>
        {note.tags.length > 0 && (
          <View style={nc.tagRow}>
            {note.tags.slice(0, 3).map(t => (
              <Text key={t} style={nc.tag}>#{t}</Text>
            ))}
            {note.tags.length > 3 && (
              <Text style={nc.tag}>+{note.tags.length - 3}</Text>
            )}
          </View>
        )}
        {note.pinned && (
          <View style={nc.pinnedBadge}>
            <Pin size={8} color={colors.accent.amber} />
            <Text style={nc.pinnedText}>Przypięta</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const nc = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4],
    gap: spacing[2],
  },
  pinned: {
    borderColor: colors.accent.amber + '40',
    backgroundColor: colors.accent.amber + '08',
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text.primary, lineHeight: 20 },
  titleEmpty: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text.secondary, lineHeight: 20, fontStyle: 'italic' },
  body: { fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  time: { fontSize: 11, color: colors.text.muted },
  tagRow: { flexDirection: 'row', gap: spacing[1], flex: 1 },
  tag: { fontSize: 10, color: colors.accent.blue + 'AA' },
  pinnedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginLeft: 'auto',
  },
  pinnedText: { fontSize: 9, color: colors.accent.amber, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing[1] },
  actionBtn: { padding: 3 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [query, setQuery]           = useState('');
  const [searching, setSearching]   = useState(false);
  const [editorNote, setEditorNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { create: createTask }      = useTasks();

  const loadNotes = useCallback(async () => {
    setNotes(await getAllNotes());
  }, []);

  useEffect(() => { loadNotes(); }, []);

  const filtered = query.trim()
    ? notes.filter(n => {
        const q = query.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some(t => t.includes(q))
        );
      })
    : notes;

  const pinned   = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  const openNew = () => {
    setEditorNote(null);
    setEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditorNote(note);
    setEditorOpen(true);
  };

  const handleSave = async (title: string, body: string, tags: string[]) => {
    setEditorOpen(false);
    if (editorNote) {
      await updateNote(editorNote.id, { title, body, tags });
      toast.success('Notatka zaktualizowana');
    } else {
      await createNote({ title, body, tags });
      toast.success('Notatka zapisana');
    }
    loadNotes();
  };

  const handlePin = async (note: Note) => {
    await updateNote(note.id, { pinned: !note.pinned });
    loadNotes();
  };

  const handleConvert = (note: Note) => {
    Alert.alert(
      'Konwertuj na zadanie',
      `Dodać "${note.title || note.body.slice(0, 40) || 'notatkę'}" jako zadanie?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Dodaj zadanie',
          onPress: async () => {
            const title = note.title.trim() || note.body.split('\n')[0].trim().slice(0, 80) || 'Zadanie z notatki';
            await createTask({ title, status: 'pending', priority: 'normal', tags: note.tags }).catch(() => {});
            toast.success('Zadanie dodane');
          },
        },
      ],
    );
  };

  const handleDelete = (note: Note) => {
    Alert.alert('Usuń notatkę', `Usunąć "${note.title || 'tę notatkę'}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive',
        onPress: async () => {
          await deleteNote(note.id);
          toast.info('Usunięto');
          loadNotes();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.secondary} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notatki</Text>
          {notes.length > 0 && (
            <Text style={styles.subtitle}>{notes.length} notatek</Text>
          )}
        </View>
        <PressableScale onPress={() => setSearching(s => !s)} style={styles.iconBtn}>
          <Search size={18} color={searching ? colors.accent.blue : colors.text.muted} />
        </PressableScale>
        <PressableScale onPress={openNew} style={[styles.iconBtn, styles.addBtn]}>
          <Plus size={20} color={colors.bg.primary} />
        </PressableScale>
      </View>

      {/* Search bar */}
      {searching && (
        <View style={styles.searchBar}>
          <Search size={14} color={colors.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj notatek..."
            placeholderTextColor={colors.text.muted}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {notes.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <FileText size={32} color={colors.accent.blue} />
          </View>
          <Text style={styles.emptyTitle}>Brak notatek</Text>
          <Text style={styles.emptySub}>
            Wyrzuć myśli z głowy — notatki pomagają czyścić umysł
          </Text>
          <PressableScale onPress={openNew} style={styles.emptyBtn}>
            <Plus size={16} color={colors.bg.primary} />
            <Text style={styles.emptyBtnText}>Nowa notatka</Text>
          </PressableScale>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 && (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyTitle}>Brak wyników</Text>
            </View>
          )}
          {pinned.length > 0 && (
            <>
              <Text style={styles.groupLabel}>PRZYPIĘTE</Text>
              {pinned.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPress={() => openEdit(note)}
                  onPin={() => handlePin(note)}
                  onDelete={() => handleDelete(note)}
                  onConvert={() => handleConvert(note)}
                />
              ))}
            </>
          )}
          {pinned.length > 0 && unpinned.length > 0 && (
            <Text style={[styles.groupLabel, { marginTop: spacing[2] }]}>POZOSTAŁE</Text>
          )}
          {unpinned.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onPress={() => openEdit(note)}
              onPin={() => handlePin(note)}
              onDelete={() => handleDelete(note)}
              onConvert={() => handleConvert(note)}
            />
          ))}
        </ScrollView>
      )}

      <NoteEditorModal
        note={editorNote}
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  headerCenter: { flex: 1, paddingLeft: spacing[1] },
  title: { fontSize: 18, fontWeight: '800', color: colors.text.primary },
  subtitle: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text.primary, paddingVertical: 0 },

  list: { padding: spacing[4], gap: spacing[3], paddingBottom: 80 },

  groupLabel: {
    fontSize: 10, fontWeight: '700', color: colors.text.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: spacing[2],
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[8] },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accent.blue + '15',
    borderWidth: 1, borderColor: colors.accent.blue + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  emptySub: {
    fontSize: 14, color: colors.text.muted, textAlign: 'center',
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.text.primary, borderRadius: radius.full,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg.primary },
  emptyInline: { alignItems: 'center', paddingVertical: spacing[8] },
});
