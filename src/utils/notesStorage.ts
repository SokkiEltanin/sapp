import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Note {
  id: string;
  title: string;
  body: string;
  bodyRich?: string;  // JSON-serialized RichBlock[] — present only when formatted
  tags: string[];
  folder?: string;    // catalog name, undefined = uncategorized
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTES_KEY   = 'notes_v1';
const FOLDERS_KEY = 'notes_folders_v1';

async function load(): Promise<Note[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function save(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export async function getAllNotes(): Promise<Note[]> {
  const notes = await load();
  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function createNote(
  data: Pick<Note, 'title' | 'body' | 'bodyRich' | 'tags' | 'folder'>,
): Promise<Note> {
  const notes = await load();
  const now = new Date().toISOString();
  const note: Note = {
    id: Date.now().toString(),
    title: data.title,
    body: data.body,
    bodyRich: data.bodyRich,
    tags: data.tags,
    folder: data.folder,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  await save(notes);
  return note;
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'body' | 'bodyRich' | 'tags' | 'folder' | 'pinned'>>,
): Promise<void> {
  const notes = await load();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return;
  notes[idx] = { ...notes[idx], ...updates, updatedAt: new Date().toISOString() };
  await save(notes);
}

export async function deleteNote(id: string): Promise<void> {
  const notes = await load();
  await save(notes.filter(n => n.id !== id));
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function loadFolders(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function createFolder(name: string): Promise<void> {
  const folders = await loadFolders();
  const trimmed = name.trim();
  if (!trimmed || folders.includes(trimmed)) return;
  folders.push(trimmed);
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed || oldName === trimmed) return;
  const [folders, notes] = await Promise.all([loadFolders(), load()]);
  const idx = folders.indexOf(oldName);
  if (idx === -1) return;
  folders[idx] = trimmed;
  const updatedNotes = notes.map(n => n.folder === oldName ? { ...n, folder: trimmed, updatedAt: n.updatedAt } : n);
  await Promise.all([
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)),
    save(updatedNotes),
  ]);
}

export async function deleteFolder(name: string): Promise<void> {
  const [folders, notes] = await Promise.all([loadFolders(), load()]);
  const updatedFolders = folders.filter(f => f !== name);
  const updatedNotes   = notes.map(n => n.folder === name ? { ...n, folder: undefined, updatedAt: n.updatedAt } : n);
  await Promise.all([
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders)),
    save(updatedNotes),
  ]);
}
