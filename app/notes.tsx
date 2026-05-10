import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, Plus, Pin, PinOff, Trash2, Search, X, Tag,
  FileText, Bold, Italic, Underline, Type, ClipboardList,
} from 'lucide-react-native';

import { useTasks } from '@/hooks/useTasks';
import PressableScale from '@/components/ui/PressableScale';
import { Note, getAllNotes, createNote, updateNote, deleteNote } from '@/utils/notesStorage';
import {
  RichBlock, makeBlock, serializeBlocks, deserializeBlocks,
  blocksToPlainText, RICH_COLORS, RICH_SIZES,
} from '@/utils/richText';
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

// ─── Rich text toolbar ────────────────────────────────────────────────────────

function RichToolbar({ block, onToggle, onColor, onSize, onAdd }: {
  block: RichBlock | undefined;
  onToggle: (key: 'bold' | 'italic' | 'underline') => void;
  onColor: (color: string | undefined) => void;
  onSize: (size: number | undefined) => void;
  onAdd: () => void;
}) {
  if (!block) return null;

  const activeSize = block.size ?? 15;

  return (
    <View style={tb.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tb.row}
        keyboardShouldPersistTaps="always"
      >
        {/* Format toggles */}
        <TouchableOpacity
          onPress={() => onToggle('bold')}
          style={[tb.btn, block.bold && tb.btnActive]}
          activeOpacity={0.7}
        >
          <Bold size={14} color={block.bold ? colors.bg.primary : colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onToggle('italic')}
          style={[tb.btn, block.italic && tb.btnActive]}
          activeOpacity={0.7}
        >
          <Italic size={14} color={block.italic ? colors.bg.primary : colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onToggle('underline')}
          style={[tb.btn, block.underline && tb.btnActive]}
          activeOpacity={0.7}
        >
          <Underline size={14} color={block.underline ? colors.bg.primary : colors.text.secondary} />
        </TouchableOpacity>

        <View style={tb.sep} />

        {/* Sizes */}
        {RICH_SIZES.map(({ size, label }) => (
          <TouchableOpacity
            key={size}
            onPress={() => onSize(size === 15 ? undefined : size)}
            style={[tb.sizeBtn, activeSize === size && tb.sizeBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[tb.sizeTxt, activeSize === size && tb.sizeTxtActive]}>{label}</Text>
          </TouchableOpacity>
        ))}

        <View style={tb.sep} />

        {/* Colors */}
        {RICH_COLORS.map(({ key, value, dot }) => {
          const active = (block.color ?? undefined) === value;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onColor(value)}
              style={[tb.dot, { backgroundColor: dot }, active && tb.dotActive]}
              activeOpacity={0.7}
            />
          );
        })}

        <View style={tb.sep} />

        {/* Add block */}
        <TouchableOpacity onPress={onAdd} style={tb.btn} activeOpacity={0.7}>
          <Plus size={14} color={colors.text.secondary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const tb = StyleSheet.create({
  wrap: {
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.elevated,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[1],
  },
  btn: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  btnActive: { backgroundColor: colors.text.primary },
  sep: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: spacing[1] },
  sizeBtn: {
    paddingHorizontal: spacing[2], height: 28, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sizeBtnActive: { backgroundColor: colors.text.primary },
  sizeTxt: { fontSize: 11, fontWeight: '700', color: colors.text.secondary },
  sizeTxtActive: { color: colors.bg.primary },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
  },
  dotActive: { borderWidth: 3, borderColor: colors.text.primary },
});

// ─── Note editor modal ────────────────────────────────────────────────────────

function NoteEditorModal({ note, visible, onClose, onSave }: {
  note: Note | null;
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, blocks: RichBlock[], tags: string[]) => void;
}) {
  const [title, setTitle]     = useState('');
  const [blocks, setBlocks]   = useState<RichBlock[]>([makeBlock()]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags]       = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const blockRefs = useRef<Map<string, TextInput | null>>(new Map());

  useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? '');
      setBlocks(
        note?.bodyRich
          ? deserializeBlocks(note.bodyRich)
          : note?.body
            ? note.body.split('\n').map(l => makeBlock(l))
            : [makeBlock()]
      );
      setTags(note?.tags ?? []);
      setTagInput('');
      setFocusedId(null);
    }
  }, [visible, note]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleSave = () => {
    const hasContent = title.trim() || blocksToPlainText(blocks).trim();
    if (!hasContent) { onClose(); return; }
    onSave(title.trim(), blocks, tags);
  };

  // Block management
  const updateBlockText = (id: string, text: string) => {
    // Detect Enter → split block
    if (text.includes('\n')) {
      const idx = blocks.findIndex(b => b.id === id);
      if (idx === -1) return;
      const [before, ...rest] = text.split('\n');
      const after = rest.join('\n');
      const { id: _id, text: _text, ...style } = blocks[idx];
      const newBlock = makeBlock(after);
      const newBlocks = [
        ...blocks.slice(0, idx),
        { ...blocks[idx], text: before },
        newBlock,
        ...blocks.slice(idx + 1),
      ];
      setBlocks(newBlocks);
      setTimeout(() => { blockRefs.current.get(newBlock.id)?.focus(); }, 50);
      return;
    }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, text } : b));
  };

  const handleBlockKeyPress = (id: string, key: string) => {
    if (key === 'Backspace') {
      const idx = blocks.findIndex(b => b.id === id);
      if (idx > 0 && blocks[idx].text === '') {
        const prevId = blocks[idx - 1].id;
        setBlocks(prev => prev.filter(b => b.id !== id));
        setFocusedId(prevId);
        setTimeout(() => { blockRefs.current.get(prevId)?.focus(); }, 50);
      }
    }
  };

  const addBlock = () => {
    const newBlock = makeBlock();
    setBlocks(prev => [...prev, newBlock]);
    setTimeout(() => { blockRefs.current.get(newBlock.id)?.focus(); }, 50);
  };

  const applyToggle = (key: 'bold' | 'italic' | 'underline') => {
    if (!focusedId) return;
    setBlocks(prev => prev.map(b => b.id === focusedId ? { ...b, [key]: !b[key] } : b));
  };

  const applyColor = (color: string | undefined) => {
    if (!focusedId) return;
    setBlocks(prev => prev.map(b => b.id === focusedId ? { ...b, color } : b));
  };

  const applySize = (size: number | undefined) => {
    if (!focusedId) return;
    setBlocks(prev => prev.map(b => b.id === focusedId ? { ...b, size } : b));
  };

  const focusedBlock = blocks.find(b => b.id === focusedId);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleSave}>
      <SafeAreaView style={em.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={em.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Tytuł (opcjonalnie)"
              placeholderTextColor={colors.text.muted}
              style={em.titleInput}
              returnKeyType="next"
              onSubmitEditing={() => blockRefs.current.get(blocks[0]?.id)?.focus()}
            />

            {/* Rich blocks */}
            {blocks.map((block) => (
              <TextInput
                key={block.id}
                ref={r => { blockRefs.current.set(block.id, r); }}
                value={block.text}
                onChangeText={text => updateBlockText(block.id, text)}
                onFocus={() => setFocusedId(block.id)}
                onKeyPress={({ nativeEvent: { key } }) => handleBlockKeyPress(block.id, key)}
                placeholder={block.id === blocks[0]?.id ? 'Zacznij pisać...' : undefined}
                placeholderTextColor={colors.text.muted + 'BB'}
                multiline
                textAlignVertical="top"
                style={[
                  em.blockInput,
                  {
                    fontWeight: block.bold ? '700' : '400',
                    fontStyle: block.italic ? 'italic' : 'normal',
                    textDecorationLine: block.underline ? 'underline' : 'none',
                    textDecorationColor: block.underline && block.color ? block.color : undefined,
                    color: block.color ?? colors.text.primary,
                    fontSize: block.size ?? 15,
                    lineHeight: (block.size ?? 15) * 1.65,
                  },
                ]}
              />
            ))}

            {/* Tags */}
            <View style={em.tagSection}>
              <View style={em.tagInputRow}>
                <Tag size={13} color={colors.text.muted} />
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onFocus={() => setFocusedId(null)}
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

          {/* Rich toolbar — stays above keyboard */}
          <RichToolbar
            block={focusedBlock}
            onToggle={applyToggle}
            onColor={applyColor}
            onSize={applySize}
            onAdd={addBlock}
          />
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
    backgroundColor: colors.text.primary, borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[2], paddingBottom: 24 },
  titleInput: {
    fontSize: 22, fontWeight: '800', color: colors.text.primary,
    paddingVertical: spacing[2], marginBottom: spacing[2],
  },
  blockInput: {
    color: colors.text.primary,
    paddingVertical: spacing[1],
    minHeight: 28,
  },
  tagSection: { gap: spacing[2], marginTop: spacing[3] },
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
  const plainBody = note.bodyRich
    ? blocksToPlainText(deserializeBlocks(note.bodyRich))
    : note.body;
  const preview = plainBody.trim().replace(/\n+/g, ' ');

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

      {note.bodyRich && (
        <View style={nc.richBadge}>
          <Type size={8} color={colors.accent.blue + 'AA'} />
        </View>
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
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4], gap: spacing[2],
  },
  pinned: { borderColor: colors.accent.amber + '40', backgroundColor: colors.accent.amber + '08' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text.primary, lineHeight: 20 },
  titleEmpty: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text.secondary, lineHeight: 20, fontStyle: 'italic' },
  body: { fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
  richBadge: { position: 'absolute', top: spacing[3], right: 80 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  time: { fontSize: 11, color: colors.text.muted },
  tagRow: { flexDirection: 'row', gap: spacing[1], flex: 1 },
  tag: { fontSize: 10, color: colors.accent.blue + 'AA' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  pinnedText: { fontSize: 9, color: colors.accent.amber, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing[1] },
  actionBtn: { padding: 3 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const [notes, setNotes]           = useState<Note[]>([]);
  const [query, setQuery]           = useState('');
  const [searching, setSearching]   = useState(false);
  const [editorNote, setEditorNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { create: createTask }      = useTasks();

  const loadNotes = useCallback(async () => {
    const loaded = await getAllNotes();
    setNotes(loaded);
    // Auto-open a specific note if noteId param was passed (e.g. from search)
    if (noteId) {
      const target = loaded.find(n => n.id === noteId);
      if (target) { setEditorNote(target); setEditorOpen(true); }
    }
  }, [noteId]);

  useEffect(() => { loadNotes(); }, []);

  const filtered = query.trim()
    ? notes.filter(n => {
        const q = query.toLowerCase();
        const plain = n.bodyRich
          ? blocksToPlainText(deserializeBlocks(n.bodyRich))
          : n.body;
        return (
          n.title.toLowerCase().includes(q) ||
          plain.toLowerCase().includes(q) ||
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

  const handleSave = async (title: string, blocks: RichBlock[], tags: string[]) => {
    setEditorOpen(false);
    const body = blocksToPlainText(blocks);
    const hasFormatting = blocks.some(b => b.bold || b.italic || b.underline || b.color || b.size);
    const bodyRich = hasFormatting ? serializeBlocks(blocks) : undefined;

    if (editorNote) {
      await updateNote(editorNote.id, { title, body, bodyRich, tags });
      toast.success('Notatka zaktualizowana');
    } else {
      await createNote({ title, body, bodyRich, tags });
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
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[2],
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[8] },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accent.blue + '15',
    borderWidth: 1, borderColor: colors.accent.blue + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  emptySub: { fontSize: 14, color: colors.text.muted, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.text.primary, borderRadius: radius.full,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg.primary },
  emptyInline: { alignItems: 'center', paddingVertical: spacing[8] },
});
