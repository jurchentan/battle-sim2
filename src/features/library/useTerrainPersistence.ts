import { useEffect } from 'react';
import { useLibraryStore } from '../../state/libraryStore';
import { useTerrainStore } from '../../state/terrainStore';

export function useTerrainPersistence(): void {
  const initialize = useLibraryStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    return useTerrainStore.subscribe((state, previous) => {
      if (state.document === previous.document) return;

      const library = useLibraryStore.getState();
      if (!library.ready || library.hydrating) return;
      if (state.document.id !== library.activeMapId) return;
      library.scheduleAutosave();
    });
  }, []);
}
