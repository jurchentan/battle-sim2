import type { TerrainMap } from '../../models';
import { useCameraStore } from '../../canvas/cameraStore';
import { useTerrainStore } from '../../state/terrainStore';

const buttonClass =
  'rounded-md border border-[#c9bda3] bg-[#f8f2e5] px-2.5 py-1.5 text-xs font-semibold text-[#4a4438] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40';

export function EditorToolbar({ map }: { map: TerrainMap }) {
  const canUndo = useTerrainStore((state) => state.past.length > 0);
  const canRedo = useTerrainStore((state) => state.future.length > 0);
  const undo = useTerrainStore((state) => state.undo);
  const redo = useTerrainStore((state) => state.redo);

  const scale = useCameraStore((state) => state.camera.scale);
  const zoomByStep = useCameraStore((state) => state.zoomByStep);
  const fit = useCameraStore((state) => state.fit);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8cdb5] bg-[#f6efe0] px-4 py-2">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-[#2f2b23]">
          Terrain Editor
        </h2>
        <p className="truncate text-xs text-[#7c715c]">
          <span className="font-semibold text-[#4a4438]">{map.name}</span>
          <span>
            {' '}
            · {map.width} × {map.height} · {map.features.length} features
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
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
          onClick={() => fit(map.width, map.height)}
          title="Fit map to viewport"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
