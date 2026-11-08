import { create } from 'zustand';
import {
  createId,
  createSeedTerrainMap,
  DEFAULT_TERRAIN_HEIGHT,
  DEFAULT_TERRAIN_WIDTH,
  MAX_TERRAIN_DIMENSION,
  MIN_TERRAIN_DIMENSION,
  type TerrainMap,
} from '../models';
import { parseTerrainFile } from '../features/files/terrainFile';
import {
  copyName,
  createBlankTerrainMap,
  duplicateTerrainMap,
  normalizeTerrainMap,
  uniqueName,
} from '../features/library/terrainDocuments';
import {
  deleteTerrainMapRecord,
  getTerrainMapRecord,
  listTerrainMapRecords,
  putTerrainMapRecord,
} from '../features/library/terrainLibraryDb';
import { useTerrainStore } from './terrainStore';

const LAST_MAP_KEY = 'battle-map-editor.last-terrain-map-id';
const AUTOSAVE_DELAY_MS = 700;

export type SaveStatus = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error';

export interface TerrainMapSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  featureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TerrainImportResult {
  ok: boolean;
  document?: TerrainMap;
  message?: string;
}

export interface NewTerrainMapOptions {
  name?: string;
  width?: number;
  height?: number;
}

interface LibraryState {
  ready: boolean;
  hydrating: boolean;
  activeMapId: string | null;
  status: SaveStatus;
  maps: TerrainMapSummary[];
  lastSavedAt: string | null;
  error: string | null;
  initialize: () => Promise<void>;
  refreshMaps: () => Promise<void>;
  newMap: (options?: NewTerrainMapOptions) => Promise<void>;
  openMap: (id: string) => Promise<void>;
  saveNow: () => Promise<void>;
  duplicateMap: (id: string) => Promise<void>;
  renameMap: (id: string, name: string) => Promise<void>;
  deleteMap: (id: string) => Promise<void>;
  importTerrainText: (text: string) => Promise<TerrainImportResult>;
  scheduleAutosave: () => void;
  clearError: () => void;
}

