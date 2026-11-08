import { useEffect } from 'react';
import { useRosterLibraryStore } from '../../state/rosterLibraryStore';
import { useRosterStore } from '../../state/rosterStore';

export function useArmyPersistence(): void {
  const initialize = useRosterLibraryStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    return useRosterStore.subscribe((state, previous) => {
      if (state.document === previous.document) return;

      const library = useRosterLibraryStore.getState();
      if (!library.ready || library.hydrating) return;
      if (state.document.id !== library.activeRosterId) return;
      library.scheduleAutosave();
    });
  }, []);
}
