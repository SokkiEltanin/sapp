import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Note {
  id: string;
  title: string;
  body: string;
  bodyRich?: string;  // JSON-serialized RichBlock[] — present only when formatted
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'notes_v1';

async function load(): Promise<Note[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function save(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(notes));
}

export async function getAllNotes(): Promise<Note[]> {
  const notes = await load();
  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function createNote(data: Pick<Note, 'title' | 'body' | 'bodyRich' | 'tags'>): Promise<Note> {
  const notes = await load();
  const now = new Date().toISOString();
  const note: Note = {
    id: Date.now().toString(),
    title: data.title,
    body: data.body,
    bodyRich: data.bodyRich,
    tags: data.tags,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  await save(notes);
  return note;
}

export async function updateNote(id: string, updates: Partial<Pick<Note, 'title' | 'body' | 'bodyRich' | 'tags' | 'pinned'>>): Promise<void> {
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
