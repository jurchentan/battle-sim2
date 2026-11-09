import {
  SCHEMA_VERSION,
  defaultFactionNamingModes,
  defaultFactionStrengths,
  type ArmyRoster,
  type BattleAnnotation,
  type BattlePhase,
  type BattleScenario,
  type Faction,
  type FactionNamingModes,
  type SymbolStyle,
  type TerrainFeature,
  type TerrainLayer,
  type TerrainMap,
  type UnitDefinition,
  type UnitPhaseState,
} from './schemas';

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

const NORTH_COLOR = '#2f5d8a';
const NORTH_LABEL_COLOR = '#eaf2fa';
const SOUTH_COLOR = '#9b3b34';
const SOUTH_LABEL_COLOR = '#fbeeea';

function brigadeStyle(color: string, overrides: Partial<SymbolStyle> = {}): SymbolStyle {
  return {
    color,
    thickness: 7,
    dash: [],
    labelPosition: 'above',
    ...overrides,
  };
}

const terrainLayers: TerrainLayer[] = [
  { id: 'layer-areas', name: 'Areas', visible: true, locked: false, zIndex: 0 },
  { id: 'layer-paths', name: 'Paths and water', visible: true, locked: false, zIndex: 10 },
  { id: 'layer-details', name: 'Detail and labels', visible: true, locked: false, zIndex: 20 },
];

