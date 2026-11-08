export interface Camera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
export const DEFAULT_FIT_PADDING = 48;

export const DEFAULT_CAMERA: Camera = { scale: 0.5, offsetX: 0, offsetY: 0 };

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function screenToWorld(camera: Camera, point: ScreenPoint): ScreenPoint {
  return {
    x: (point.x - camera.offsetX) / camera.scale,
    y: (point.y - camera.offsetY) / camera.scale,
  };
}

export function worldToScreen(camera: Camera, point: ScreenPoint): ScreenPoint {
  return {
    x: point.x * camera.scale + camera.offsetX,
    y: point.y * camera.scale + camera.offsetY,
  };
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, offsetX: camera.offsetX + dx, offsetY: camera.offsetY + dy };
}

export function zoomAt(camera: Camera, anchor: ScreenPoint, nextScale: number): Camera {
  const scale = clampScale(nextScale);
  if (scale === camera.scale) return camera;

  const world = screenToWorld(camera, anchor);
  return {
    scale,
    offsetX: anchor.x - world.x * scale,
    offsetY: anchor.y - world.y * scale,
  };
}

export function zoomBy(camera: Camera, anchor: ScreenPoint, factor: number): Camera {
  return zoomAt(camera, anchor, camera.scale * factor);
}

export function fitMapToViewport(
  mapWidth: number,
  mapHeight: number,
  viewport: ViewportSize,
  padding = DEFAULT_FIT_PADDING,
  originX = 0,
  originY = 0,
): Camera {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = clampScale(Math.min(availableWidth / mapWidth, availableHeight / mapHeight));

  return {
    scale,
    offsetX: (viewport.width - mapWidth * scale) / 2 - originX * scale,
    offsetY: (viewport.height - mapHeight * scale) / 2 - originY * scale,
  };
}
