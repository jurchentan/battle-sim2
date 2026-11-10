import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMATION_FONT_SIZES,
  DEFAULT_FORMATION_LABEL_FORMATS,
} from '../features/scenario/scenarioDocuments';
import { useScenarioEditorStore } from './scenarioEditorStore';

function resetEditor(): void {
  useScenarioEditorStore.getState().resetForScenario();
  useScenarioEditorStore.getState().resetFormationDisplay();
}

describe('scenario editor store', () => {
  beforeEach(resetEditor);

  it('switches modes and clears selections and placement', () => {
    const store = useScenarioEditorStore.getState();
    store.selectUnit('unit-a');
    store.beginPlacement('unit-b');
    store.setMode('terrain');

    expect(useScenarioEditorStore.getState()).toMatchObject({
      mode: 'terrain',
      selectedUnitId: null,
      selectedFeatureId: null,
      placementUnitId: null,
    });

    useScenarioEditorStore.getState().selectFeature('feature-a');
    expect(useScenarioEditorStore.getState()).toMatchObject({
      mode: 'terrain',
      selectedFeatureId: 'feature-a',
      selectedUnitId: null,
      placementUnitId: null,
    });

    useScenarioEditorStore.getState().selectUnit('unit-c');
    expect(useScenarioEditorStore.getState()).toMatchObject({
      mode: 'units',
      selectedUnitId: 'unit-c',
      selectedFeatureId: null,
    });
  });

  it('starts placement in units mode and cancels it', () => {
    useScenarioEditorStore.getState().selectFeature('feature-a');
    useScenarioEditorStore.getState().beginPlacement('unit-a');

    expect(useScenarioEditorStore.getState()).toMatchObject({
      mode: 'units',
      selectedUnitId: 'unit-a',
      selectedFeatureId: null,
      placementUnitId: 'unit-a',
    });

    useScenarioEditorStore.getState().cancelPlacement();
    expect(useScenarioEditorStore.getState().placementUnitId).toBeNull();
    expect(useScenarioEditorStore.getState().selectedUnitId).toBe('unit-a');
  });

  it('toggles faction and terrain-layer visibility without duplicates', () => {
    useScenarioEditorStore.getState().toggleFactionVisible('faction-a');
    useScenarioEditorStore.getState().toggleFactionVisible('faction-b');
    expect(useScenarioEditorStore.getState().hiddenFactionIds).toEqual(['faction-a', 'faction-b']);

    useScenarioEditorStore.getState().toggleFactionVisible('faction-a');
    expect(useScenarioEditorStore.getState().hiddenFactionIds).toEqual(['faction-b']);

    useScenarioEditorStore.getState().toggleTerrainLayerVisible('layer-a');
    expect(useScenarioEditorStore.getState().hiddenTerrainLayerIds).toEqual(['layer-a']);
    useScenarioEditorStore.getState().toggleTerrainLayerVisible('layer-a');
    expect(useScenarioEditorStore.getState().hiddenTerrainLayerIds).toEqual([]);
  });

  it('resets every transient editor value for a new scenario', () => {
    const store = useScenarioEditorStore.getState();
    store.setMode('terrain');
    store.toggleFactionVisible('faction-a');
    store.toggleTerrainLayerVisible('layer-a');
    store.selectFeature('feature-a');
    store.beginPlacement('unit-a');

    useScenarioEditorStore.getState().resetForScenario();

    expect(useScenarioEditorStore.getState()).toMatchObject({
      mode: 'units',
      selectedUnitId: null,
      selectedFeatureId: null,
      hiddenFactionIds: [],
      hiddenTerrainLayerIds: [],
      placementUnitId: null,
    });
  });

  it('customizes formation font sizes, name styles, and uppercase labels', () => {
    const store = useScenarioEditorStore.getState();
    expect(store.formationFontSizes).toEqual(DEFAULT_FORMATION_FONT_SIZES);
    expect(store.formationLabelFormats).toEqual(DEFAULT_FORMATION_LABEL_FORMATS);
    expect(store.uppercaseFormationLabels).toBe(false);
    expect(store.dynamicFrontage).toBe(false);

    store.setFormationFontSize('army', 92.4);
    store.setFormationFontSize('brigade', 4);
    store.setFormationFontSize('corps', 300);
    store.setFormationLabelFormat('army', 'commander');
    store.setFormationLabelFormat('brigade', 'none');
    store.setUppercaseFormationLabels(true);
    store.setDynamicFrontage(true);

    expect(useScenarioEditorStore.getState().formationFontSizes).toMatchObject({
      army: 92,
      brigade: 8,
      corps: 200,
    });
    expect(useScenarioEditorStore.getState().formationLabelFormats).toMatchObject({
      army: 'commander',
      brigade: 'none',
      division: 'full',
    });
    expect(useScenarioEditorStore.getState().uppercaseFormationLabels).toBe(true);
    expect(useScenarioEditorStore.getState().dynamicFrontage).toBe(true);

    useScenarioEditorStore.getState().resetFormationDisplay();
    expect(useScenarioEditorStore.getState().formationFontSizes).toEqual(
      DEFAULT_FORMATION_FONT_SIZES,
    );
    expect(useScenarioEditorStore.getState().formationLabelFormats).toEqual(
      DEFAULT_FORMATION_LABEL_FORMATS,
    );
    expect(useScenarioEditorStore.getState().uppercaseFormationLabels).toBe(false);
    expect(useScenarioEditorStore.getState().dynamicFrontage).toBe(false);
  });
});
