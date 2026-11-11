export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Ordered rectangle between two drag points, safe for any drag direction. */
export function rectangleFromPoints(start: ScreenPoint, end: ScreenPoint): ScreenRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/** True when two axis-aligned rectangles overlap or touch. */
export function rectanglesIntersect(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
}

/**
 * A drag shorter than this is treated as an ordinary click instead of a
 * marquee. It keeps accidental one-pixel drags from changing the selection.
 */
export const MARQUEE_MIN_SIZE = 4;

export function isMeaningfulMarquee(rect: ScreenRect): boolean {
  return rect.width >= MARQUEE_MIN_SIZE || rect.height >= MARQUEE_MIN_SIZE;
}
