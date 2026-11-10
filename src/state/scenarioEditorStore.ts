import { create } from 'zustand';
import type { UnitEchelon } from '../models';
import {
  DEFAULT_FORMATION_FONT_SIZES,
  DEFAULT_FORMATION_LABEL_FORMATS,
  type FormationFontSizes,
  type FormationLabelFormat,
  type FormationLabelFormats,
} from '../features/scenario/scenarioDocuments';

export type ScenarioMode = 'terrain' | 'units';

interface ScenarioEditorState {
  mode: ScenarioMode;
  selectedUnitId: string | null;
  selectedFeatureId: string | null;
  hiddenFactionIds: string[];
  hiddenTerrainLayerIds: string[];
  placementUnitId: string | null;
  formationFontSizes: FormationFontSizes;
  formationLabelFormats: FormationLabelFormats;
  uppercaseFormationLabels: boolean;
  dynamicFrontage: boolean;
  setMode: (mode: ScenarioMode) => void;
  selectUnit: (unitId: string | null) => void;
  selectFeature: (featureId: string | null) => void;
  beginPlacement: (unitId: string) => void;
  cancelPlacement: () => void;
  toggleFactionVisible: (factionId: string) => void;
  toggleTerrainLayerVisible: (layerId: string) => void;
  setFormationFontSize: (echelon: UnitEchelon, size: number) => void;
  setFormationLabelFormat: (echelon: UnitEchelon, format: FormationLabelFormat) => void;
  setUppercaseFormationLabels: (uppercase: boolean) => void;
  setDynamicFrontage: (dynamic: boolean) => void;
  resetFormationDisplay: () => void;
  resetForScenario: () => void;
}

export const useScenarioEditorStore = create<ScenarioEditorState>()((set) => ({
  mode: 'units',
  selectedUnitId: null,
  selectedFeatureId: null,
  hiddenFactionIds: [],
  hiddenTerrainLayerIds: [],
  placementUnitId: null,
  formationFontSizes: { ...DEFAULT_FORMATION_FONT_SIZES },
  formationLabelFormats: { ...DEFAULT_FORMATION_LABEL_FORMATS },
  uppercaseFormationLabels: false,
  dynamicFrontage: false,

  setMode: (mode) =>
    set({
      mode,
      selectedUnitId: null,
      selectedFeatureId: null,
      placementUnitId: null,
    }),

  selectUnit: (selectedUnitId) =>
    set((state) => ({
      selectedUnitId,
      selectedFeatureId: null,
      mode: selectedUnitId === null ? state.mode : 'units',
    })),

  selectFeature: (selectedFeatureId) =>
    set((state) => ({
      selectedFeatureId,
      selectedUnitId: null,
      placementUnitId: null,
      mode: selectedFeatureId === null ? state.mode : 'terrain',
    })),

  beginPlacement: (unitId) =>
    set({
      mode: 'units',
      selectedUnitId: unitId,
      selectedFeatureId: null,
      placementUnitId: unitId,
    }),

  cancelPlacement: () => set({ placementUnitId: null }),

  toggleFactionVisible: (factionId) =>
    set((state) => ({
      hiddenFactionIds: state.hiddenFactionIds.includes(factionId)
        ? state.hiddenFactionIds.filter((id) => id !== factionId)
        : [...state.hiddenFactionIds, factionId],
    })),

  toggleTerrainLayerVisible: (layerId) =>
    set((state) => ({
      hiddenTerrainLayerIds: state.hiddenTerrainLayerIds.includes(layerId)
        ? state.hiddenTerrainLayerIds.filter((id) => id !== layerId)
        : [...state.hiddenTerrainLayerIds, layerId],
    })),

  setFormationFontSize: (echelon, size) =>
    set((state) => ({
      formationFontSizes: {
        ...state.formationFontSizes,
        [echelon]: Math.min(200, Math.max(8, Math.round(size))),
      },
    })),

  setFormationLabelFormat: (echelon, format) =>
    set((state) => ({
      formationLabelFormats: {
        ...state.formationLabelFormats,
        [echelon]: format,
      },
    })),

  setUppercaseFormationLabels: (uppercaseFormationLabels) => set({ uppercaseFormationLabels }),

  setDynamicFrontage: (dynamicFrontage) => set({ dynamicFrontage }),

  resetFormationDisplay: () =>
    set({
      formationFontSizes: { ...DEFAULT_FORMATION_FONT_SIZES },
      formationLabelFormats: { ...DEFAULT_FORMATION_LABEL_FORMATS },
      uppercaseFormationLabels: false,
      dynamicFrontage: false,
    }),

  resetForScenario: () =>
    set({
      mode: 'units',
      selectedUnitId: null,
      selectedFeatureId: null,
      hiddenFactionIds: [],
      hiddenTerrainLayerIds: [],
      placementUnitId: null,
    }),
}));
