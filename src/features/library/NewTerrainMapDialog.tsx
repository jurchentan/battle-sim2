import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MAX_TERRAIN_DIMENSION, MIN_TERRAIN_DIMENSION, type TerrainCanvasSize } from '../../models';
import { useLibraryStore } from '../../state/libraryStore';

const SIZE_PRESETS = [
  { id: 'standard', label: 'Standard', width: 2000, height: 1400 },
  { id: 'square', label: 'Square', width: 2000, height: 2000 },
  { id: 'wide', label: 'Wide', width: 3000, height: 1400 },
  { id: 'large', label: 'Large', width: 3000, height: 2100 },
] as const;

type SizePresetId = (typeof SIZE_PRESETS)[number]['id'] | 'custom';

const fieldClass =
  'w-full rounded-md border border-[#cfc3a8] bg-white px-2.5 py-1.5 text-sm text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25';
const secondaryButtonClass =
  'rounded-md border border-[#d8cdb5] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#5f594b] transition-colors hover:border-[#b8a98a] hover:bg-[#efe5d2]';
const primaryButtonClass =
  'rounded-md border border-[#7d916f] bg-[#eef1e4] px-3 py-1.5 text-xs font-semibold text-[#3d5236] transition-colors hover:border-[#5f7352] hover:bg-[#e2e8d7] disabled:cursor-not-allowed disabled:opacity-40';

function parseDimension(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidDimension(value: number | null): value is number {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= MIN_TERRAIN_DIMENSION &&
    value <= MAX_TERRAIN_DIMENSION
  );
}

function dimensionError(value: number | null): string | null {
  if (value === null) return 'Enter a width and height.';
  if (!Number.isInteger(value)) return 'Use whole numbers for the map size.';
  if (value < MIN_TERRAIN_DIMENSION || value > MAX_TERRAIN_DIMENSION) {
    return `Use a size between ${MIN_TERRAIN_DIMENSION} and ${MAX_TERRAIN_DIMENSION} document units.`;
  }
  return null;
}

export function NewTerrainMapDialog({ onClose }: { onClose: () => void }) {
  const newMap = useLibraryStore((state) => state.newMap);
  const libraryError = useLibraryStore((state) => state.error);
  const clearError = useLibraryStore((state) => state.clearError);

  const [name, setName] = useState('Untitled terrain');
  const [presetId, setPresetId] = useState<SizePresetId>('standard');
  const [widthDraft, setWidthDraft] = useState('2000');
  const [heightDraft, setHeightDraft] = useState('1400');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const selectedPreset = SIZE_PRESETS.find((preset) => preset.id === presetId);
  const isCustom = presetId === 'custom';
  const width = isCustom ? parseDimension(widthDraft) : (selectedPreset?.width ?? null);
  const height = isCustom ? parseDimension(heightDraft) : (selectedPreset?.height ?? null);
  const size: TerrainCanvasSize | null =
    isValidDimension(width) && isValidDimension(height) ? { width, height } : null;

  const validationError = useMemo(() => {
    if (!name.trim()) return 'Enter a map name.';
    if (width === null || height === null) return 'Enter a width and height.';
    return dimensionError(width) ?? dimensionError(height);
  }, [height, name, width]);

  const handlePresetChange = (nextId: SizePresetId): void => {
    setPresetId(nextId);
    const preset = SIZE_PRESETS.find((candidate) => candidate.id === nextId);
    if (preset) {
      setWidthDraft(String(preset.width));
      setHeightDraft(String(preset.height));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!size || validationError || submitting) return;

    setSubmitting(true);
    try {
      await newMap({ name: name.trim(), width: size.width, height: size.height });
      if (!useLibraryStore.getState().error) onClose();
    } finally {
      setSubmitting(false);
    }
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
        aria-labelledby="new-terrain-map-heading"
        data-testid="new-terrain-map-dialog"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            New terrain map
          </p>
          <h2
            id="new-terrain-map-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            Start a blank canvas
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            Choose a name and starting size. You can expand the canvas later without moving existing
            features.
          </p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Map name
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Map size
              <select
                value={presetId}
                onChange={(event) => handlePresetChange(event.target.value as SizePresetId)}
                className={fieldClass}
              >
                {SIZE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} — {preset.width} × {preset.height}
                  </option>
                ))}
                <option value="custom">Custom size…</option>
              </select>
            </label>

            {isCustom ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
                  Map width
                  <input
                    type="number"
                    min={MIN_TERRAIN_DIMENSION}
                    max={MAX_TERRAIN_DIMENSION}
                    step={1}
                    value={widthDraft}
                    onChange={(event) => setWidthDraft(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
                  Map height
                  <input
                    type="number"
                    min={MIN_TERRAIN_DIMENSION}
                    max={MAX_TERRAIN_DIMENSION}
                    step={1}
                    value={heightDraft}
                    onChange={(event) => setHeightDraft(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
            ) : null}

            <p
              data-testid="new-map-size-preview"
              className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-xs text-[#6b6353]"
            >
              {size
                ? `${size.width} × ${size.height} document units`
                : 'Enter valid dimensions to preview the canvas.'}
            </p>

            {/* TODO: Add faction, campaign/war folder, and scenario link selectors here. */}
            <section
              data-testid="new-map-planned-options"
              aria-label="Planned map options"
              className="rounded-lg border border-dashed border-[#d8cdb5] bg-[#f8f2e5]/70 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                  Coming later
                </h3>
                <span className="rounded-full border border-[#d8cdb5] bg-white/60 px-2 py-0.5 text-[0.58rem] font-semibold tracking-wide text-[#857a64] uppercase">
                  Planned
                </span>
              </div>
              <p className="mt-1 text-[0.68rem] leading-4 text-[#7c715c]">
                Space is reserved for the faction selector and the campaign / war folder selector.
                They are intentionally not interactive yet.
              </p>
            </section>

            {validationError ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {validationError}
              </p>
            ) : null}

            {libraryError ? (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-3 py-2 text-xs text-[#8b3a2f]"
              >
                <span>{libraryError}</span>
                <button
                  type="button"
                  className="shrink-0 font-semibold underline"
                  onClick={clearError}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-[#e0d6c1] bg-[#f8f2e5] px-5 py-3">
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={Boolean(validationError) || !size || submitting}
            >
              {submitting ? 'Creating…' : 'Create map'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
