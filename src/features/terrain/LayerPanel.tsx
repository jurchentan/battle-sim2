import type { TerrainMap } from '../../models';
import { useEditorStore } from '../../state/editorStore';

export function LayerPanel({ map }: { map: TerrainMap }) {
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);

  const sortedLayers = [...map.layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <aside
      aria-label="Map layers"
      className="flex w-52 shrink-0 flex-col border-r border-[#d8cdb5] bg-[#fbf7ed]"
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
        <ul className="space-y-1">
          {sortedLayers.map((layer) => {
            const active = layer.id === activeLayerId;
            const featureCount = map.features.filter(
              (feature) => feature.layerId === layer.id,
            ).length;

            return (
              <li key={layer.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveLayer(layer.id)}
                  className={[
                    'w-full rounded-md border px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'border-[#7d916f] bg-[#eef1e4]'
                      : 'border-[#e2d8c3] bg-[#f8f2e5] hover:border-[#c9bda3] hover:bg-[#f1e7d4]',
                  ].join(' ')}
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
              </li>
            );
          })}
        </ul>
      </div>

      <p className="border-t border-[#e0d6c1] px-3 py-2 text-[0.62rem] leading-4 text-[#857a64]">
        New objects are added to the active layer.
      </p>
    </aside>
  );
}
