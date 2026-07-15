import { Colors } from './colors';

// Cache a themed StyleSheet per palette, instead of rebuilding it in every component.
//
// The convention `const s = useMemo(() => makeStyles(colors), [colors])` looks cheap, but
// useMemo is PER COMPONENT INSTANCE — so a screen whose list rows each call makeStyles
// rebuilds the whole sheet once per row. Measured in this app:
//   • dashboard editor  — ~20 rows × 319 styles  = 6000+ style objects in one render
//   • receipt scanner   — 30 products × 121 styles (× picker sub-rows) = ~11 000
// Both on the JS thread, synchronously. That is the ~30s "edit lag", and very likely the
// receipt-save freeze too (an ANR, which is why no error was ever caught).
//
// useColors() returns a STABLE module object (darkColors / lightColors), so the sheet can
// be keyed on it: built once per theme, a Map lookup for every caller after that. Theme
// switching still works — a different palette object is simply a different key.
//
// Usage: wrap the existing builder, nothing else changes at the call sites.
//   const makeStyles = themedStyles((c: any) => StyleSheet.create({ ... }));
export function themedStyles<T>(build: (c: Colors) => T): (c: Colors) => T {
  const cache = new Map<Colors, T>();
  return (c: Colors) => {
    let s = cache.get(c);
    if (!s) { s = build(c); cache.set(c, s); }
    return s;
  };
}
