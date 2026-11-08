import { useRef, useState, type ChangeEvent } from 'react';
import type { TerrainMap } from '../../models';
import { useCameraStore } from '../../canvas/cameraStore';
import { downloadTerrainFile } from '../files/download';
import { NewTerrainMapDialog } from '../library/NewTerrainMapDialog';
import { TerrainLibraryDialog } from '../library/TerrainLibraryDialog';
import { useEditorStore } from '../../state/editorStore';
import { useLibraryStore, type SaveStatus } from '../../state/libraryStore';
import { useTerrainStore } from '../../state/terrainStore';
import { visibleCanvasBounds } from './canvasBounds';
import { ExpandCanvasDialog } from './ExpandCanvasDialog';

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

const OUTSIDE_MODES = [
  {
    id: 'show',
    label: 'Show',
    title: 'Show all areas, including the expanded canvas',
    ariaLabel: 'Show areas outside the original canvas',
  },
  {
    id: 'dim',
    label: 'Grey',
    title: 'Grey out the area outside the original canvas',
    ariaLabel: 'Grey out areas outside the original canvas',
  },
  {
    id: 'hide',
    label: 'Hide',
    title: 'Hide everything outside the original canvas',
    ariaLabel: 'Hide areas outside the original canvas',
  },
] as const;

export function EditorToolbar({ map }: { map: TerrainMap }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [expandCanvasOpen, setExpandCanvasOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const canUndo = useTerrainStore((state) => state.past.length > 0);
  const canRedo = useTerrainStore((state) => state.future.length > 0);
  const undo = useTerrainStore((state) => state.undo);
  const redo = useTerrainStore((state) => state.redo);
  const outsideCanvasMode = useEditorStore((state) => state.outsideCanvasMode);
  const setOutsideCanvasMode = useEditorStore((state) => state.setOutsideCanvasMode);

  const status = useLibraryStore((state) => state.status);
  const lastSavedAt = useLibraryStore((state) => state.lastSavedAt);
  const error = useLibraryStore((state) => state.error);
  const clearError = useLibraryStore((state) => state.clearError);
  const saveNow = useLibraryStore((state) => state.saveNow);
  const duplicateMap = useLibraryStore((state) => state.duplicateMap);
  const importTerrainText = useLibraryStore((state) => state.importTerrainText);

  const scale = useCameraStore((state) => state.camera.scale);
  const zoomByStep = useCameraStore((state) => state.zoomByStep);
  const fit = useCameraStore((state) => state.fit);
  const activeMapId = useLibraryStore((state) => state.activeMapId);

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    await importTerrainText(text);
  };

  return (
    <div className="border-b border-[#d8cdb5] bg-[#f6efe0]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[#2f2b23]">
            Terrain Editor
          </h2>
          <p className="truncate text-xs text-[#7c715c]">
            <span data-testid="current-map-name" className="font-semibold text-[#4a4438]">
              {map.name}
            </span>
            <span>
              {' '}
              · {map.width} × {map.height} · {map.features.length} features
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="save-status"
            aria-live="polite"
            title={lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleString()}` : undefined}
            className={`inline-flex w-32 items-center justify-center whitespace-nowrap rounded-md border px-2 py-1 text-[0.65rem] font-semibold tracking-wide ${STATUS_CLASSES[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>

          <button type="button" className={buttonClass} onClick={() => setNewMapOpen(true)}>
            New
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setLibraryOpen(true)}
            aria-label="Open terrain library"
          >
            Open
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setExpandCanvasOpen(true)}
            aria-label="Expand canvas"
          >
            Canvas
          </button>

          <div className="flex items-center gap-1" title="Areas outside the original canvas">
            <span className="text-[0.58rem] font-semibold tracking-[0.12em] text-[#8a7a58] uppercase">
              Outside
            </span>
            <div
              role="group"
              aria-label="Areas outside the original canvas"
              className="inline-flex overflow-hidden rounded-md border border-[#c9bda3]"
            >
              {OUTSIDE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-label={mode.ariaLabel}
                  aria-pressed={outsideCanvasMode === mode.id}
                  title={mode.title}
                  className={[
                    'border-l border-[#d8cdb5] px-1.5 py-1.5 text-[0.62rem] font-semibold transition-colors first:border-l-0',
                    outsideCanvasMode === mode.id
                      ? 'bg-[#dfe7d4] text-[#3d5236]'
                      : 'bg-[#f8f2e5] text-[#6b5d42] hover:bg-[#efe5d2]',
                  ].join(' ')}
                  onClick={() => setOutsideCanvasMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

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
            aria-label="Copy current map"
            disabled={!activeMapId}
            onClick={() => {
              if (activeMapId) void duplicateMap(activeMapId);
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
          <button type="button" className={buttonClass} onClick={() => downloadTerrainFile(map)}>
            Export
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            data-testid="terrain-import-input"
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

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#d8cdb5]" />

          <button
            type="button"
            className={buttonClass}
            onClick={() => zoomByStep(1 / 1.2)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <span
            data-testid="zoom-level"
            className="w-14 rounded-md border border-[#e0d6c1] bg-[#fbf7ed] px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-[#4a4438]"
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className={buttonClass}
            onClick={() => zoomByStep(1.2)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              const bounds = visibleCanvasBounds(map, outsideCanvasMode);
              fit(bounds.width, bounds.height, bounds.originX, bounds.originY);
            }}
            title="Fit map to viewport"
          >
            Fit
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
        <TerrainLibraryDialog
          onClose={() => setLibraryOpen(false)}
          onNewMap={() => {
            setLibraryOpen(false);
            setNewMapOpen(true);
          }}
        />
      ) : null}

      {newMapOpen ? <NewTerrainMapDialog onClose={() => setNewMapOpen(false)} /> : null}
      {expandCanvasOpen ? <ExpandCanvasDialog onClose={() => setExpandCanvasOpen(false)} /> : null}
    </div>
  );
}
