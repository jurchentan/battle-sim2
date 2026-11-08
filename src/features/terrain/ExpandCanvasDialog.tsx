import { useEffect, useState, type FormEvent } from 'react';
import { MAX_TERRAIN_DIMENSION, type TerrainCanvasMargins } from '../../models';
import { useTerrainStore } from '../../state/terrainStore';
import { isCanvasExpanded, originalCanvasBounds } from './canvasBounds';
import { computeExpandedCanvas } from './canvasExpansion';

const fieldClass =
  'w-full rounded-md border border-[#cfc3a8] bg-white px-2.5 py-1.5 text-sm text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25';
const secondaryButtonClass =
  'rounded-md border border-[#d8cdb5] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#5f594b] transition-colors hover:border-[#b8a98a] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40';
const primaryButtonClass =
  'rounded-md border border-[#7d916f] bg-[#eef1e4] px-3 py-1.5 text-xs font-semibold text-[#3d5236] transition-colors hover:border-[#5f7352] hover:bg-[#e2e8d7] disabled:cursor-not-allowed disabled:opacity-40';

const MARGIN_FIELDS = [
  { id: 'top', label: 'Top margin' },
  { id: 'right', label: 'Right margin' },
  { id: 'bottom', label: 'Bottom margin' },
  { id: 'left', label: 'Left margin' },
] as const;

type MarginDrafts = Record<keyof TerrainCanvasMargins, string>;

const EMPTY_MARGINS: MarginDrafts = { top: '0', right: '0', bottom: '0', left: '0' };

function parseMargin(value: string): number {
  return value.trim() === '' ? 0 : Number(value);
}

export function ExpandCanvasDialog({ onClose }: { onClose: () => void }) {
  const document = useTerrainStore((state) => state.document);
  const expandCanvas = useTerrainStore((state) => state.expandCanvas);
  const revertCanvas = useTerrainStore((state) => state.revertCanvas);

  const [drafts, setDrafts] = useState<MarginDrafts>(EMPTY_MARGINS);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const margins: TerrainCanvasMargins = {
    top: parseMargin(drafts.top),
    right: parseMargin(drafts.right),
    bottom: parseMargin(drafts.bottom),
    left: parseMargin(drafts.left),
  };
  const preview = computeExpandedCanvas(document, margins);
  const error = submitError ?? (preview.ok ? null : preview.error);
  const canExpand = preview.ok && preview.canvas.changed;
  const expanded = isCanvasExpanded(document);
  const original = originalCanvasBounds(document);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!preview.ok || !preview.canvas.changed) return;

    const message = expandCanvas(margins);
    if (message) {
      setSubmitError(message);
      return;
    }
    onClose();
  };

  const handleRevert = (): void => {
    if (!revertCanvas()) {
      setSubmitError('The canvas is already at its original size.');
      return;
    }
    onClose();
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
        aria-labelledby="expand-canvas-heading"
        data-testid="expand-canvas-dialog"
        className="w-full max-w-md overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            Canvas
          </p>
          <h2
            id="expand-canvas-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            Expand canvas
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            Add document space around the current borders. Existing features keep their world
            coordinates.
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-xs text-[#6b6353]">
              <p>
                Current canvas: {document.width} × {document.height} · origin {document.originX},{' '}
                {document.originY}
              </p>
              {expanded ? (
                <p
                  data-testid="original-canvas-size"
                  className="mt-1 text-[0.68rem] text-[#857a64]"
                >
                  Original canvas: {original.width} × {original.height} · origin {original.originX},{' '}
                  {original.originY}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MARGIN_FIELDS.map((field) => (
                <label
                  key={field.id}
                  className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]"
                >
                  {field.label}
                  <input
                    type="number"
                    min={0}
                    max={MAX_TERRAIN_DIMENSION}
                    step={1}
                    value={drafts[field.id]}
                    onChange={(event) => {
                      setSubmitError(null);
                      setDrafts((current) => ({ ...current, [field.id]: event.target.value }));
                    }}
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>

            <p
              data-testid="canvas-size-preview"
              className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-xs text-[#6b6353]"
            >
              {preview.ok
                ? `New canvas: ${preview.canvas.width} × ${preview.canvas.height} · origin ${preview.canvas.originX}, ${preview.canvas.originY}`
                : 'Adjust the margins to preview the new canvas.'}
            </p>

            <p className="text-[0.68rem] leading-4 text-[#857a64]">
              Maximum canvas size: {MAX_TERRAIN_DIMENSION} × {MAX_TERRAIN_DIMENSION} document units.
            </p>

            {error ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0d6c1] bg-[#f8f2e5] px-5 py-3">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={handleRevert}
              disabled={!expanded}
              data-testid="revert-canvas"
            >
              Revert to original size
            </button>
            <div className="flex items-center gap-2">
              <button type="button" className={secondaryButtonClass} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={!canExpand}>
                Expand canvas
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
