import { create } from 'zustand';
import { createId, createSeedRoster, type ArmyRoster } from '../models';
import { parseArmyFile } from '../features/army/armyFile';
import { createBlankRoster, duplicateRoster } from '../features/army/rosterDocuments';
import {
  deleteRosterRecord,
  getRosterRecord,
  listRosterRecords,
  putRosterRecord,
} from '../features/army/rosterLibraryDb';
import { copyName, uniqueName } from '../features/library/documentNames';
import { useRosterStore } from './rosterStore';
import type { SaveStatus } from './libraryStore';

const LAST_ROSTER_KEY = 'battle-map-editor.last-army-roster-id';
const AUTOSAVE_DELAY_MS = 700;

export interface RosterSummary {
  id: string;
  name: string;
  factionCount: number;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RosterImportResult {
  ok: boolean;
  document?: ArmyRoster;
  message?: string;
}

export interface NewRosterOptions {
  name?: string;
}

interface RosterLibraryState {
  ready: boolean;
  hydrating: boolean;
  activeRosterId: string | null;
  status: SaveStatus;
  rosters: RosterSummary[];
  lastSavedAt: string | null;
  error: string | null;
  initialize: () => Promise<void>;
  refreshRosters: () => Promise<void>;
  newRoster: (options?: NewRosterOptions) => Promise<void>;
  openRoster: (id: string) => Promise<void>;
  saveNow: () => Promise<void>;
  duplicateRoster: (id: string) => Promise<void>;
  renameRoster: (id: string, name: string) => Promise<void>;
  deleteRoster: (id: string) => Promise<void>;
  importRosterText: (text: string) => Promise<RosterImportResult>;
  scheduleAutosave: () => void;
  clearError: () => void;
}

function summarize(document: ArmyRoster): RosterSummary {
  return {
    id: document.id,
    name: document.name,
    factionCount: document.factions.length,
    unitCount: document.units.length,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readLastRosterId(): string | null {
  try {
    return window.localStorage.getItem(LAST_ROSTER_KEY);
  } catch {
    return null;
  }
}

function writeLastRosterId(id: string): void {
  try {
    window.localStorage.setItem(LAST_ROSTER_KEY, id);
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

export const useRosterLibraryStore = create<RosterLibraryState>()((set, get) => {
  const loadIntoEditor = (document: ArmyRoster): void => {
    set({ hydrating: true });
    try {
      useRosterStore.getState().loadDocument(document);
    } finally {
      set({ hydrating: false });
    }
  };

  const activate = (document: ArmyRoster): void => {
    loadIntoEditor(document);
    writeLastRosterId(document.id);
    set({
      activeRosterId: document.id,
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
    activeRosterId: null,
    status: 'loading',
    rosters: [],
    lastSavedAt: null,
    error: null,

    initialize: async () => {
      if (get().ready) return;
      if (initialization) return initialization;

      initialization = (async () => {
        set({ status: 'loading', error: null });
        try {
          let records = await listRosterRecords();
          if (records.length === 0) {
            const seed = createSeedRoster();
            await putRosterRecord(seed);
            records = [seed];
          }

          const lastId = readLastRosterId();
          const document = records.find((record) => record.id === lastId) ?? records[0];
          if (!document) {
            throw new Error('No army rosters are available.');
          }

          loadIntoEditor(document);
          writeLastRosterId(document.id);
          set({
            ready: true,
            activeRosterId: document.id,
            rosters: records.map(summarize),
            status: 'saved',
            lastSavedAt: new Date().toISOString(),
            error: null,
          });
        } catch (error) {
          set({
            ready: true,
            status: 'error',
            error: `Could not open the army roster library: ${errorMessage(error)}`,
          });
        }
      })();

      await initialization;
    },

    refreshRosters: async () => {
      try {
        const records = await listRosterRecords();
        set({ rosters: records.map(summarize) });
      } catch (error) {
        set({ error: `Could not read the army roster library: ${errorMessage(error)}` });
      }
    },

    newRoster: async (options = {}) => {
      if (!(await flushCurrentDocument())) return;

      set({ error: null });
      try {
        const name = uniqueName(
          options.name?.trim() || 'Untitled roster',
          get().rosters.map((roster) => roster.name),
        );
        const document = createBlankRoster(name);
        await putRosterRecord(document);
        activate(document);
        await get().refreshRosters();
      } catch (error) {
        set({ error: `Could not create an army roster: ${errorMessage(error)}` });
      }
    },

    openRoster: async (id) => {
      if (id === get().activeRosterId) {
        await flushCurrentDocument();
        return;
      }
      if (!(await flushCurrentDocument())) return;

      set({ error: null });
      try {
        const document = await getRosterRecord(id);
        if (!document) {
          set({ error: 'The selected army roster no longer exists.' });
          await get().refreshRosters();
          return;
        }

        activate(document);
        await get().refreshRosters();
      } catch (error) {
        set({ error: `Could not open the army roster: ${errorMessage(error)}` });
      }
    },

    saveNow: () => {
      clearAutosaveTimer();

      const run = async (): Promise<void> => {
        const activeRosterId = get().activeRosterId;
        const document = useRosterStore.getState().document;
        if (!activeRosterId || document.id !== activeRosterId) return;

        set({ status: 'saving', error: null });
        try {
          await putRosterRecord(document);
          if (get().activeRosterId !== activeRosterId) return;

          const currentDocument = useRosterStore.getState().document;
          const savedAt = new Date().toISOString();
          if (currentDocument !== document) {
            set({ status: 'unsaved', lastSavedAt: savedAt, error: null });
            get().scheduleAutosave();
          } else {
            set({ status: 'saved', lastSavedAt: savedAt, error: null });
          }
          await get().refreshRosters();
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

    duplicateRoster: async (id) => {
      if (!(await flushCurrentDocument())) return;

      set({ error: null });
      try {
        const source =
          id === get().activeRosterId
            ? useRosterStore.getState().document
            : await getRosterRecord(id);
        if (!source) {
          set({ error: 'The army roster could not be found.' });
          await get().refreshRosters();
          return;
        }

        const name = copyName(
          source.name,
          get().rosters.map((roster) => roster.name),
        );
        const duplicate = duplicateRoster(source, name);
        await putRosterRecord(duplicate);
        activate(duplicate);
        await get().refreshRosters();
      } catch (error) {
        set({ error: `Could not duplicate the army roster: ${errorMessage(error)}` });
      }
    },

    renameRoster: async (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) {
        set({ error: 'An army roster name is required.' });
        return;
      }

      set({ error: null });
      try {
        if (id === get().activeRosterId) {
          const result = useRosterStore.getState().renameDocument(trimmed);
          if (!result.ok) {
            set({ error: result.error });
            return;
          }
          await get().saveNow();
          return;
        }

        const document = await getRosterRecord(id);
        if (!document) {
          set({ error: 'The army roster could not be found.' });
          await get().refreshRosters();
          return;
        }

        await putRosterRecord({
          ...document,
          name: trimmed,
          updatedAt: new Date().toISOString(),
        });
        await get().refreshRosters();
      } catch (error) {
        set({ error: `Could not rename the army roster: ${errorMessage(error)}` });
      }
    },

    deleteRoster: async (id) => {
      set({ error: null });
      try {
        if (id === get().activeRosterId) {
          clearAutosaveTimer();
          await saveChain;
        } else if (!(await flushCurrentDocument())) {
          return;
        }

        await deleteRosterRecord(id);
        const remaining = await listRosterRecords();
        set({ rosters: remaining.map(summarize) });

        if (id !== get().activeRosterId) return;

        const next = remaining[0];
        if (next) {
          const document = await getRosterRecord(next.id);
          if (document) {
            activate(document);
            return;
          }
        }

        const blank = createBlankRoster(
          uniqueName(
            'Untitled roster',
            remaining.map((roster) => roster.name),
          ),
        );
        await putRosterRecord(blank);
        activate(blank);
        await get().refreshRosters();
      } catch (error) {
        set({ error: `Could not delete the army roster: ${errorMessage(error)}` });
      }
    },

    importRosterText: async (text) => {
      const parsed = parseArmyFile(text);
      if (!parsed.ok) {
        const message = parsed.issues?.length
          ? `${parsed.error} ${parsed.issues.slice(0, 3).join(' ')}`
          : parsed.error;
        set({ error: message });
        return { ok: false, message };
      }

      if (!(await flushCurrentDocument())) {
        return { ok: false, message: 'The current army roster could not be saved.' };
      }

      set({ error: null });
      try {
        const incoming = parsed.document;
        const existing = await getRosterRecord(incoming.id);
        const imported: ArmyRoster = existing
          ? {
              ...structuredClone(incoming),
              id: createId(),
              updatedAt: new Date().toISOString(),
            }
          : incoming;

        await putRosterRecord(imported);
        activate(imported);
        await get().refreshRosters();
        return { ok: true, document: imported };
      } catch (error) {
        const message = `Could not import the army file: ${errorMessage(error)}`;
        set({ error: message });
        return { ok: false, message };
      }
    },

    scheduleAutosave: () => {
      const library = get();
      if (!library.ready || library.activeRosterId === null) return;

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
