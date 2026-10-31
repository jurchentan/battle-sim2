import { useEffect } from 'react';
import { TOOL_SHORTCUTS, useEditorStore } from '../../state/editorStore';
import { useTerrainStore } from '../../state/terrainStore';

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useEditorShortcuts(): void {
  const setTool = useEditorStore((state) => state.setTool);
  const undo = useTerrainStore((state) => state.undo);
  const redo = useTerrainStore((state) => state.redo);

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

      if (meta || event.altKey || event.shiftKey) return;

      const tool = TOOL_SHORTCUTS[key];
      if (tool) {
        event.preventDefault();
        setTool(tool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, setTool, undo]);
}
