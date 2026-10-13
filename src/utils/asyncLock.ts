// Generic in-memory async mutex, keyed by string. Used to serialize two independent
// commit paths that both read-then-write the SAME logical record (see bankCommit.ts +
// expenses/scan.tsx, §279/§308 — a bank push and a receipt scan for the SAME purchase,
// arriving within milliseconds of each other, both read the expenses store BEFORE
// either had written its own entry, so neither's dedup check could see the other —
// produced a genuine duplicate expense despite both sides' amount+day+store matching
// logic being individually correct). Not persisted — in-memory only is enough, since the
// race only matters within a single running app session (two commits racing each other).
const locks = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>(res => { release = res; });
  locks.set(key, prev.then(() => mine));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === mine) locks.delete(key);
  }
}
