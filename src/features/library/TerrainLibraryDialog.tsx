import { useEffect, useState } from 'react';
import { downloadTerrainFile } from '../files/download';
import { getTerrainMapRecord } from './terrainLibraryDb';
import { useLibraryStore } from '../../state/libraryStore';
import { useTerrainStore } from '../../state/terrainStore';

const secondaryButtonClass =
  'rounded border border-[#d8cdb5] bg-white/60 px-2 py-1 text-[0.65rem] font-semibold text-[#5f594b] transition-colors hover:border-[#b8a98a] hover:bg-[#efe5d2]';
const primaryButtonClass =
  'rounded-md border border-[#7d916f] bg-[#eef1e4] px-2.5 py-1.5 text-xs font-semibold text-[#3d5236] transition-colors hover:border-[#5f7352] hover:bg-[#e2e8d7] disabled:cursor-not-allowed disabled:opacity-40';
const dangerButtonClass =
  'rounded border border-[#d3b3a8] bg-[#f9ede8] px-2 py-1 text-[0.65rem] font-semibold text-[#8b3a2f] transition-colors hover:border-[#b98a7b] hover:bg-[#f3ddd4]';

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function TerrainLibraryDialog({
  onClose,
  onNewMap,
}: {
  onClose: () => void;
  onNewMap: () => void;
}) {
  const maps = useLibraryStore((state) => state.maps);
  const activeMapId = useLibraryStore((state) => state.activeMapId);
  const error = useLibraryStore((state) => state.error);
  const openMap = useLibraryStore((state) => state.openMap);
  const duplicateMap = useLibraryStore((state) => state.duplicateMap);
  const renameMap = useLibraryStore((state) => state.renameMap);
  const deleteMap = useLibraryStore((state) => state.deleteMap);
  const clearError = useLibraryStore((state) => state.clearError);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOpen = async (id: string): Promise<void> => {
    await openMap(id);
    if (!useLibraryStore.getState().error) onClose();
  };

  const handleRename = async (id: string): Promise<void> => {
    await renameMap(id, renameDraft);
    if (!useLibraryStore.getState().error) {
      setRenamingId(null);
      setRenameDraft('');
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    await deleteMap(id);
    if (!useLibraryStore.getState().error) setConfirmDeleteId(null);
  };

  const handleExport = async (id: string): Promise<void> => {
    const document =
      id === activeMapId ? useTerrainStore.getState().document : await getTerrainMapRecord(id);
    if (document) downloadTerrainFile(document);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2b23]/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terrain-library-heading"
        data-testid="terrain-library"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e0d6c1] px-5 py-4">
          <div>
            <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
              Local terrain library
            </p>
            <h2
              id="terrain-library-heading"
              className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
            >
              Saved terrain maps
            </h2>
            <p className="mt-1 text-xs text-[#7c715c]">
              Stored in this browser with IndexedDB. Export a file to back up or share a map.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close terrain library"
            className={secondaryButtonClass}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        {error ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 border-b border-[#d3b3a8] bg-[#f9ede8] px-5 py-2.5 text-xs text-[#8b3a2f]"
          >
            <span>{error}</span>
            <button type="button" className="shrink-0 font-semibold underline" onClick={clearError}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {maps.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#d8cdb5] px-4 py-8 text-center text-sm text-[#7c715c]">
              No saved terrain maps yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {maps.map((map) => {
                const active = map.id === activeMapId;

                return (
                  <li
                    key={map.id}
                    data-testid={`library-map-${map.id}`}
                    className={[
                      'rounded-lg border px-3 py-2.5',
                      active ? 'border-[#7d916f] bg-[#eef1e4]' : 'border-[#e2d8c3] bg-[#f8f2e5]',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-[#3b352a]">
                          <span className="truncate">{map.name}</span>
                          {active ? (
                            <span className="rounded-full border border-[#9caf8d] bg-[#dfe7d4] px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-wide text-[#4f6344] uppercase">
                              Open
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-[#7c715c]">
                          {map.featureCount} features · {map.width} × {map.height} · Updated{' '}
                          {formatUpdatedAt(map.updatedAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {renamingId === map.id ? (
                          <form
                            className="flex flex-wrap items-center gap-1.5"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleRename(map.id);
                            }}
                          >
                            <input
                              autoFocus
                              type="text"
                              aria-label={`Rename map ${map.name}`}
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  setRenamingId(null);
                                  setRenameDraft('');
                                }
                              }}
                              className="w-44 rounded border border-[#cfc3a8] bg-white px-2 py-1 text-xs text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25"
                            />
                            <button type="submit" className={primaryButtonClass}>
                              Save name
                            </button>
                            <button
                              type="button"
                              className={secondaryButtonClass}
                              onClick={() => {
                                setRenamingId(null);
                                setRenameDraft('');
                              }}
                            >
                              Cancel
                            </button>
                          </form>
                        ) : confirmDeleteId === map.id ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[0.68rem] font-semibold text-[#8b3a2f]">
                              Delete this map?
                            </span>
                            <button
                              type="button"
                              className={dangerButtonClass}
                              onClick={() => void handleDelete(map.id)}
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              className={secondaryButtonClass}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel delete
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`Open ${map.name}`}
                              className={active ? primaryButtonClass : secondaryButtonClass}
                              onClick={() => void handleOpen(map.id)}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              aria-label={`Rename ${map.name}`}
                              className={secondaryButtonClass}
                              onClick={() => {
                                setRenamingId(map.id);
                                setRenameDraft(map.name);
                                setConfirmDeleteId(null);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              aria-label={`Duplicate ${map.name}`}
                              className={secondaryButtonClass}
                              onClick={() => void duplicateMap(map.id)}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              aria-label={`Export ${map.name}`}
                              className={secondaryButtonClass}
                              onClick={() => void handleExport(map.id)}
                            >
                              Export
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${map.name}`}
                              className={dangerButtonClass}
                              onClick={() => {
                                setConfirmDeleteId(map.id);
                                setRenamingId(null);
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0d6c1] px-5 py-3">
          <p className="text-[0.65rem] text-[#857a64]">
            Autosave keeps the open map current. Failed imports leave it untouched.
          </p>
          <button type="button" className={primaryButtonClass} onClick={onNewMap}>
            New map
          </button>
        </footer>
      </div>
    </div>
  );
}
