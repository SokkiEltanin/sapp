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
  Folder, FolderOpen, FolderPlus, ChevronDown,
} from 'lucide-react-native';

import { useTasks } from '@/hooks/useTasks';
import PressableScale from '@/components/ui/PressableScale';
import {
  Note, getAllNotes, createNote, updateNote, deleteNote,
  loadFolders, createFolder, renameFolder, deleteFolder,
} from '@/utils/notesStorage';
import {
  RichBlock, makeBlock, serializeBlocks, deserializeBlocks,
  blocksToPlainText, RICH_COLORS, RICH_SIZES,
} from '@/utils/richText';
import { colors, spacing, radius, typography } from '@/theme';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

const V = {
  card:       '#1A1226',
  cardBorder: 'rgba(167,139,250,0.20)',
  accent:     '#A78BFA',
  accentDim:  'rgba(167,139,250,0.14)',
  muted:      'rgba(167,139,250,0.45)',
};

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

// ─── Folder picker (inline dropdown in editor) ────────────────────────────────

function FolderPicker({ folders, value, onChange }: {
  folders: string[];
  value: string | undefined;
  onChange: (f: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={fp.wrap}>
      <TouchableOpacity
        style={fp.trigger}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.75}
      >
        <Folder size={13} color={value ? V.accent : colors.text.muted} />
        <Text style={[fp.triggerText, value && { color: V.accent }]}>
          {value ?? 'Bez katalogu'}
        </Text>
        <ChevronDown size={12} color={colors.text.muted} />
      </TouchableOpacity>

      {open && (
        <View style={fp.dropdown}>
          <TouchableOpacity
            style={[fp.option, !value && fp.optionActive]}
            onPress={() => { onChange(undefined); setOpen(false); }}
            activeOpacity={0.75}
          >
            <Text style={[fp.optionText, !value && fp.optionTextActive]}>Bez katalogu</Text>
          </TouchableOpacity>
          {folders.map(f => (
            <TouchableOpacity
              key={f}
              style={[fp.option, value === f && fp.optionActive]}
              onPress={() => { onChange(f); setOpen(false); }}
              activeOpacity={0.75}
            >
              <Folder size={11} color={value === f ? V.accent : colors.text.muted} />
              <Text style={[fp.optionText, value === f && fp.optionTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const fp = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 10 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    alignSelf: 'flex-start',
  },
  triggerText: { fontSize: 12, color: colors.text.muted, fontWeight: '600' },
  dropdown: {
    position: 'absolute', top: 38, left: 0, right: 0, zIndex: 20,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default,
    overflow: 'hidden', minWidth: 160,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  optionActive: { backgroundColor: V.accentDim },
  optionText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
  optionTextActive: { color: V.accent, fontWeight: '700' },
});

// ─── Note editor modal ────────────────────────────────────────────────────────

function NoteEditorModal({ note, visible, onClose, onSave, folders }: {
  note: Note | null;
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, blocks: RichBlock[], tags: string[], folder: string | undefined) => void;
  folders: string[];
}) {
  const [title, setTitle]         = useState('');
  const [blocks, setBlocks]       = useState<RichBlock[]>([makeBlock()]);
  const [tagInput, setTagInput]   = useState('');
  const [tags, setTags]           = useState<string[]>([]);
  const [folder, setFolder]       = useState<string | undefined>(undefined);
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
      setFolder(note?.folder);
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
    onSave(title.trim(), blocks, tags, folder);
  };

  const updateBlockText = (id: string, text: string) => {
    if (text.includes('\n')) {
      const idx = blocks.findIndex(b => b.id === id);
      if (idx === -1) return;
      const [before, ...rest] = text.split('\n');
      const after = rest.join('\n');
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

            {/* Folder + tags row */}
            <View style={em.metaSection}>
              {folders.length > 0 && (
                <FolderPicker folders={folders} value={folder} onChange={setFolder} />
              )}

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
                  <TouchableOpacity onPress={() => { haptic.tap(); addTag(); }} activeOpacity={0.7}>
                    <Text style={em.tagAddText}>Dodaj</Text>
                  </TouchableOpacity>
                )}
              </View>
              {tags.length > 0 && (
                <View style={em.tagRow}>
                  {tags.map(t => (
                    <TouchableOpacity key={t} onPress={() => { haptic.tap(); removeTag(t); }} style={em.tagChip} activeOpacity={0.7}>
                      <Text style={em.tagChipText}>#{t}</Text>
                      <X size={9} color={V.accent + 'BB'} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

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
    backgroundColor: V.accent, borderRadius: radius.md,
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
  metaSection: { gap: spacing[2], marginTop: spacing[3] },
  tagInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  tagInput: { flex: 1, fontSize: 13, color: colors.text.primary, paddingVertical: 0 },
  tagAddText: { fontSize: 12, fontWeight: '700', color: V.accent },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: V.accentDim,
    borderRadius: radius.full, borderWidth: 1, borderColor: V.cardBorder,
    paddingHorizontal: spacing[2], paddingVertical: 4,
  },
  tagChipText: { fontSize: 11, fontWeight: '600', color: V.accent },
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
  const wordCount = plainBody.trim() ? plainBody.trim().split(/\s+/).length : 0;

  return (
    <PressableScale onPress={onPress} style={[nc.wrap, note.pinned && nc.pinned]}>
      <View style={nc.topRow}>
        {note.title ? (
          <Text style={nc.title} numberOfLines={1}>{note.title}</Text>
        ) : (
          <Text style={nc.titleEmpty} numberOfLines={1}>{preview || 'Pusta notatka'}</Text>
        )}
        <View style={nc.actions}>
          <TouchableOpacity onPress={() => { haptic.tap(); onConvert(); }} hitSlop={8} style={nc.actionBtn}>
            <ClipboardList size={13} color={V.accent + 'BB'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.tap(); onPin(); }} hitSlop={8} style={nc.actionBtn}>
            {note.pinned
              ? <PinOff size={13} color={colors.accent.amber} />
              : <Pin size={13} color={colors.text.muted} />
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.medium(); onDelete(); }} hitSlop={8} style={nc.actionBtn}>
            <Trash2 size={13} color='rgba(255,255,255,0.18)' />
          </TouchableOpacity>
        </View>
      </View>

      {note.title && preview.length > 0 && (
        <Text style={nc.body} numberOfLines={2}>{preview}</Text>
      )}

      {note.bodyRich && (
        <View style={nc.richBadge}>
          <Type size={8} color={V.accent + 'AA'} />
        </View>
      )}

      <View style={nc.footer}>
        <Text style={nc.time}>{fmtDate(note.updatedAt)}</Text>
        {wordCount > 0 && (
          <Text style={nc.wordCount}>{wordCount}sl</Text>
        )}
        {note.folder && (
          <View style={nc.folderBadge}>
            <Folder size={8} color={colors.accent.purple + 'CC'} />
            <Text style={nc.folderText}>{note.folder}</Text>
          </View>
        )}
        {note.tags.length > 0 && (
          <View style={nc.tagRow}>
            {note.tags.slice(0, 2).map(t => (
              <Text key={t} style={nc.tag}>#{t}</Text>
            ))}
            {note.tags.length > 2 && (
              <Text style={nc.tag}>+{note.tags.length - 2}</Text>
            )}
          </View>
        )}
        {note.pinned && (
          <View style={nc.pinnedBadge}>
            <Pin size={8} color={colors.accent.amber} />
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const nc = StyleSheet.create({
  wrap: {
    backgroundColor: V.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: V.cardBorder,
    padding: spacing[4], gap: spacing[2],
  },
  pinned: { borderColor: colors.accent.amber + '40', backgroundColor: colors.accent.amber + '08' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text.primary, lineHeight: 20 },
  titleEmpty: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text.secondary, lineHeight: 20, fontStyle: 'italic' },
  body: { fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
  richBadge: { position: 'absolute', top: spacing[3], right: 80 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1], flexWrap: 'wrap' },
  time: { fontSize: 11, color: colors.text.muted },
  wordCount: { fontSize: 10, color: V.muted, fontWeight: '500' },
  folderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: V.accentDim,
    borderRadius: radius.sm, borderWidth: 1, borderColor: V.cardBorder,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  folderText: { fontSize: 9, color: V.muted, fontWeight: '600' },
  tagRow: { flexDirection: 'row', gap: spacing[1] },
  tag: { fontSize: 10, color: V.muted },
  pinnedBadge: { marginLeft: 'auto' },
  actions: { flexDirection: 'row', gap: spacing[1] },
  actionBtn: { padding: 3 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const { noteId, new: newParam } = useLocalSearchParams<{ noteId?: string; new?: string }>();
  const [notes, setNotes]             = useState<Note[]>([]);
  const [folders, setFolders]         = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = all
  const [query, setQuery]             = useState('');
  const [searching, setSearching]     = useState(false);
  const [editorNote, setEditorNote]   = useState<Note | null>(null);
  const [editorOpen, setEditorOpen]   = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const { create: createTask }        = useTasks();

  const loadAll = useCallback(async () => {
    const [loaded, loadedFolders] = await Promise.all([getAllNotes(), loadFolders()]);
    setNotes(loaded);
    setFolders(loadedFolders);
    if (noteId) {
      const target = loaded.find(n => n.id === noteId);
      if (target) { setEditorNote(target); setEditorOpen(true); }
    }
  }, [noteId]);

  useEffect(() => { loadAll(); }, []);

  // Folder counts
  const folderCount = (f: string) => notes.filter(n => n.folder === f).length;
  const uncategorizedCount = notes.filter(n => !n.folder).length;

  // Filter pipeline
  const filtered = (() => {
    let result = notes;
    if (activeFolder !== null) {
      result = result.filter(n => n.folder === activeFolder);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(n => {
        const plain = n.bodyRich ? blocksToPlainText(deserializeBlocks(n.bodyRich)) : n.body;
        return (
          n.title.toLowerCase().includes(q) ||
          plain.toLowerCase().includes(q) ||
          n.tags.some(t => t.includes(q)) ||
          (n.folder ?? '').toLowerCase().includes(q)
        );
      });
    }
    return result;
  })();

  const pinned   = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  const openNew = () => {
    setEditorNote(null);
    setEditorOpen(true);
  };

  // Opened from the global "+" with ?new=1 → jump straight into a new note.
  useEffect(() => {
    if (newParam) { setEditorNote(null); setEditorOpen(true); }
  }, [newParam]);

  const openEdit = (note: Note) => {
    setEditorNote(note);
    setEditorOpen(true);
  };

  const handleSave = async (title: string, blocks: RichBlock[], tags: string[], folder: string | undefined) => {
    setEditorOpen(false);
    haptic.success();
    const body = blocksToPlainText(blocks);
    const hasFormatting = blocks.some(b => b.bold || b.italic || b.underline || b.color || b.size);
    const bodyRich = hasFormatting ? serializeBlocks(blocks) : undefined;

    if (editorNote) {
      await updateNote(editorNote.id, { title, body, bodyRich, tags, folder });
      toast.success('Notatka zaktualizowana');
    } else {
      await createNote({ title, body, bodyRich, tags, folder: folder ?? (activeFolder ?? undefined) });
      toast.success('Notatka zapisana');
    }
    loadAll();
  };

  const handlePin = async (note: Note) => {
    haptic.tap();
    await updateNote(note.id, { pinned: !note.pinned });
    loadAll();
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
            haptic.success();
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
          haptic.medium();
          await deleteNote(note.id);
          toast.info('Usunięto');
          loadAll();
        },
      },
    ]);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) { setNewFolderMode(false); return; }
    haptic.tap();
    await createFolder(name);
    setNewFolderName('');
    setNewFolderMode(false);
    loadAll();
    toast.success(`Katalog "${name}" utworzony`);
  };

  const handleDeleteFolder = (name: string) => {
    const count = folderCount(name);
    Alert.alert(
      'Usuń katalog',
      count > 0
        ? `Usunąć katalog "${name}"? ${count} notatek trafi do bez katalogu.`
        : `Usunąć katalog "${name}"?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń', style: 'destructive',
          onPress: async () => {
            haptic.medium();
            await deleteFolder(name);
            if (activeFolder === name) setActiveFolder(null);
            loadAll();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.secondary} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notatki</Text>
          {notes.length > 0 && (
            <Text style={styles.subtitle}>{notes.length} notatek</Text>
          )}
        </View>
        <PressableScale onPress={() => { haptic.tap(); setSearching(s => !s); }} style={styles.iconBtn}>
          <Search size={18} color={searching ? V.accent : colors.text.muted} />
        </PressableScale>
        <PressableScale onPress={openNew} style={[styles.iconBtn, styles.addBtn]}>
          <Plus size={20} color={colors.bg.primary} />
        </PressableScale>
      </View>

      {/* Folder tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.folderScroll}
        contentContainerStyle={styles.folderRow}
        keyboardShouldPersistTaps="always"
      >
        {/* All */}
        <TouchableOpacity
          style={[styles.folderChip, activeFolder === null && styles.folderChipActive]}
          onPress={() => { haptic.tap(); setActiveFolder(null); }}
          activeOpacity={0.75}
        >
          <Text style={[styles.folderChipText, activeFolder === null && styles.folderChipTextActive]}>
            Wszystkie {notes.length > 0 && `(${notes.length})`}
          </Text>
        </TouchableOpacity>

        {/* Dynamic folders */}
        {folders.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.folderChip, activeFolder === f && styles.folderChipActive]}
            onPress={() => { haptic.tap(); setActiveFolder(f); }}
            onLongPress={() => { haptic.medium(); handleDeleteFolder(f); }}
            activeOpacity={0.75}
          >
            <Folder size={10} color={activeFolder === f ? colors.bg.primary : V.muted} />
            <Text style={[styles.folderChipText, activeFolder === f && styles.folderChipTextActive]}>
              {f} ({folderCount(f)})
            </Text>
          </TouchableOpacity>
        ))}

        {/* New folder button / inline input */}
        {newFolderMode ? (
          <View style={styles.newFolderInput}>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Nazwa katalogu..."
              placeholderTextColor={colors.text.muted}
              style={styles.newFolderText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
              onBlur={() => { if (!newFolderName.trim()) setNewFolderMode(false); }}
            />
            <TouchableOpacity onPress={() => { haptic.tap(); handleCreateFolder(); }} hitSlop={8}>
              <Text style={styles.newFolderConfirm}>OK</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { haptic.tap(); setNewFolderMode(false); setNewFolderName(''); }} hitSlop={8}>
              <X size={12} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.folderChipNew}
            onPress={() => { haptic.tap(); setNewFolderMode(true); }}
            activeOpacity={0.75}
          >
            <FolderPlus size={11} color={colors.text.muted} />
            <Text style={styles.folderChipNewText}>Nowy</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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
            <TouchableOpacity onPress={() => { haptic.tap(); setQuery(''); }} hitSlop={8}>
              <X size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {notes.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <FileText size={32} color={V.accent} />
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
              {activeFolder !== null && (
                <Text style={styles.emptySub}>
                  Brak notatek w katalogu "{activeFolder}"
                </Text>
              )}
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
        folders={folders}
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
  addBtn: { backgroundColor: V.accent, borderColor: V.accent },

  // ── Folder tabs ─────────────────────────────────────────────────────────────
  folderScroll: {
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
    maxHeight: 48,
  },
  folderRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  folderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  folderChipActive: {
    backgroundColor: V.accent, borderColor: V.accent,
  },
  folderChipText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  folderChipTextActive: { color: colors.bg.primary },
  folderChipNew: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
  },
  folderChipNewText: { fontSize: 11, color: colors.text.muted },
  newFolderInput: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: V.card,
    borderRadius: radius.full, borderWidth: 1, borderColor: V.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: 5,
    minWidth: 140,
  },
  newFolderText: { flex: 1, fontSize: 12, color: colors.text.primary, paddingVertical: 0 },
  newFolderConfirm: { fontSize: 12, fontWeight: '700', color: V.accent },

  // ── Search ──────────────────────────────────────────────────────────────────
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
    backgroundColor: V.accentDim,
    borderWidth: 1, borderColor: V.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  emptySub: { fontSize: 14, color: colors.text.muted, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: V.accent, borderRadius: radius.full,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg.primary },
  emptyInline: { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
});
