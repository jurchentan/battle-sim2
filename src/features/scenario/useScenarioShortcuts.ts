import { useEffect } from 'react';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import { isTypingTarget } from '../terrain/useEditorShortcuts';

export function useScenarioShortcuts(): void {
  const selectedUnitIds = useScenarioEditorStore((state) => state.selectedUnitIds);
  const undo = useScenarioStore((state) => state.undo);
  const redo = useScenarioStore((state) => state.redo);

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

      if (meta || event.altKey) return;

      if ((key === 'delete' || key === 'backspace') && selectedUnitIds.length > 0) {
        event.preventDefault();
        useScenarioStore.getState().undeployUnits(selectedUnitIds);
        if (selectedUnitIds.length === 1) {
          useScenarioEditorStore.getState().selectUnit(selectedUnitIds[0] ?? null);
        } else {
          useScenarioEditorStore.getState().selectUnits([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, selectedUnitIds, undo]);
}
