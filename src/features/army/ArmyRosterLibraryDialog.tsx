import { useEffect, useState } from 'react';
import { downloadArmyFile } from '../files/download';
import { useRosterLibraryStore } from '../../state/rosterLibraryStore';
import { useRosterStore } from '../../state/rosterStore';
import { getRosterRecord } from './rosterLibraryDb';
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from './ui';

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function ArmyRosterLibraryDialog({
  onClose,
  onNewRoster,
}: {
  onClose: () => void;
  onNewRoster: () => void;
}) {
  const rosters = useRosterLibraryStore((state) => state.rosters);
  const activeRosterId = useRosterLibraryStore((state) => state.activeRosterId);
  const error = useRosterLibraryStore((state) => state.error);
  const openRoster = useRosterLibraryStore((state) => state.openRoster);
  const duplicateRoster = useRosterLibraryStore((state) => state.duplicateRoster);
  const renameRoster = useRosterLibraryStore((state) => state.renameRoster);
  const deleteRoster = useRosterLibraryStore((state) => state.deleteRoster);
  const clearError = useRosterLibraryStore((state) => state.clearError);

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
    await openRoster(id);
    if (!useRosterLibraryStore.getState().error) onClose();
  };

  const handleRename = async (id: string): Promise<void> => {
    await renameRoster(id, renameDraft);
    if (!useRosterLibraryStore.getState().error) {
      setRenamingId(null);
      setRenameDraft('');
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    await deleteRoster(id);
    if (!useRosterLibraryStore.getState().error) setConfirmDeleteId(null);
  };

  const handleExport = async (id: string): Promise<void> => {
    const document =
      id === activeRosterId ? useRosterStore.getState().document : await getRosterRecord(id);
    if (document) downloadArmyFile(document);
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
        aria-labelledby="army-library-heading"
        data-testid="army-library"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e0d6c1] px-5 py-4">
          <div>
            <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
              Local army roster library
            </p>
            <h2
              id="army-library-heading"
              className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
            >
              Saved army rosters
            </h2>
            <p className="mt-1 text-xs text-[#7c715c]">
              Stored in this browser with IndexedDB. Export a file to back up or share a roster.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close army roster library"
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
          {rosters.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#d8cdb5] px-4 py-8 text-center text-sm text-[#7c715c]">
              No saved army rosters yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {rosters.map((roster) => {
                const active = roster.id === activeRosterId;

                return (
                  <li
                    key={roster.id}
                    data-testid={`library-roster-${roster.id}`}
                    className={[
                      'rounded-lg border px-3 py-2.5',
                      active ? 'border-[#7d916f] bg-[#eef1e4]' : 'border-[#e2d8c3] bg-[#f8f2e5]',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-[#3b352a]">
                          <span className="truncate">{roster.name}</span>
                          {active ? (
                            <span className="rounded-full border border-[#9caf8d] bg-[#dfe7d4] px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-wide text-[#4f6344] uppercase">
                              Open
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-[#7c715c]">
                          {roster.factionCount} factions · {roster.unitCount} units · Updated{' '}
                          {formatUpdatedAt(roster.updatedAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {renamingId === roster.id ? (
                          <form
                            className="flex flex-wrap items-center gap-1.5"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleRename(roster.id);
                            }}
                          >
                            <input
                              autoFocus
                              type="text"
                              aria-label={`Rename roster ${roster.name}`}
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
                        ) : confirmDeleteId === roster.id ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[0.68rem] font-semibold text-[#8b3a2f]">
                              Delete this roster?
                            </span>
                            <button
                              type="button"
                              className={dangerButtonClass}
                              onClick={() => void handleDelete(roster.id)}
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
                              aria-label={`Open roster ${roster.name}`}
                              className={active ? primaryButtonClass : secondaryButtonClass}
                              onClick={() => void handleOpen(roster.id)}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              aria-label={`Rename roster ${roster.name}`}
                              className={secondaryButtonClass}
                              onClick={() => {
                                setRenamingId(roster.id);
                                setRenameDraft(roster.name);
                                setConfirmDeleteId(null);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              aria-label={`Duplicate roster ${roster.name}`}
                              className={secondaryButtonClass}
                              onClick={() => void duplicateRoster(roster.id)}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              aria-label={`Export roster ${roster.name}`}
                              className={secondaryButtonClass}
                              onClick={() => void handleExport(roster.id)}
                            >
                              Export
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete roster ${roster.name}`}
                              className={dangerButtonClass}
                              onClick={() => {
                                setConfirmDeleteId(roster.id);
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
            Autosave keeps the open roster current. Failed imports leave it untouched.
          </p>
          <button type="button" className={primaryButtonClass} onClick={onNewRoster}>
            New roster
          </button>
        </footer>
      </div>
    </div>
  );
}
