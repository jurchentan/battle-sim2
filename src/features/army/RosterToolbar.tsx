import { useRef, useState, type ChangeEvent } from 'react';
import type { ArmyRoster } from '../../models';
import { downloadArmyFile } from '../files/download';
import { useRosterLibraryStore } from '../../state/rosterLibraryStore';
import { useRosterStore } from '../../state/rosterStore';
import type { SaveStatus } from '../../state/libraryStore';
import { ArmyRosterLibraryDialog } from './ArmyRosterLibraryDialog';
import { NewArmyRosterDialog } from './NewArmyRosterDialog';

const buttonClass =
  'rounded-md border border-[#c9bda3] bg-[#f8f2e5] px-2.5 py-1.5 text-xs font-semibold text-[#4a4438] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40';

const STATUS_LABELS: Record<SaveStatus, string> = {
  loading: 'Loading library…',
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
};

const STATUS_CLASSES: Record<SaveStatus, string> = {
  loading: 'border-[#d8cdb5] bg-[#f1e9d8] text-[#7c715c]',
  saved: 'border-[#a9bc99] bg-[#e8efde] text-[#4f6344]',
  unsaved: 'border-[#d8c08a] bg-[#f7edd3] text-[#7a6028]',
  saving: 'border-[#c9bda3] bg-[#f3ecdd] text-[#6b5d42]',
  error: 'border-[#d3b3a8] bg-[#f9ede8] text-[#8b3a2f]',
};

export function RosterToolbar({ roster }: { roster: ArmyRoster }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newRosterOpen, setNewRosterOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const canUndo = useRosterStore((state) => state.past.length > 0);
  const canRedo = useRosterStore((state) => state.future.length > 0);
  const undo = useRosterStore((state) => state.undo);
  const redo = useRosterStore((state) => state.redo);

  const status = useRosterLibraryStore((state) => state.status);
  const lastSavedAt = useRosterLibraryStore((state) => state.lastSavedAt);
  const error = useRosterLibraryStore((state) => state.error);
  const clearError = useRosterLibraryStore((state) => state.clearError);
  const saveNow = useRosterLibraryStore((state) => state.saveNow);
  const duplicateRoster = useRosterLibraryStore((state) => state.duplicateRoster);
  const importRosterText = useRosterLibraryStore((state) => state.importRosterText);
  const activeRosterId = useRosterLibraryStore((state) => state.activeRosterId);

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    await importRosterText(text);
  };

  return (
    <div className="border-b border-[#d8cdb5] bg-[#f6efe0]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[#2f2b23]">
            Army Roster Editor
          </h2>
          <p className="truncate text-xs text-[#7c715c]">
            <span data-testid="current-roster-name" className="font-semibold text-[#4a4438]">
              {roster.name}
            </span>
            <span data-testid="roster-summary">
              {' '}
              · {roster.factions.length} factions · {roster.units.length} units
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="roster-save-status"
            aria-live="polite"
            title={lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleString()}` : undefined}
            className={`inline-flex w-32 items-center justify-center whitespace-nowrap rounded-md border px-2 py-1 text-[0.65rem] font-semibold tracking-wide ${STATUS_CLASSES[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>

          <button type="button" className={buttonClass} onClick={() => setNewRosterOpen(true)}>
            New
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setLibraryOpen(true)}
            aria-label="Open army roster library"
          >
            Open
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void saveNow()}
            title="Save now (Ctrl/Cmd+S)"
          >
            Save
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label="Copy current roster"
            disabled={!activeRosterId}
            onClick={() => {
              if (activeRosterId) void duplicateRoster(activeRosterId);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </button>
          <button type="button" className={buttonClass} onClick={() => downloadArmyFile(roster)}>
            Export
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            data-testid="army-import-input"
            className="hidden"
            onChange={(event) => void handleImportFile(event)}
          />

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#d8cdb5]" />

          <button
            type="button"
            className={buttonClass}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
          >
            Redo
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 border-t border-[#d3b3a8] bg-[#f9ede8] px-4 py-2 text-xs text-[#8b3a2f]"
        >
          <span>{error}</span>
          <button type="button" className="shrink-0 font-semibold underline" onClick={clearError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {libraryOpen ? (
        <ArmyRosterLibraryDialog
          onClose={() => setLibraryOpen(false)}
          onNewRoster={() => {
            setLibraryOpen(false);
            setNewRosterOpen(true);
          }}
        />
      ) : null}

      {newRosterOpen ? <NewArmyRosterDialog onClose={() => setNewRosterOpen(false)} /> : null}
    </div>
  );
}
