import { describe, expect, it } from 'vitest';
import { simplifyPoints } from './geometry';

describe('freehand point simplification', () => {
  it('removes collinear intermediate points while keeping endpoints', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];

    expect(simplifyPoints(points, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    ]);
  });

  it('keeps corners and removes small jitter along straight segments', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0.2 },
      { x: 20, y: 0 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
    ];

    const simplified = simplifyPoints(points, 1.5);

    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
    ]);
  });

  it('returns independent copies and keeps short inputs intact', () => {
    const points = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 9, y: 9 },
    ];

    const simplified = simplifyPoints(points, 0);
    expect(simplified).toEqual([
      { x: 5, y: 5 },
      { x: 9, y: 9 },
    ]);
    expect(simplified[0]).not.toBe(points[0]);
  });
});