function summarize(document: TerrainMap): TerrainMapSummary {
  return {
    id: document.id,
    name: document.name,
    width: document.width,
    height: document.height,
    featureCount: document.features.length,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateNewMapSize(width: number, height: number): string | null {
  const validDimension = (value: number): boolean =>
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_TERRAIN_DIMENSION &&
    value <= MAX_TERRAIN_DIMENSION;

  if (!validDimension(width) || !validDimension(height)) {
    return `New map size must be whole numbers between ${MIN_TERRAIN_DIMENSION} and ${MAX_TERRAIN_DIMENSION} document units.`;
  }

  return null;
}

function readLastMapId(): string | null {
  try {
    return window.localStorage.getItem(LAST_MAP_KEY);
  } catch {
    return null;
  }
}

function writeLastMapId(id: string): void {
  try {
    window.localStorage.setItem(LAST_MAP_KEY, id);
  } catch {
    // A blocked localStorage should not prevent the library from working.
  }
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let initialization: Promise<void> | null = null;
let saveChain: Promise<void> = Promise.resolve();

function clearAutosaveTimer(): void {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

export const useLibraryStore = create<LibraryState>()((set, get) => {
  const loadIntoEditor = (document: TerrainMap): void => {
    set({ hydrating: true });
    try {
      useTerrainStore.getState().loadDocument(normalizeTerrainMap(document));
    } finally {
      set({ hydrating: false });
    }
  };

  const activate = (document: TerrainMap): void => {
    loadIntoEditor(document);
    writeLastMapId(document.id);
    set({
      activeMapId: document.id,
      status: 'saved',
      lastSavedAt: new Date().toISOString(),
      error: null,
    });
  };

  const flushCurrentDocument = async (): Promise<boolean> => {
    clearAutosaveTimer();
    if (get().status === 'unsaved') {
      await get().saveNow();
    } else if (get().status === 'saving') {
      await saveChain;
    }
    return get().status !== 'error';
  };

  return {
    ready: false,
    hydrating: false,
    activeMapId: null,
    status: 'loading',
    maps: [],
    lastSavedAt: null,
    error: null,

    initialize: async () => {
      if (get().ready) return;
      if (initialization) return initialization;

      initialization = (async () => {
        set({ status: 'loading', error: null });
        try {
          let records = await listTerrainMapRecords();
          if (records.length === 0) {
            const seed = createSeedTerrainMap();
            await putTerrainMapRecord(seed);
            records = [seed];
          }

          const lastId = readLastMapId();
          const document = records.find((record) => record.id === lastId) ?? records[0];
          if (!document) {
            throw new Error('No terrain documents are available.');
          }

          loadIntoEditor(document);
          writeLastMapId(document.id);
          set({
            ready: true,
            activeMapId: document.id,
            maps: records.map(summarize),
            status: 'saved',
            lastSavedAt: new Date().toISOString(),
            error: null,
          });
        } catch (error) {
          set({
            ready: true,
            status: 'error',
            error: `Could not open the terrain library: ${errorMessage(error)}`,
          });
        }
      })();

      await initialization;
    },

    refreshMaps: async () => {
      try {
        const records = await listTerrainMapRecords();
        set({ maps: records.map(summarize) });
      } catch (error) {
        set({ error: `Could not read the terrain library: ${errorMessage(error)}` });
      }
    },

    newMap: async (options = {}) => {
      const width = options.width ?? DEFAULT_TERRAIN_WIDTH;
      const height = options.height ?? DEFAULT_TERRAIN_HEIGHT;
      const sizeError = validateNewMapSize(width, height);
      if (sizeError) {
        set({ error: sizeError });
        return;
      }

      if (!(await flushCurrentDocument())) return;

      set({ error: null });
      try {
        const name = uniqueName(
          options.name?.trim() || 'Untitled terrain',
          get().maps.map((map) => map.name),
        );
        const document = createBlankTerrainMap(name, { width, height });
        await putTerrainMapRecord(document);
        activate(document);
        await get().refreshMaps();
      } catch (error) {
        set({ error: `Could not create a terrain map: ${errorMessage(error)}` });
      }
    },

    openMap: async (id) => {
      if (id === get().activeMapId) {
        await flushCurrentDocument();
        return;
      }
      if (!(await flushCurrentDocument())) return;

      set({ error: null });
      try {
        const document = await getTerrainMapRecord(id);
        if (!document) {
          set({ error: 'The selected terrain map no longer exists.' });
          await get().refreshMaps();
          return;
        }

        activate(document);
        await get().refreshMaps();
      } catch (error) {
        set({ error: `Could not open the terrain map: ${errorMessage(error)}` });
      }
    },

    saveNow: () => {
      clearAutosaveTimer();

      const run = async (): Promise<void> => {
        const activeMapId = get().activeMapId;
        const document = useTerrainStore.getState().document;
        if (!activeMapId || document.id !== activeMapId) return;

        set({ status: 'saving', error: null });
        try {
          await putTerrainMapRecord(document);
          if (get().activeMapId !== activeMapId) return;

          const currentDocument = useTerrainStore.getState().document;
          const savedAt = new Date().toISOString();
          if (currentDocument !== document) {
            set({ status: 'unsaved', lastSavedAt: savedAt, error: null });
            get().scheduleAutosave();
          } else {
            set({ status: 'saved', lastSavedAt: savedAt, error: null });
          }
          await get().refreshMaps();
        } catch (error) {
          set({
            status: 'error',
            error: `Could not save "${document.name}": ${errorMessage(error)}`,
          });
        }
      };

      saveChain = saveChain.then(run, run);
      return saveChain;
    },

    duplicateMap: async (id) => {
      if (!(await flushCurrentDocument())) return;

      set({ error: null });
      try {
        const source =
          id === get().activeMapId
            ? useTerrainStore.getState().document
            : await getTerrainMapRecord(id);
        if (!source) {
          set({ error: 'The terrain map could not be found.' });
          await get().refreshMaps();
          return;
        }

        const name = copyName(
          source.name,
          get().maps.map((map) => map.name),
        );
        const duplicate = duplicateTerrainMap(source, name);
        await putTerrainMapRecord(duplicate);
        activate(duplicate);
        await get().refreshMaps();
      } catch (error) {
        set({ error: `Could not duplicate the terrain map: ${errorMessage(error)}` });
      }
    },

    renameMap: async (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) {
        set({ error: 'A terrain map name is required.' });
        return;
      }

      set({ error: null });
      try {
        if (id === get().activeMapId) {
          useTerrainStore.getState().renameDocument(trimmed);
          await get().saveNow();
          return;
        }

        const document = await getTerrainMapRecord(id);
        if (!document) {
          set({ error: 'The terrain map could not be found.' });
          await get().refreshMaps();
          return;
        }

        await putTerrainMapRecord({
          ...document,
          name: trimmed,
          updatedAt: new Date().toISOString(),
        });
        await get().refreshMaps();
      } catch (error) {
        set({ error: `Could not rename the terrain map: ${errorMessage(error)}` });
      }
    },

    deleteMap: async (id) => {
      set({ error: null });
      try {
        if (id === get().activeMapId) {
          clearAutosaveTimer();
          await saveChain;
        } else if (!(await flushCurrentDocument())) {
          return;
        }

        await deleteTerrainMapRecord(id);
        const remaining = await listTerrainMapRecords();
        set({ maps: remaining.map(summarize) });

        if (id !== get().activeMapId) return;

        const next = remaining[0];
        if (next) {
          const document = await getTerrainMapRecord(next.id);
          if (document) {
            activate(document);
            return;
          }
        }

        const blank = createBlankTerrainMap(
          uniqueName(
            'Untitled terrain',
            remaining.map((map) => map.name),
          ),
        );
        await putTerrainMapRecord(blank);
        activate(blank);
        await get().refreshMaps();
      } catch (error) {
        set({ error: `Could not delete the terrain map: ${errorMessage(error)}` });
      }
    },

    importTerrainText: async (text) => {
      const parsed = parseTerrainFile(text);
      if (!parsed.ok) {
        const message = parsed.issues?.length
          ? `${parsed.error} ${parsed.issues.slice(0, 3).join(' ')}`
          : parsed.error;
        set({ error: message });
        return { ok: false, message };
      }

      if (!(await flushCurrentDocument())) {
        return { ok: false, message: 'The current terrain map could not be saved.' };
      }

      set({ error: null });
      try {
        const incoming = normalizeTerrainMap(parsed.document);
        const existing = await getTerrainMapRecord(incoming.id);
        const imported: TerrainMap = existing
          ? {
              ...structuredClone(incoming),
              id: createId(),
              updatedAt: new Date().toISOString(),
            }
          : incoming;

        await putTerrainMapRecord(imported);
        activate(imported);
        await get().refreshMaps();
        return { ok: true, document: imported };
      } catch (error) {
        const message = `Could not import the terrain file: ${errorMessage(error)}`;
        set({ error: message });
        return { ok: false, message };
      }
    },

    scheduleAutosave: () => {
      const library = get();
      if (!library.ready || library.activeMapId === null) return;

      clearAutosaveTimer();
      set({ status: 'unsaved' });
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        void get().saveNow();
      }, AUTOSAVE_DELAY_MS);
    },

    clearError: () => set({ error: null }),
  };
});
