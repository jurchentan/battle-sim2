import { beforeEach, describe, expect, it } from 'vitest';
import { DRAW_MODE_SHORTCUTS, TOOL_SHORTCUTS, useEditorStore } from './editorStore';

describe('editor drawing modes', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tool: 'select',
      drawMode: 'freehand',
      selectedFeatureId: null,
      draftPoints: [],
    });
  });

  it('defaults area and path drawing to freehand', () => {
    expect(useEditorStore.getState().drawMode).toBe('freehand');
  });

  it('switches between freehand and vertex drawing', () => {
    useEditorStore.getState().setDrawMode('vertices');
    expect(useEditorStore.getState().drawMode).toBe('vertices');

    useEditorStore.getState().setDrawMode('freehand');
    expect(useEditorStore.getState().drawMode).toBe('freehand');
  });

  it('keeps the chosen draw mode when selecting an area or path tool', () => {
    useEditorStore.getState().setDrawMode('vertices');
    useEditorStore.getState().setTool('forest');

    expect(useEditorStore.getState().tool).toBe('forest');
    expect(useEditorStore.getState().drawMode).toBe('vertices');
  });

  it('maps keyboard shortcuts for tools and draw modes', () => {
    expect(TOOL_SHORTCUTS.f).toBe('forest');
    expect(TOOL_SHORTCUTS.o).toBe('road');
    expect(DRAW_MODE_SHORTCUTS.a).toBe('freehand');
    expect(DRAW_MODE_SHORTCUTS.e).toBe('vertices');
  });
});
