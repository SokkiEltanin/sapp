import { ImageSourcePropType } from 'react-native';

// Grafiki minibossów (assets/minibosses/, user wrzucił 2026-08-14). Ten sam wzorzec co
// bossIcons.ts: id → require() (musi być statyczny literal), osobny plik od minibosses.ts
// (logiki) żeby testy mogły importować logikę bez ciągnięcia obrazków/RN.
export const MINIBOSS_PNG: Record<string, ImageSourcePropType> = {
  mb_capybara: require('../../assets/minibosses/MINIBOSS_capybara.png'),
  mb_duck: require('../../assets/minibosses/MINIBOSS_duck.png'),
  mb_shark: require('../../assets/minibosses/MINIBOSS_shark.png'),
  mb_whale: require('../../assets/minibosses/MINIBOSS_whale.png'),
  mb_goat: require('../../assets/minibosses/MINIBOSS_goat.png'),
  mb_harpy: require('../../assets/minibosses/MINIBOSS_harpy-eagle.png'),
  mb_macaws: require('../../assets/minibosses/MINIBOSS_macaws.png'),
  mb_snake: require('../../assets/minibosses/MINIBOSS_snake.png'),
};

export function minibossPng(id: string): ImageSourcePropType | undefined {
  return MINIBOSS_PNG[id];
}
