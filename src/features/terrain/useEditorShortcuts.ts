import { useEffect } from 'react';
import { DRAW_MODE_SHORTCUTS, TOOL_SHORTCUTS, useEditorStore } from '../../state/editorStore';
import { useTerrainStore } from '../../state/terrainStore';

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useEditorShortcuts(): void {
  const setTool = useEditorStore((state) => state.setTool);
  const setDrawMode = useEditorStore((state) => state.setDrawMode);
  const selectedFeatureId = useEditorStore((state) => state.selectedFeatureId);
  const selectFeature = useEditorStore((state) => state.selectFeature);
  const undo = useTerrainStore((state) => state.undo);
  const redo = useTerrainStore((state) => state.redo);
  const deleteFeature = useTerrainStore((state) => state.deleteFeature);
  const duplicateFeature = useTerrainStore((state) => state.duplicateFeature);
  const moveFeature = useTerrainStore((state) => state.moveFeature);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;

      if (meta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (meta && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (meta && key === 'd') {
        if (selectedFeatureId) {
          event.preventDefault();
          const duplicateId = duplicateFeature(selectedFeatureId);
          if (duplicateId) selectFeature(duplicateId);
        }
        return;
      }

      if (meta && (key === ']' || key === '[')) {
        if (selectedFeatureId) {
          event.preventDefault();
          const direction =
            key === ']'
              ? event.shiftKey
                ? 'front'
                : 'forward'
              : event.shiftKey
                ? 'back'
                : 'backward';
          moveFeature(selectedFeatureId, direction);
        }
        return;
      }

      if (meta || event.altKey) return;

      if (key === 'delete' || key === 'backspace') {
        if (selectedFeatureId) {
          event.preventDefault();
          deleteFeature(selectedFeatureId);
          selectFeature(null);
        }
        return;
      }

      if (event.shiftKey) return;

      const drawMode = DRAW_MODE_SHORTCUTS[key];
      if (drawMode) {
        event.preventDefault();
        setDrawMode(drawMode);
        return;
      }

      const tool = TOOL_SHORTCUTS[key];
      if (tool) {
        event.preventDefault();
        setTool(tool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    deleteFeature,
    duplicateFeature,
    moveFeature,
    redo,
    selectFeature,
    selectedFeatureId,
    setDrawMode,
    setTool,
    undo,
  ]);
}
