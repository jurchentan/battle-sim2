import type { Point } from '../models';

export function flattenPoints(points: readonly Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

export function pointsCenter(points: readonly Point[]): Point {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX)) return { x: 0, y: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function offsetPoints(points: readonly Point[], dx: number, dy: number): Point[] {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

export function pointsEqual(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((point, index) => {
    const other = b[index];
    return other !== undefined && point.x === other.x && point.y === other.y;
  });
}

function squaredSegmentDistance(point: Point, start: Point, end: Point): number {
  let x = start.x;
  let y = start.y;
  let dx = end.x - x;
  let dy = end.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end.x;
      y = end.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point.x - x;
  dy = point.y - y;
  return dx * dx + dy * dy;
}

function simplifySection(
  points: readonly Point[],
  first: number,
  last: number,
  squaredTolerance: number,
  keep: boolean[],
): void {
  if (last <= first + 1) return;

  let farthest = -1;
  let farthestDistance = squaredTolerance;
  const start = points[first];
  const end = points[last];
  if (!start || !end) return;

  for (let index = first + 1; index < last; index += 1) {
    const point = points[index];
    if (!point) continue;
    const distance = squaredSegmentDistance(point, start, end);
    if (distance > farthestDistance) {
      farthest = index;
      farthestDistance = distance;
    }
  }

  if (farthest === -1) return;

  keep[farthest] = true;
  simplifySection(points, first, farthest, squaredTolerance, keep);
  simplifySection(points, farthest, last, squaredTolerance, keep);
}

export function simplifyPoints(points: readonly Point[], tolerance: number): Point[] {
  const cleaned = points.filter((point, index) => {
    const previous = points[index - 1];
    return (
      index === 0 || previous === undefined || point.x !== previous.x || point.y !== previous.y
    );
  });

  if (cleaned.length <= 2 || tolerance <= 0) {
    return cleaned.map((point) => ({ ...point }));
  }

  const keep = cleaned.map((_, index) => index === 0 || index === cleaned.length - 1);
  simplifySection(cleaned, 0, cleaned.length - 1, tolerance * tolerance, keep);

  return cleaned.filter((_, index) => keep[index]).map((point) => ({ ...point }));
}
