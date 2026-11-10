import { useEffect } from 'react';
import { ScenarioCanvas } from '../../features/scenario/ScenarioCanvas';
import { ScenarioInspector } from '../../features/scenario/ScenarioInspector';
import { ScenarioOrderOfBattle } from '../../features/scenario/ScenarioOrderOfBattle';
import { ScenarioTerrainPanel } from '../../features/scenario/ScenarioTerrainPanel';
import { ScenarioToolbar } from '../../features/scenario/ScenarioToolbar';
import { useScenarioShortcuts } from '../../features/scenario/useScenarioShortcuts';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';

export function ScenarioWorkspace() {
  const scenario = useScenarioStore((state) => state.document);
  const mode = useScenarioEditorStore((state) => state.mode);
  const selectedUnitId = useScenarioEditorStore((state) => state.selectedUnitId);
  const selectedFeatureId = useScenarioEditorStore((state) => state.selectedFeatureId);
  const hiddenFactionIds = useScenarioEditorStore((state) => state.hiddenFactionIds);
  const hiddenTerrainLayerIds = useScenarioEditorStore((state) => state.hiddenTerrainLayerIds);
  const resetForScenario = useScenarioEditorStore((state) => state.resetForScenario);

  useScenarioShortcuts();

  useEffect(() => {
    resetForScenario();
  }, [resetForScenario, scenario.id]);

  useEffect(() => {
    if (!selectedUnitId) return;

    const unit = scenario.rosterSnapshot.units.find((candidate) => candidate.id === selectedUnitId);
    if (!unit || hiddenFactionIds.includes(unit.factionId)) {
      useScenarioEditorStore.getState().selectUnit(null);
    }
  }, [hiddenFactionIds, scenario.rosterSnapshot.units, selectedUnitId]);

  useEffect(() => {
    if (!selectedFeatureId) return;

    const feature = scenario.terrainSnapshot.features.find(
      (candidate) => candidate.id === selectedFeatureId,
    );
    if (!feature || hiddenTerrainLayerIds.includes(feature.layerId)) {
      useScenarioEditorStore.getState().selectFeature(null);
    }
  }, [hiddenTerrainLayerIds, scenario.terrainSnapshot.features, selectedFeatureId]);

  return (
    <section
      role="tabpanel"
      id="workspace-panel-scenario"
      aria-labelledby="workspace-tab-scenario"
      className="flex h-full min-h-0 flex-col"
    >
      <ScenarioToolbar scenario={scenario} />

      <div className="flex min-h-0 flex-1">
        {mode === 'terrain' ? (
          <ScenarioTerrainPanel scenario={scenario} />
        ) : (
          <ScenarioOrderOfBattle scenario={scenario} />
        )}

        <div className="min-w-0 flex-1">
          <ScenarioCanvas />
        </div>

        <ScenarioInspector scenario={scenario} />
      </div>
    </section>
  );
}
