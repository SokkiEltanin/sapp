// Zabezpieczenie przed szybkim podwójnym tapnięciem (§375, user: "niektóre zawsze da się
// wejść szybko i otwiera się dwa razy") — `TouchableOpacity`/`PressableScale` NIE MAJĄ
// wbudowanego debounce na `onPress`: RN woła handler za KAŻDYM tapnięciem, niezależnie jak
// szybko kolejne następują po sobie. Audyt znalazł realne, potwierdzone skutki: podwójne
// dodanie kafla na płótnie, podwójny `router.push` wypychający ten sam ekran dwa razy na
// stos nawigacji, podwójny wpis w bibliotece presetów/kolorów.
//
// Czysta funkcja (nie hook) — żeby dało się jej użyć TEŻ wewnątrz `.map()` (gdzie hooki
// per-element są niedozwolone, np. `TabBar.tsx`'s rząd przycisków szybkich akcji): jeden
// `createPressGuard()` na GRUPĘ przycisków (przez `useRef`, patrz `usePressGuard` w
// `@/hooks/usePressGuard`), `guard.allow()` wywoływane z KAŻDEGO handlera w tej grupie —
// świadomy, pragmatyczny kompromis (chroni też przed "tap A, natychmiast tap B" w tym samym
// rzędzie) zamiast osobnego timera per przycisk, co wymagałoby hooka per-element.
export function createPressGuard(windowMs = 600) {
  let last = 0;
  return {
    // `true` = wolno wykonać akcję (i okno zostaje zresetowane od teraz); `false` = zbyt
    // szybko po poprzednim dozwolonym wywołaniu, akcja powinna być zignorowana.
    allow(): boolean {
      const now = Date.now();
      if (now - last < windowMs) return false;
      last = now;
      return true;
    },
  };
}
