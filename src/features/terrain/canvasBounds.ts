import type { OutsideCanvasMode, TerrainCanvasBounds, TerrainMap } from '../../models';

type CanvasDocument = Pick<TerrainMap, 'width' | 'height' | 'originX' | 'originY'> &
  Pick<Partial<TerrainMap>, 'originalCanvas'>;

export function currentCanvasBounds(document: CanvasDocument): TerrainCanvasBounds {
  return {
    width: document.width,
    height: document.height,
    originX: document.originX,
    originY: document.originY,
  };
}

export function originalCanvasBounds(document: CanvasDocument): TerrainCanvasBounds {
  const original = document.originalCanvas;
  return original
    ? {
        width: original.width,
        height: original.height,
        originX: original.originX,
        originY: original.originY,
      }
    : currentCanvasBounds(document);
}

export function isCanvasExpanded(document: CanvasDocument): boolean {
  const current = currentCanvasBounds(document);
  const original = originalCanvasBounds(document);

  return (
    current.width !== original.width ||
    current.height !== original.height ||
    current.originX !== original.originX ||
    current.originY !== original.originY
  );
}

export function visibleCanvasBounds(
  document: CanvasDocument,
  mode: OutsideCanvasMode,
): TerrainCanvasBounds {
  return mode === 'hide' ? originalCanvasBounds(document) : currentCanvasBounds(document);
}

/**
 * Returns the expansion strips around the original canvas as four possible
 * rectangles: top, bottom, left, and right. Zero-sized strips are omitted.
 */
export function outsideCanvasRegions(document: CanvasDocument): TerrainCanvasBounds[] {
  const current = currentCanvasBounds(document);
  const original = originalCanvasBounds(document);
  const regions: TerrainCanvasBounds[] = [];

  const top = original.originY - current.originY;
  if (top > 0) {
    regions.push({
      width: current.width,
      height: top,
      originX: current.originX,
      originY: current.originY,
    });
  }

  const bottom = current.originY + current.height - (original.originY + original.height);
  if (bottom > 0) {
    regions.push({
      width: current.width,
      height: bottom,
      originX: current.originX,
      originY: original.originY + original.height,
    });
  }

  const left = original.originX - current.originX;
  if (left > 0) {
    regions.push({
      width: left,
      height: original.height,
      originX: current.originX,
      originY: original.originY,
    });
  }

  const right = current.originX + current.width - (original.originX + original.width);
  if (right > 0) {
    regions.push({
      width: right,
      height: original.height,
      originX: original.originX + original.width,
      originY: original.originY,
    });
  }

  return regions;
}
