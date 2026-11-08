import {
  MAX_TERRAIN_DIMENSION,
  type TerrainCanvasBounds,
  type TerrainCanvasMargins,
} from '../../models';

export interface ExpandedCanvas extends TerrainCanvasBounds {
  changed: boolean;
}

export type CanvasExpansionResult =
  { ok: true; canvas: ExpandedCanvas } | { ok: false; error: string };

const MARGIN_LABELS: Record<keyof TerrainCanvasMargins, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};

/**
 * Adds space around an existing canvas without moving any world coordinates.
 * The origin moves by the top/left margins so all existing features keep their
 * positions relative to the map's new outer border.
 */
export function computeExpandedCanvas(
  canvas: TerrainCanvasBounds,
  margins: TerrainCanvasMargins,
): CanvasExpansionResult {
  for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
    const value = margins[edge];
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      return {
        ok: false,
        error: `${MARGIN_LABELS[edge]} margin must be zero or a positive whole number.`,
      };
    }
  }

  const width = canvas.width + margins.left + margins.right;
  const height = canvas.height + margins.top + margins.bottom;

  if (width > MAX_TERRAIN_DIMENSION || height > MAX_TERRAIN_DIMENSION) {
    return {
      ok: false,
      error: `The expanded canvas would be ${width} × ${height}. The maximum is ${MAX_TERRAIN_DIMENSION} × ${MAX_TERRAIN_DIMENSION}.`,
    };
  }

  return {
    ok: true,
    canvas: {
      width,
      height,
      originX: canvas.originX - margins.left,
      originY: canvas.originY - margins.top,
      changed: margins.top + margins.right + margins.bottom + margins.left > 0,
    },
  };
}
