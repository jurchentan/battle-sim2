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
  const selectedUnitIds = useScenarioEditorStore((state) => state.selectedUnitIds);
  const selectedFeatureId = useScenarioEditorStore((state) => state.selectedFeatureId);
  const hiddenFactionIds = useScenarioEditorStore((state) => state.hiddenFactionIds);
  const hiddenTerrainLayerIds = useScenarioEditorStore((state) => state.hiddenTerrainLayerIds);
  const resetForScenario = useScenarioEditorStore((state) => state.resetForScenario);

  useScenarioShortcuts();

  useEffect(() => {
    resetForScenario();
  }, [resetForScenario, scenario.id]);

  useEffect(() => {
    if (selectedUnitIds.length === 0) return;

    const selectableUnitIds = selectedUnitIds.filter((unitId) => {
      const unit = scenario.rosterSnapshot.units.find((candidate) => candidate.id === unitId);
      return unit && !hiddenFactionIds.includes(unit.factionId);
    });
    if (selectableUnitIds.length !== selectedUnitIds.length) {
      useScenarioEditorStore.getState().selectUnits(selectableUnitIds);
    }
  }, [hiddenFactionIds, scenario.rosterSnapshot.units, selectedUnitIds]);

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
