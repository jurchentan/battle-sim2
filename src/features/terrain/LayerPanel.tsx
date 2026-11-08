import type { TerrainMap } from '../../models';
import { useEditorStore } from '../../state/editorStore';
import { useTerrainStore } from '../../state/terrainStore';

const controlButtonClass =
  'rounded border border-[#d8cdb5] bg-white/60 px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#5f594b] transition-colors hover:border-[#b8a98a] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-35';

export function LayerPanel({ map }: { map: TerrainMap }) {
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setLayerVisible = useTerrainStore((state) => state.setLayerVisible);
  const setLayerLocked = useTerrainStore((state) => state.setLayerLocked);
  const moveLayer = useTerrainStore((state) => state.moveLayer);

  const sortedLayers = [...map.layers].sort(
    (a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id),
  );
  const activeLayer = map.layers.find((layer) => layer.id === activeLayerId);
  const activeBlocked = activeLayer !== undefined && (!activeLayer.visible || activeLayer.locked);

  return (
    <aside
      aria-label="Map layers"
      className="flex w-56 shrink-0 flex-col border-r border-[#d8cdb5] bg-[#fbf7ed]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#e0d6c1] px-3 py-2">
        <h3 className="text-[0.68rem] font-semibold tracking-[0.14em] text-[#857a64] uppercase">
          Layers
        </h3>
        <span data-testid="feature-count-total" className="text-[0.68rem] text-[#7c715c]">
          {map.features.length} features
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1.5">
          {sortedLayers.map((layer, index) => {
            const active = layer.id === activeLayerId;
            const featureCount = map.features.filter(
              (feature) => feature.layerId === layer.id,
            ).length;

            return (
              <li
                key={layer.id}
                className={[
                  'rounded-md border px-2 py-1.5 transition-colors',
                  active ? 'border-[#7d916f] bg-[#eef1e4]' : 'border-[#e2d8c3] bg-[#f8f2e5]',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveLayer(layer.id)}
                  className="w-full text-left"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[#3b352a]">
                      {layer.name}
                    </span>
                    <span className="text-[0.68rem] font-semibold text-[#7c715c]">
                      {featureCount}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[0.62rem] tracking-wide text-[#857a64]">
                    z{layer.zIndex} · {layer.visible ? 'visible' : 'hidden'} ·{' '}
                    {layer.locked ? 'locked' : 'editable'}
                  </span>
                </button>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={controlButtonClass}
                    aria-label={`${layer.visible ? 'Hide' : 'Show'} layer ${layer.name}`}
                    onClick={() => setLayerVisible(layer.id, !layer.visible)}
                  >
                    {layer.visible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className={controlButtonClass}
                    aria-label={`${layer.locked ? 'Unlock' : 'Lock'} layer ${layer.name}`}
                    onClick={() => setLayerLocked(layer.id, !layer.locked)}
                  >
                    {layer.locked ? 'Unlock' : 'Lock'}
                  </button>
                  <button
                    type="button"
                    className={controlButtonClass}
                    aria-label={`Move layer ${layer.name} toward front`}
                    onClick={() => moveLayer(layer.id, 'forward')}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={controlButtonClass}
                    aria-label={`Move layer ${layer.name} toward back`}
                    onClick={() => moveLayer(layer.id, 'backward')}
                    disabled={index === sortedLayers.length - 1}
                  >
                    ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="border-t border-[#e0d6c1] px-3 py-2 text-[0.62rem] leading-4 text-[#857a64]">
        {activeBlocked
          ? 'The active layer is hidden or locked. Choose another layer or restore it before drawing.'
          : 'New objects are added to the active layer. Use ↑/↓ to change layer stacking.'}
      </p>
    </aside>
  );
}
