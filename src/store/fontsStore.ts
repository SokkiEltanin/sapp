import { create } from 'zustand';

// Śledzi czy własne, dołączone fonty (Blackout/Pastel/Archivo Black/Oswald itd.,
// rejestrowane przez `useFonts()` w app/_layout.tsx) już się załadowały (2026-09-30, user
// zrzutem: "ten czasami pokazuje kropki zamiast dni ile" — RingCountdown.tsx). `useFonts`
// jest ŚWIADOMIE nieblokujące (patrz komentarz w _layout.tsx: "the app renders
// immediately") — appka NIE czeka na fonty przed pierwszym renderem, dla szybszego
// starcia. Efekt uboczny: komponent który renderuje tekst z `fontFamily: fonts.display`
// (Archivo Black) ZANIM ten font się załaduje dostaje na Androidzie fallback/tofu-glify
// (wyglądające jak małe kropki) zamiast cyfr, dopóki nie nadejdzie kolejny re-render z
// właściwą czcionką — ten re-render często nigdy nie przychodzi, bo `days`/`color` props
// się nie zmieniają. Fix: komponenty które renderują duże liczby TĄ czcionką powinny
// czytać ten store i użyć `fontsLoaded ? fonts.display : undefined` (fallback na fonta
// systemowego, który NIGDY nie pokazuje tofu/kropek) zamiast twardo wpisanej nazwy fonta.
// `fonts.display` jest używany w 15+ innych miejscach w repo z TĄ SAMĄ, utajoną wadą —
// naprawione na razie tylko w RingCountdown.tsx (zgłoszony przypadek), reszta zostaje
// znanym, opisanym ryzykiem (patrz NEXT_STEPS.md) do naprawienia przy okazji.
interface FontsState {
  loaded: boolean;
  setLoaded: () => void;
}

export const useFontsStore = create<FontsState>((set) => ({
  loaded: false,
  setLoaded: () => set({ loaded: true }),
}));
