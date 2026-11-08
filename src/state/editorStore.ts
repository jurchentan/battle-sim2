import { create } from 'zustand';
import type { OutsideCanvasMode, Point, TerrainFeatureKind } from '../models';

export type EditorTool = 'select' | 'pan' | TerrainFeatureKind;
export type DrawMode = 'freehand' | 'vertices';

export const TOOL_SHORTCUTS: Record<string, EditorTool> = {
  v: 'select',
  h: 'pan',
  f: 'forest',
  g: 'field',
  w: 'lake',
  m: 'swamp',
  r: 'river',
  o: 'road',
  c: 'contour',
  p: 'customPath',
  b: 'building',
  k: 'bridge',
  n: 'fortification',
  t: 'label',
};

export const DRAW_MODE_SHORTCUTS: Record<string, DrawMode> = {
  a: 'freehand',
  e: 'vertices',
};

interface EditorState {
  tool: EditorTool;
  drawMode: DrawMode;
  activeLayerId: string | null;
  selectedFeatureId: string | null;
  draftPoints: Point[];
  outsideCanvasMode: OutsideCanvasMode;
  setTool: (tool: EditorTool) => void;
  setDrawMode: (drawMode: DrawMode) => void;
  setActiveLayer: (layerId: string) => void;
  selectFeature: (featureId: string | null) => void;
  setDraftPoints: (points: Point[]) => void;
  clearDraft: () => void;
  setOutsideCanvasMode: (mode: OutsideCanvasMode) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  tool: 'select',
  drawMode: 'freehand',
  activeLayerId: null,
  selectedFeatureId: null,
  draftPoints: [],
  outsideCanvasMode: 'show',

  setTool: (tool) =>
    set((state) => ({
      tool,
      selectedFeatureId: tool === 'select' ? state.selectedFeatureId : null,
      draftPoints: [],
    })),

  setDrawMode: (drawMode) => set({ drawMode }),

  setActiveLayer: (activeLayerId) => set({ activeLayerId }),

  selectFeature: (selectedFeatureId) => set({ selectedFeatureId }),

  setDraftPoints: (draftPoints) => set({ draftPoints }),

  clearDraft: () => set({ draftPoints: [] }),

  setOutsideCanvasMode: (outsideCanvasMode) => set({ outsideCanvasMode }),
}));
