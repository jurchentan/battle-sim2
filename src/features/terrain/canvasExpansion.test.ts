import { describe, expect, it } from 'vitest';
import { MAX_TERRAIN_DIMENSION, type TerrainCanvasBounds } from '../../models';
import { computeExpandedCanvas } from './canvasExpansion';

const BASE_CANVAS: TerrainCanvasBounds = {
  width: 2000,
  height: 1400,
  originX: 0,
  originY: 0,
};

describe('canvas expansion', () => {
  it('adds margins on every side and moves the origin for top and left space', () => {
    const result = computeExpandedCanvas(BASE_CANVAS, {
      top: 100,
      right: 200,
      bottom: 300,
      left: 400,
    });

    expect(result).toEqual({
      ok: true,
      canvas: {
        width: 2600,
        height: 1800,
        originX: -400,
        originY: -100,
        changed: true,
      },
    });
  });

  it('keeps the origin when space is only added to the right and bottom', () => {
    const result = computeExpandedCanvas(BASE_CANVAS, {
      top: 0,
      right: 250,
      bottom: 150,
      left: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas).toEqual({
      width: 2250,
      height: 1550,
      originX: 0,
      originY: 0,
      changed: true,
    });
  });

  it('reports no change when every margin is zero', () => {
    const result = computeExpandedCanvas(BASE_CANVAS, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.changed).toBe(false);
  });

  it('rejects negative and fractional margins', () => {
    expect(computeExpandedCanvas(BASE_CANVAS, { top: -1, right: 0, bottom: 0, left: 0 }).ok).toBe(
      false,
    );
    expect(computeExpandedCanvas(BASE_CANVAS, { top: 0, right: 0, bottom: 0, left: 1.5 }).ok).toBe(
      false,
    );
  });

  it('allows the exact maximum size and rejects anything larger', () => {
    const atMaximum = computeExpandedCanvas(
      { ...BASE_CANVAS, width: 9000 },
      { top: 0, right: 1000, bottom: 0, left: 0 },
    );
    expect(atMaximum.ok).toBe(true);
    if (atMaximum.ok) expect(atMaximum.canvas.width).toBe(MAX_TERRAIN_DIMENSION);

    const tooLarge = computeExpandedCanvas(
      { ...BASE_CANVAS, width: 9000 },
      { top: 0, right: 1001, bottom: 0, left: 0 },
    );
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.error).toContain('maximum');
  });
});