const terrainFeatures: TerrainFeature[] = [
  {
    id: 'feature-north-wood',
    layerId: 'layer-areas',
    kind: 'forest',
    name: 'North Wood',
    zIndex: 10,
    geometry: {
      type: 'polygon',
      points: [
        { x: 180, y: 180 },
        { x: 520, y: 130 },
        { x: 690, y: 280 },
        { x: 610, y: 470 },
        { x: 330, y: 500 },
        { x: 160, y: 360 },
      ],
    },
    style: {
      type: 'area',
      fillColor: '#7d8f6a',
      strokeColor: '#5e6f4d',
      strokeWidth: 2,
      opacity: 0.55,
      pattern: 'hatch-left',
    },
  },
  {
    id: 'feature-west-fields',
    layerId: 'layer-areas',
    kind: 'field',
    name: 'West Fields',
    zIndex: 5,
    geometry: {
      type: 'polygon',
      points: [
        { x: 210, y: 680 },
        { x: 540, y: 640 },
        { x: 620, y: 880 },
        { x: 470, y: 1080 },
        { x: 220, y: 980 },
      ],
    },
    style: {
      type: 'area',
      fillColor: '#d9c89a',
      strokeColor: '#b9a877',
      strokeWidth: 1.5,
      opacity: 0.5,
      pattern: 'solid',
    },
  },
  {
    id: 'feature-mill-lake',
    layerId: 'layer-areas',
    kind: 'lake',
    name: 'Mill Lake',
    zIndex: 6,
    geometry: {
      type: 'polygon',
      points: [
        { x: 1400, y: 300 },
        { x: 1640, y: 260 },
        { x: 1740, y: 420 },
        { x: 1600, y: 540 },
        { x: 1380, y: 470 },
      ],
    },
    style: {
      type: 'area',
      fillColor: '#a9c3cb',
      strokeColor: '#7e9aa1',
      strokeWidth: 2,
      opacity: 0.7,
      pattern: 'solid',
    },
  },
  {
    id: 'feature-river-ash',
    layerId: 'layer-paths',
    kind: 'river',
    name: 'River Ash',
    zIndex: 20,
    geometry: {
      type: 'polyline',
      points: [
        { x: 1320, y: 60 },
        { x: 1240, y: 300 },
        { x: 1130, y: 520 },
        { x: 990, y: 660 },
        { x: 960, y: 880 },
        { x: 860, y: 1100 },
        { x: 820, y: 1360 },
      ],
    },
    style: {
      type: 'path',
      strokeColor: '#7e9aa1',
      strokeWidth: 6,
      opacity: 0.85,
      dash: [],
      lineCap: 'round',
    },
  },
  {
    id: 'feature-road-north',
    layerId: 'layer-paths',
    kind: 'road',
    name: 'North Road',
    zIndex: 21,
    geometry: {
      type: 'polyline',
      points: [
        { x: 80, y: 620 },
        { x: 420, y: 610 },
        { x: 760, y: 660 },
        { x: 980, y: 760 },
        { x: 1280, y: 900 },
        { x: 1680, y: 960 },
      ],
    },
    style: {
      type: 'path',
      strokeColor: '#b3a17c',
      strokeWidth: 4,
      opacity: 0.9,
      dash: [],
      lineCap: 'round',
    },
  },
  {
    id: 'feature-contour-hill',
    layerId: 'layer-paths',
    kind: 'contour',
    name: 'Mill Hill contours',
    zIndex: 15,
    geometry: {
      type: 'polyline',
      points: [
        { x: 1450, y: 700 },
        { x: 1560, y: 640 },
        { x: 1700, y: 700 },
        { x: 1740, y: 820 },
        { x: 1640, y: 900 },
        { x: 1490, y: 850 },
      ],
    },
    style: {
      type: 'path',
      strokeColor: '#8c8474',
      strokeWidth: 1.2,
      opacity: 0.7,
      dash: [6, 4],
      lineCap: 'round',
    },
  },
  {
    id: 'feature-bridge-mill',
    layerId: 'layer-details',
    kind: 'bridge',
    name: 'Mill Bridge',
    zIndex: 30,
    geometry: {
      type: 'point',
      position: { x: 960, y: 755 },
    },
    style: {
      type: 'marker',
      fillColor: '#8b7355',
      strokeColor: '#4f4230',
      strokeWidth: 1.5,
    },
  },
  {
    id: 'feature-village-mill',
    layerId: 'layer-details',
    kind: 'building',
    name: 'Ashford village',
    zIndex: 31,
    geometry: {
      type: 'point',
      position: { x: 1080, y: 940 },
    },
    style: {
      type: 'marker',
      fillColor: '#c9b79a',
      strokeColor: '#5c4a35',
      strokeWidth: 1.5,
    },
  },
  {
    id: 'feature-label-ashford',
    layerId: 'layer-details',
    kind: 'label',
    name: 'Ashford Ford',
    zIndex: 40,
    geometry: {
      type: 'textAnchor',
      position: { x: 1130, y: 1000 },
      rotationDegrees: -4,
    },
    style: {
      type: 'text',
      textColor: '#3c3428',
      fontSize: 28,
      fontFamily: 'Georgia, serif',
    },
  },
];

