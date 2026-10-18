import { useRef } from 'react';
import { createPressGuard } from '@/utils/pressGuard';

// Wygodny hook-wrapper nad `createPressGuard()` (§375) dla NAJCZĘSTSZEGO przypadku — jeden
// guard na jeden komponent/handler. `useRef` zapewnia, że ten sam guard (z własnym,
// zamkniętym stanem `last`) przeżywa re-rendery, nie tworzy się od nowa za każdym razem.
export function usePressGuard(windowMs = 600) {
  return useRef(createPressGuard(windowMs)).current;
}
