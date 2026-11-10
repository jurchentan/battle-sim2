import type { BattleScenario } from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { sectionHeadingClass } from '../army/ui';

export function ScenarioTerrainPanel({ scenario }: { scenario: BattleScenario }) {
  const hiddenLayerIds = useScenarioEditorStore((state) => state.hiddenTerrainLayerIds);
  const toggleLayerVisible = useScenarioEditorStore((state) => state.toggleTerrainLayerVisible);
  const layers = [...scenario.terrainSnapshot.layers].sort(
    (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id),
  );

  return (
    <aside
      aria-label="Terrain snapshot"
      data-testid="scenario-terrain-panel"
      className="flex w-64 shrink-0 flex-col border-r border-[#d8cdb5] bg-[#f3ecdc]"
    >
      <div className="border-b border-[#e0d6c1] px-3 py-2">
        <h3 className={sectionHeadingClass}>Terrain layers</h3>
        <p className="mt-1 text-[0.64rem] text-[#7c715c]">
          {scenario.terrainSnapshot.name} · {scenario.terrainSnapshot.features.length} features
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {layers.map((layer) => {
          const hidden = hiddenLayerIds.includes(layer.id);
          const featureCount = scenario.terrainSnapshot.features.filter(
            (feature) => feature.layerId === layer.id,
          ).length;

          return (
            <label
              key={layer.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2 py-1.5 text-xs text-[#4a4438]"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!hidden}
                  aria-label={`Show terrain layer ${layer.name}`}
                  onChange={() => toggleLayerVisible(layer.id)}
                  className="h-3.5 w-3.5 accent-[#5f7352]"
                />
                <span className="truncate font-semibold">{layer.name}</span>
              </span>
              <span className="shrink-0 text-[0.6rem] text-[#857a64]">{featureCount}</span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-[#e0d6c1] px-3 py-2 text-[0.62rem] leading-4 text-[#7c715c]">
        Scenario terrain is a read-only snapshot. Use the Terrain workspace to change the source
        map; saved scenarios keep their own copy.
      </div>
    </aside>
  );
}
