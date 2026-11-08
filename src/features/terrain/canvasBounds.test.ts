import { describe, expect, it } from 'vitest';
import { createSeedTerrainMap } from '../../models';
import {
  currentCanvasBounds,
  isCanvasExpanded,
  originalCanvasBounds,
  outsideCanvasRegions,
  visibleCanvasBounds,
} from './canvasBounds';

describe('canvas bounds', () => {
  it('uses the recorded original bounds and detects expansion', () => {
    const document = createSeedTerrainMap();
    document.width = 2600;
    document.height = 1800;
    document.originX = -400;
    document.originY = -100;

    expect(isCanvasExpanded(document)).toBe(true);
    expect(currentCanvasBounds(document)).toEqual({
      width: 2600,
      height: 1800,
      originX: -400,
      originY: -100,
    });
    expect(originalCanvasBounds(document)).toEqual({
      width: 2000,
      height: 1400,
      originX: 0,
      originY: 0,
    });
  });

  it('falls back to the current canvas when no original bounds are recorded', () => {
    const document = createSeedTerrainMap();
    delete document.originalCanvas;
    document.width = 2400;
    document.originX = -200;

    expect(originalCanvasBounds(document)).toEqual({
      width: 2400,
      height: 1400,
      originX: -200,
      originY: 0,
    });
    expect(isCanvasExpanded(document)).toBe(false);
  });

  it('returns top, bottom, left, and right expansion strips', () => {
    const document = createSeedTerrainMap();
    document.width = 2600;
    document.height = 1800;
    document.originX = -400;
    document.originY = -100;

    expect(outsideCanvasRegions(document)).toEqual([
      { width: 2600, height: 100, originX: -400, originY: -100 },
      { width: 2600, height: 300, originX: -400, originY: 1400 },
      { width: 400, height: 1400, originX: -400, originY: 0 },
      { width: 200, height: 1400, originX: 2000, originY: 0 },
    ]);
  });

  it('returns no strips when the canvas is not expanded', () => {
    expect(outsideCanvasRegions(createSeedTerrainMap())).toEqual([]);
  });

  it('fits the original bounds only in hide mode', () => {
    const document = createSeedTerrainMap();
    document.width = 2400;
    document.originX = -200;

    expect(visibleCanvasBounds(document, 'show')).toEqual(currentCanvasBounds(document));
    expect(visibleCanvasBounds(document, 'dim')).toEqual(currentCanvasBounds(document));
    expect(visibleCanvasBounds(document, 'hide')).toEqual(originalCanvasBounds(document));
  });
});
