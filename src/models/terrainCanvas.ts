export const DEFAULT_TERRAIN_WIDTH = 2000;
export const DEFAULT_TERRAIN_HEIGHT = 1400;
export const MIN_TERRAIN_DIMENSION = 200;
export const MAX_TERRAIN_DIMENSION = 10000;

export interface TerrainCanvasSize {
  width: number;
  height: number;
}

export interface TerrainCanvasMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TerrainCanvasBounds extends TerrainCanvasSize {
  originX: number;
  originY: number;
}

export type OutsideCanvasMode = 'show' | 'dim' | 'hide';
