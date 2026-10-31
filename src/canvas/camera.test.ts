import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA,
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fitMapToViewport,
  panCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomBy,
  type Camera,
} from './camera';

describe('camera transforms', () => {
  it('round-trips world and screen coordinates at multiple scales and offsets', () => {
    const cameras: Camera[] = [
      DEFAULT_CAMERA,
      { scale: 0.25, offsetX: 120, offsetY: -80 },
      { scale: 2.75, offsetX: -940, offsetY: 315 },
      { scale: 7.5, offsetX: 4000, offsetY: -2750 },
    ];

    for (const camera of cameras) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 1000, y: 700 },
        { x: 1999.5, y: 1399.25 },
      ]) {
        const roundTrip = screenToWorld(camera, worldToScreen(camera, point));
        expect(roundTrip.x).toBeCloseTo(point.x, 9);
        expect(roundTrip.y).toBeCloseTo(point.y, 9);
      }
    }
  });

  it('zooms around the cursor without moving the world point under it', () => {
    const camera: Camera = { scale: 0.6, offsetX: 90, offsetY: 140 };
    const cursor = { x: 420, y: 280 };
    const worldBefore = screenToWorld(camera, cursor);

    const zoomed = zoomBy(camera, cursor, 1.6);
    const worldAfter = screenToWorld(zoomed, cursor);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
  });

  it('clamps zoom to the configured range', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(500)).toBe(MAX_SCALE);
    expect(zoomAt(DEFAULT_CAMERA, { x: 0, y: 0 }, 0.0001).scale).toBe(MIN_SCALE);
    expect(zoomAt(DEFAULT_CAMERA, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE);
  });

  it('fits and centres the map inside the viewport with padding', () => {
    const camera = fitMapToViewport(2000, 1400, { width: 1200, height: 800 }, 50);
    const screenTopLeft = worldToScreen(camera, { x: 0, y: 0 });
    const screenBottomRight = worldToScreen(camera, { x: 2000, y: 1400 });

    expect(camera.scale).toBeCloseTo((800 - 100) / 1400, 9);
    expect(screenTopLeft.x).toBeCloseTo((1200 - 2000 * camera.scale) / 2, 9);
    expect(screenTopLeft.y).toBeCloseTo(50, 9);
    expect(screenBottomRight.y).toBeCloseTo(750, 9);
    expect(screenBottomRight.x).toBeLessThanOrEqual(1200 - 50);
  });

  it('pans by changing only the camera offset', () => {
    const camera: Camera = { scale: 1.25, offsetX: 10, offsetY: 20 };
    const panned = panCamera(camera, -32, 54);

    expect(panned).toEqual({ scale: 1.25, offsetX: -22, offsetY: 74 });
    expect(camera).toEqual({ scale: 1.25, offsetX: 10, offsetY: 20 });
  });

  it('leaves the camera untouched when zoom is clamped to its current scale', () => {
    const camera = { scale: MAX_SCALE, offsetX: 30, offsetY: 40 };
    expect(zoomAt(camera, { x: 10, y: 10 }, MAX_SCALE * 2)).toBe(camera);
  });
});
