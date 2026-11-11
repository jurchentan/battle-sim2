import { describe, expect, it } from 'vitest';
import {
  MARQUEE_MIN_SIZE,
  isMeaningfulMarquee,
  rectangleFromPoints,
  rectanglesIntersect,
} from './marquee';

describe('marquee geometry', () => {
  it('normalizes a rectangle for every drag direction', () => {
    expect(rectangleFromPoints({ x: 120, y: 90 }, { x: 20, y: 30 })).toEqual({
      x: 20,
      y: 30,
      width: 100,
      height: 60,
    });
    expect(rectangleFromPoints({ x: 20, y: 30 }, { x: 120, y: 90 })).toEqual({
      x: 20,
      y: 30,
      width: 100,
      height: 60,
    });
  });

  it('detects overlapping and merely touching rectangles', () => {
    const marquee = { x: 10, y: 10, width: 100, height: 80 };

    expect(rectanglesIntersect(marquee, { x: 50, y: 40, width: 20, height: 20 })).toBe(true);
    expect(rectanglesIntersect(marquee, { x: 110, y: 90, width: 20, height: 20 })).toBe(true);
    expect(rectanglesIntersect(marquee, { x: 111, y: 91, width: 20, height: 20 })).toBe(false);
    expect(rectanglesIntersect(marquee, { x: 0, y: 0, width: 5, height: 5 })).toBe(false);
  });

  it('ignores negligible drags', () => {
    expect(isMeaningfulMarquee({ x: 0, y: 0, width: MARQUEE_MIN_SIZE - 1, height: 2 })).toBe(false);
    expect(isMeaningfulMarquee({ x: 0, y: 0, width: MARQUEE_MIN_SIZE, height: 0 })).toBe(true);
  });

  it('handles a rectangle fully containing another', () => {
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 200, height: 200 },
        { x: 50, y: 50, width: 20, height: 20 },
      ),
    ).toBe(true);
  });
});
