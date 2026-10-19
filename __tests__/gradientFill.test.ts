import { isGradientFill, gradientPoints, makeGradientFill } from '@/store/gradientFill';

describe('gradientFill (§394)', () => {
  test('isGradientFill rozróżnia płaski hex od gradientu', () => {
    expect(isGradientFill('#3B82F6')).toBe(false);
    expect(isGradientFill(makeGradientFill('#3B82F6'))).toBe(true);
  });

  test('makeGradientFill domyślnie idzie w prawo, 2 stopy', () => {
    const g = makeGradientFill('#3B82F6');
    expect(g.stops).toEqual(['#3B82F6', '#1E293B']);
    expect(g.direction).toBe('right');
  });

  test('gradientPoints zwraca poprawne punkty dla każdego kierunku', () => {
    expect(gradientPoints('right')).toEqual({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } });
    expect(gradientPoints('down')).toEqual({ start: { x: 0, y: 0 }, end: { x: 0, y: 1 } });
    expect(gradientPoints('diagonalDown')).toEqual({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } });
    expect(gradientPoints('diagonalUp')).toEqual({ start: { x: 0, y: 1 }, end: { x: 1, y: 0 } });
  });
});