export function createSeedTerrainMap(): TerrainMap {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'terrain-ashford-demo',
    name: 'Ashford Ford',
    description: 'Fictional river crossing used by the demo scenario.',
    width: 2000,
    height: 1400,
    originX: 0,
    originY: 0,
    originalCanvas: { width: 2000, height: 1400, originX: 0, originY: 0 },
    backgroundStyle: 'aged-paper',
    layers: structuredClone(terrainLayers),
    features: structuredClone(terrainFeatures),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

const commanderNamingModes: FactionNamingModes = {
  army: 'commander',
  corps: 'commander',
  division: 'commander',
  brigade: 'commander',
  regiment: 'commander',
  other: 'commander',
};

const factions: Faction[] = [
  {
    id: 'faction-north',
    name: 'Northern League',
    color: NORTH_COLOR,
    labelColor: NORTH_LABEL_COLOR,
    namingModes: defaultFactionNamingModes(),
    defaultStrengths: defaultFactionStrengths(),
  },
  {
    id: 'faction-south',
    name: 'Southern Crown',
    color: SOUTH_COLOR,
    labelColor: SOUTH_LABEL_COLOR,
    namingModes: commanderNamingModes,
    defaultStrengths: defaultFactionStrengths(),
  },
];

const units: UnitDefinition[] = [
  {
    id: 'unit-north-army',
    factionId: 'faction-north',
    customName: 'Army of the North',
    echelon: 'army',
    unitType: 'other',
    parentUnitId: null,
    commander: 'Adele Voss',
    initialStrength: 12000,
    defaultSymbolStyle: brigadeStyle(NORTH_COLOR, { thickness: 10, labelPosition: 'center' }),
    notes: 'Holds the north bank.',
  },
  {
    id: 'unit-north-corps',
    factionId: 'faction-north',
    customName: 'I Corps',
    echelon: 'corps',
    unitType: 'other',
    parentUnitId: 'unit-north-army',
    commander: 'Bram Holt',
    initialStrength: 9000,
    defaultSymbolStyle: brigadeStyle(NORTH_COLOR, { thickness: 9 }),
  },
  {
    id: 'unit-north-division',
    factionId: 'faction-north',
    customName: 'Voss Division',
    echelon: 'division',
    unitType: 'other',
    parentUnitId: 'unit-north-corps',
    commander: 'Ines Kerr',
    initialStrength: 6000,
    defaultSymbolStyle: brigadeStyle(NORTH_COLOR, { thickness: 8 }),
  },
  {
    id: 'unit-north-brigade-1',
    factionId: 'faction-north',
    echelon: 'brigade',
    unitType: 'infantry',
    parentUnitId: 'unit-north-division',
    commander: 'Sara Hale',
    initialStrength: 1800,
    defaultSymbolStyle: brigadeStyle(NORTH_COLOR),
  },
  {
    id: 'unit-north-brigade-2',
    factionId: 'faction-north',
    echelon: 'brigade',
    unitType: 'cavalry',
    parentUnitId: 'unit-north-division',
    commander: 'Owen Mercer',
    initialStrength: 1700,
    defaultSymbolStyle: brigadeStyle(NORTH_COLOR, { dash: [14, 5] }),
  },
  {
    id: 'unit-north-brigade-3',
    factionId: 'faction-north',
    echelon: 'brigade',
    unitType: 'artillery',
    parentUnitId: 'unit-north-division',
    commander: 'Piet Dunne',
    initialStrength: 1500,
    defaultSymbolStyle: brigadeStyle(NORTH_COLOR, { thickness: 5, dash: [4, 4] }),
  },
  {
    id: 'unit-south-army',
    factionId: 'faction-south',
    customName: 'Crown Army of the Ford',
    echelon: 'army',
    unitType: 'other',
    parentUnitId: null,
    commander: 'Tomas Riel',
    initialStrength: 13500,
    defaultSymbolStyle: brigadeStyle(SOUTH_COLOR, { thickness: 10, labelPosition: 'center' }),
    notes: 'Attacks across the ford at dawn.',
  },
  {
    id: 'unit-south-corps',
    factionId: 'faction-south',
    customName: 'II Corps',
    echelon: 'corps',
    unitType: 'other',
    parentUnitId: 'unit-south-army',
    commander: 'Lucia Marr',
    initialStrength: 9500,
    defaultSymbolStyle: brigadeStyle(SOUTH_COLOR, { thickness: 9 }),
  },
  {
    id: 'unit-south-division',
    factionId: 'faction-south',
    echelon: 'division',
    unitType: 'other',
    parentUnitId: 'unit-south-corps',
    commander: 'Riel',
    initialStrength: 6500,
    defaultSymbolStyle: brigadeStyle(SOUTH_COLOR, { thickness: 8 }),
  },
  {
    id: 'unit-south-brigade-1',
    factionId: 'faction-south',
    echelon: 'brigade',
    unitType: 'infantry',
    parentUnitId: 'unit-south-division',
    commander: 'Johnston',
    initialStrength: 1900,
    defaultSymbolStyle: brigadeStyle(SOUTH_COLOR),
  },
  {
    id: 'unit-south-brigade-2',
    factionId: 'faction-south',
    echelon: 'brigade',
    unitType: 'infantry',
    parentUnitId: 'unit-south-division',
    commander: 'Sarr',
    initialStrength: 1600,
    defaultSymbolStyle: brigadeStyle(SOUTH_COLOR),
  },
  {
    id: 'unit-south-brigade-3',
    factionId: 'faction-south',
    echelon: 'brigade',
    unitType: 'cavalry',
    parentUnitId: 'unit-south-division',
    commander: 'Marr',
    initialStrength: 1400,
    defaultSymbolStyle: brigadeStyle(SOUTH_COLOR, { dash: [14, 5] }),
  },
];

export function createSeedRoster(): ArmyRoster {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'roster-ashford-demo',
    name: 'Ashford Campaign Rosters',
    smallestUnitEchelon: 'brigade',
    factions: structuredClone(factions),
    units: structuredClone(units),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

const initialUnitStates: Record<string, UnitPhaseState> = {
  'unit-north-brigade-1': {
    x: 700,
    y: 520,
    rotationDegrees: 0,
    frontageLength: 120,
    visible: true,
    effectiveStrength: 1800,
    status: 'holding',
  },
  'unit-north-brigade-2': {
    x: 880,
    y: 560,
    rotationDegrees: -8,
    frontageLength: 100,
    visible: true,
    effectiveStrength: 1700,
    status: 'reserve',
  },
  'unit-north-brigade-3': {
    x: 760,
    y: 640,
    rotationDegrees: 5,
    frontageLength: 80,
    visible: true,
    effectiveStrength: 1500,
    status: 'engaged',
  },
  'unit-south-brigade-1': {
    x: 1050,
    y: 820,
    rotationDegrees: 180,
    frontageLength: 120,
    visible: true,
    effectiveStrength: 1900,
    status: 'moving',
  },
  'unit-south-brigade-2': {
    x: 1250,
    y: 780,
    rotationDegrees: 170,
    frontageLength: 110,
    visible: true,
    effectiveStrength: 1600,
    status: 'holding',
  },
  'unit-south-brigade-3': {
    x: 1120,
    y: 900,
    rotationDegrees: 185,
    frontageLength: 90,
    visible: true,
    effectiveStrength: 1400,
    status: 'reserve',
  },
};

function cloneUnitStates(states: Record<string, UnitPhaseState>): Record<string, UnitPhaseState> {
  return Object.fromEntries(
    Object.entries(states).map(([unitId, state]) => [unitId, structuredClone(state)] as const),
  );
}

function applyStateChanges(
  states: Record<string, UnitPhaseState>,
  changes: Record<string, Partial<UnitPhaseState>>,
): void {
  for (const [unitId, update] of Object.entries(changes)) {
    const current = states[unitId];
    if (!current) {
      throw new Error(`Cannot update phase state for unknown unit "${unitId}"`);
    }
    states[unitId] = { ...current, ...update };
  }
}

const initialAnnotations: BattleAnnotation[] = [
  {
    id: 'annotation-south-attack',
    kind: 'attackArrow',
    label: 'Crown attack at dawn',
    linkedUnitId: 'unit-south-brigade-1',
    geometry: {
      type: 'polyline',
      points: [
        { x: 1150, y: 780 },
        { x: 1030, y: 720 },
        { x: 930, y: 650 },
      ],
    },
    style: {
      strokeColor: SOUTH_COLOR,
      strokeWidth: 4,
      opacity: 0.9,
      dash: [],
      arrowhead: 'end',
    },
  },
  {
    id: 'annotation-north-line',
    kind: 'defenseLine',
    label: 'Northern holding line',
    geometry: {
      type: 'polyline',
      points: [
        { x: 640, y: 600 },
        { x: 780, y: 620 },
        { x: 900, y: 600 },
      ],
    },
    style: {
      strokeColor: NORTH_COLOR,
      strokeWidth: 3,
      opacity: 0.85,
      dash: [10, 6],
      arrowhead: 'none',
    },
  },
];

const initialPhase: BattlePhase = {
  id: 'phase-initial',
  name: 'Initial deployment',
  order: 0,
  timeLabel: '06:00',
  notes: 'Both armies face each other across the River Ash.',
  unitStates: cloneUnitStates(initialUnitStates),
  annotations: structuredClone(initialAnnotations),
};

const attackUnitStates = cloneUnitStates(initialUnitStates);
applyStateChanges(attackUnitStates, {
  'unit-north-brigade-1': {
    x: 690,
    y: 560,
    effectiveStrength: 1400,
    status: 'engaged',
  },
  'unit-north-brigade-2': {
    x: 900,
    y: 600,
    rotationDegrees: -2,
    status: 'moving',
  },
  'unit-north-brigade-3': {
    x: 700,
    y: 700,
    effectiveStrength: 1200,
    status: 'retreating',
  },
  'unit-south-brigade-1': {
    x: 980,
    y: 760,
    effectiveStrength: 1750,
    status: 'engaged',
  },
  'unit-south-brigade-2': {
    x: 1180,
    y: 760,
    rotationDegrees: 176,
    status: 'moving',
  },
  'unit-south-brigade-3': {
    x: 1050,
    y: 880,
    status: 'holding',
  },
});

const attackAnnotations: BattleAnnotation[] = structuredClone(initialAnnotations);
attackAnnotations.push(
  {
    id: 'annotation-south-breakthrough',
    kind: 'attackArrow',
    label: 'Breakthrough at the ford',
    linkedUnitId: 'unit-south-brigade-2',
    geometry: {
      type: 'polyline',
      points: [
        { x: 1180, y: 760 },
        { x: 1060, y: 720 },
        { x: 980, y: 700 },
      ],
    },
    style: {
      strokeColor: SOUTH_COLOR,
      strokeWidth: 5,
      opacity: 0.95,
      dash: [],
      arrowhead: 'end',
    },
  },
  {
    id: 'annotation-north-counter',
    kind: 'movementArrow',
    label: 'Northern counter-move',
    linkedUnitId: 'unit-north-brigade-2',
    geometry: {
      type: 'polyline',
      points: [
        { x: 900, y: 600 },
        { x: 940, y: 660 },
        { x: 910, y: 730 },
      ],
    },
    style: {
      strokeColor: NORTH_COLOR,
      strokeWidth: 4,
      opacity: 0.9,
      dash: [8, 4],
      arrowhead: 'end',
    },
  },
);

const attackPhase: BattlePhase = {
  id: 'phase-attack',
  name: 'Crown attack',
  order: 1,
  timeLabel: '08:30',
  notes: 'The Crown pushes across the ford while the Northern line bends.',
  unitStates: attackUnitStates,
  annotations: attackAnnotations,
};

export function createSeedBattleScenario(): BattleScenario {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'scenario-ashford-demo',
    name: 'Action at Ashford Ford',
    description: 'Two-phase demonstration battle built on the Ashford terrain and rosters.',
    terrainSnapshot: createSeedTerrainMap(),
    rosterSnapshot: createSeedRoster(),
    phases: [structuredClone(initialPhase), structuredClone(attackPhase)],
    activePhaseId: 'phase-initial',
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export interface SeedDocuments {
  terrain: TerrainMap;
  roster: ArmyRoster;
  scenario: BattleScenario;
}

export function createSeedDocuments(): SeedDocuments {
  return {
    terrain: createSeedTerrainMap(),
    roster: createSeedRoster(),
    scenario: createSeedBattleScenario(),
  };
}

export const seedDocuments: SeedDocuments = createSeedDocuments();
