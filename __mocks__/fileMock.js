// Stub dla require()'ów obrazków w testach — Metro (RN) obsługuje je natywnie, ale Jest
// (środowisko node, bez Metro) nie umie parsować binarnych PNG. Każdy import obrazka w
// testowanym kodzie (np. badgeIcons.ts, combatItems.ts) dostaje ten sam string zamiast
// prawdziwego assetu — wystarczy, bo testy sprawdzają logikę/dane, nie renderują UI.
module.exports = 'test-image-stub';
