import { create } from 'zustand';
import type { Point } from '../models';

export type EditorTool = 'select' | 'pan' | 'polygon' | 'polyline' | 'text';

export const TOOL_SHORTCUTS: Record<string, EditorTool> = {
  v: 'select',
  h: 'pan',
  p: 'polygon',
  l: 'polyline',
  t: 'text',
};

interface EditorState {
  tool: EditorTool;
  activeLayerId: string | null;
  selectedFeatureId: string | null;
  draftPoints: Point[];
  setTool: (tool: EditorTool) => void;
  setActiveLayer: (layerId: string) => void;
  selectFeature: (featureId: string | null) => void;
  setDraftPoints: (points: Point[]) => void;
  clearDraft: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  tool: 'select',
  activeLayerId: null,
  selectedFeatureId: null,
  draftPoints: [],

  setTool: (tool) =>
    set((state) => ({
      tool,
      selectedFeatureId: tool === 'select' ? state.selectedFeatureId : null,
      draftPoints: [],
    })),

  setActiveLayer: (activeLayerId) => set({ activeLayerId }),

  selectFeature: (selectedFeatureId) => set({ selectedFeatureId }),

  setDraftPoints: (draftPoints) => set({ draftPoints }),

  clearDraft: () => set({ draftPoints: [] }),
}));
