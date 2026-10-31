import { z } from 'zod';

export const SCHEMA_VERSION = 1;

const idSchema = z.string().trim().min(1, 'Id is required');
const nameSchema = z.string().trim().min(1, 'Name is required');
const colorSchema = z.string().trim().min(1, 'Color is required');
const isoDateSchema = z.iso.datetime();
const finiteNumberSchema = z.number().finite();

export const pointSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
});
export type Point = z.infer<typeof pointSchema>;

export const polygonGeometrySchema = z.object({
  type: z.literal('polygon'),
  points: z.array(pointSchema).min(3, 'A polygon needs at least three points'),
});

export const polylineGeometrySchema = z.object({
  type: z.literal('polyline'),
  points: z.array(pointSchema).min(2, 'A polyline needs at least two points'),
});

export const pointGeometrySchema = z.object({
  type: z.literal('point'),
  position: pointSchema,
});

export const textGeometrySchema = z.object({
  type: z.literal('textAnchor'),
  position: pointSchema,
  rotationDegrees: finiteNumberSchema,
});

export const terrainGeometrySchema = z.discriminatedUnion('type', [
  polygonGeometrySchema,
  polylineGeometrySchema,
  pointGeometrySchema,
  textGeometrySchema,
]);
export type TerrainGeometry = z.infer<typeof terrainGeometrySchema>;

export const areaStyleSchema = z.object({
  type: z.literal('area'),
  fillColor: colorSchema,
  strokeColor: colorSchema,
  strokeWidth: z.number().nonnegative(),
  opacity: z.number().min(0).max(1),
  pattern: z.enum(['solid', 'hatch-left', 'hatch-right', 'dots']),
});

export const pathStyleSchema = z.object({
  type: z.literal('path'),
  strokeColor: colorSchema,
  strokeWidth: z.number().positive(),
  opacity: z.number().min(0).max(1),
  dash: z.array(z.number().nonnegative()),
  lineCap: z.enum(['butt', 'round', 'square']),
});

export const markerStyleSchema = z.object({
  type: z.literal('marker'),
  fillColor: colorSchema,
  strokeColor: colorSchema,
  strokeWidth: z.number().nonnegative(),
});

export const textStyleSchema = z.object({
  type: z.literal('text'),
  textColor: colorSchema,
  fontSize: z.number().positive(),
  fontFamily: z.string().trim().min(1),
});

export const terrainStyleSchema = z.discriminatedUnion('type', [
  areaStyleSchema,
  pathStyleSchema,
  markerStyleSchema,
  textStyleSchema,
]);
export type TerrainStyle = z.infer<typeof terrainStyleSchema>;

export const terrainFeatureKindSchema = z.enum([
  'forest',
  'field',
  'river',
  'road',
  'contour',
  'lake',
  'swamp',
  'building',
  'bridge',
  'fortification',
  'label',
  'customPath',
]);
export type TerrainFeatureKind = z.infer<typeof terrainFeatureKindSchema>;

const FEATURE_GEOMETRY_BY_KIND: Record<TerrainFeatureKind, TerrainGeometry['type']> = {
  forest: 'polygon',
  field: 'polygon',
  lake: 'polygon',
  swamp: 'polygon',
  river: 'polyline',
  road: 'polyline',
  contour: 'polyline',
  customPath: 'polyline',
  building: 'point',
  bridge: 'point',
  fortification: 'point',
  label: 'textAnchor',
};

const FEATURE_STYLE_BY_KIND: Record<TerrainFeatureKind, TerrainStyle['type']> = {
  forest: 'area',
  field: 'area',
  lake: 'area',
  swamp: 'area',
  river: 'path',
  road: 'path',
  contour: 'path',
  customPath: 'path',
  building: 'marker',
  bridge: 'marker',
  fortification: 'marker',
  label: 'text',
};

export const terrainFeatureSchema = z
  .object({
    id: idSchema,
    layerId: idSchema,
    kind: terrainFeatureKindSchema,
    geometry: terrainGeometrySchema,
    style: terrainStyleSchema,
    name: nameSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    zIndex: z.number().int(),
  })
  .superRefine((feature, ctx) => {
    const expectedGeometry = FEATURE_GEOMETRY_BY_KIND[feature.kind];
    if (feature.geometry.type !== expectedGeometry) {
      ctx.addIssue({
        code: 'custom',
        message: `${feature.kind} features require ${expectedGeometry} geometry`,
        path: ['geometry', 'type'],
      });
    }

    const expectedStyle = FEATURE_STYLE_BY_KIND[feature.kind];
    if (feature.style.type !== expectedStyle) {
      ctx.addIssue({
        code: 'custom',
        message: `${feature.kind} features require a ${expectedStyle} style`,
        path: ['style', 'type'],
      });
    }

    if (feature.kind === 'label' && !feature.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'Label features require a name to render',
        path: ['name'],
      });
    }
  });
export type TerrainFeature = z.infer<typeof terrainFeatureSchema>;

export const terrainLayerSchema = z.object({
  id: idSchema,
  name: nameSchema,
  visible: z.boolean(),
  locked: z.boolean(),
  zIndex: z.number().int(),
});
export type TerrainLayer = z.infer<typeof terrainLayerSchema>;

function addDuplicateIdIssues(
  items: readonly { id: string }[],
  ctx: z.RefinementCtx,
  path: (string | number)[],
  label: string,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate ${label} id "${item.id}"`,
        path: [...path, index, 'id'],
      });
    }
    seen.add(item.id);
  });
}

const backgroundStyleSchema = z.enum(['plain', 'aged-paper', 'parchment']);

export const terrainMapSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: idSchema,
    name: nameSchema,
    description: z.string().optional(),
    width: z.number().positive(),
    height: z.number().positive(),
    backgroundStyle: backgroundStyleSchema,
    layers: z.array(terrainLayerSchema),
    features: z.array(terrainFeatureSchema),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .superRefine((map, ctx) => {
    addDuplicateIdIssues(map.layers, ctx, ['layers'], 'terrain layer');
    addDuplicateIdIssues(map.features, ctx, ['features'], 'terrain feature');

    const layerIds = new Set(map.layers.map((layer) => layer.id));
    map.features.forEach((feature, index) => {
      if (!layerIds.has(feature.layerId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Feature "${feature.id}" references unknown layer "${feature.layerId}"`,
          path: ['features', index, 'layerId'],
        });
      }
    });
  });
export type TerrainMap = z.infer<typeof terrainMapSchema>;

export const factionSchema = z.object({
  id: idSchema,
  name: nameSchema,
  color: colorSchema,
  labelColor: colorSchema.optional(),
  notes: z.string().optional(),
});
export type Faction = z.infer<typeof factionSchema>;

export const commanderSchema = z.object({
  id: idSchema,
  name: nameSchema,
  rank: z.string().optional(),
  notes: z.string().optional(),
});
export type Commander = z.infer<typeof commanderSchema>;

export const unitEchelonSchema = z.enum([
  'army',
  'corps',
  'division',
  'brigade',
  'regiment',
  'other',
]);
export type UnitEchelon = z.infer<typeof unitEchelonSchema>;

export const unitTypeSchema = z.enum(['infantry', 'cavalry', 'artillery', 'other']);
export type UnitType = z.infer<typeof unitTypeSchema>;

export const symbolStyleSchema = z.object({
  color: colorSchema,
  thickness: z.number().positive(),
  dash: z.array(z.number().nonnegative()),
  labelPosition: z.enum(['above', 'below', 'center']),
});
export type SymbolStyle = z.infer<typeof symbolStyleSchema>;

export const unitDefinitionSchema = z.object({
  id: idSchema,
  factionId: idSchema,
  name: nameSchema,
  echelon: unitEchelonSchema,
  unitType: unitTypeSchema,
  parentUnitId: idSchema.nullable(),
  commanderId: idSchema.nullable(),
  initialStrength: z.number().nonnegative().nullable(),
  defaultSymbolStyle: symbolStyleSchema,
  notes: z.string().optional(),
});
export type UnitDefinition = z.infer<typeof unitDefinitionSchema>;

function findUnitHierarchyCycle(units: readonly UnitDefinition[]): string[] | null {
  const byId = new Map(units.map((unit) => [unit.id, unit] as const));
  const state = new Map<string, 'visiting' | 'done'>();

  for (const start of units) {
    if (state.get(start.id) === 'done') continue;

    const path: string[] = [];
    let current: UnitDefinition | undefined = start;

    while (current) {
      const currentState = state.get(current.id);
      if (currentState === 'visiting') {
        const cycleStart = path.indexOf(current.id);
        const cycle = cycleStart >= 0 ? path.slice(cycleStart) : [...path];
        return [...cycle, current.id];
      }
      if (currentState === 'done') break;

      state.set(current.id, 'visiting');
      path.push(current.id);
      current = current.parentUnitId ? byId.get(current.parentUnitId) : undefined;
    }

    for (const id of path) {
      state.set(id, 'done');
    }
  }

  return null;
}

export const armyRosterSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: idSchema,
    name: nameSchema,
    factions: z.array(factionSchema),
    commanders: z.array(commanderSchema),
    units: z.array(unitDefinitionSchema),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .superRefine((roster, ctx) => {
    addDuplicateIdIssues(roster.factions, ctx, ['factions'], 'faction');
    addDuplicateIdIssues(roster.commanders, ctx, ['commanders'], 'commander');
    addDuplicateIdIssues(roster.units, ctx, ['units'], 'unit');

    const factionIds = new Set(roster.factions.map((faction) => faction.id));
    const commanderIds = new Set(roster.commanders.map((commander) => commander.id));
    const unitsById = new Map(roster.units.map((unit) => [unit.id, unit] as const));

    roster.units.forEach((unit, index) => {
      if (!factionIds.has(unit.factionId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Unit "${unit.id}" references unknown faction "${unit.factionId}"`,
          path: ['units', index, 'factionId'],
        });
      }

      if (unit.commanderId !== null && !commanderIds.has(unit.commanderId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Unit "${unit.id}" references unknown commander "${unit.commanderId}"`,
          path: ['units', index, 'commanderId'],
        });
      }

      if (unit.parentUnitId !== null) {
        const parent = unitsById.get(unit.parentUnitId);
        if (!parent) {
          ctx.addIssue({
            code: 'custom',
            message: `Unit "${unit.id}" references unknown parent "${unit.parentUnitId}"`,
            path: ['units', index, 'parentUnitId'],
          });
        } else if (parent.factionId !== unit.factionId) {
          ctx.addIssue({
            code: 'custom',
            message: `Unit "${unit.id}" and parent "${parent.id}" must belong to the same faction`,
            path: ['units', index, 'parentUnitId'],
          });
        }
      }
    });

    const cycle = findUnitHierarchyCycle(roster.units);
    if (cycle) {
      ctx.addIssue({
        code: 'custom',
        message: `Cycle detected in unit hierarchy: ${cycle.join(' -> ')}`,
        path: ['units'],
      });
    }
  });
export type ArmyRoster = z.infer<typeof armyRosterSchema>;

export const unitStatusSchema = z.enum([
  'reserve',
  'moving',
  'engaged',
  'holding',
  'retreating',
  'routed',
  'other',
]);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

export const unitPhaseStateSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  rotationDegrees: finiteNumberSchema,
  frontageLength: z.number().positive(),
  shapePoints: z.array(pointSchema).min(2).optional(),
  visible: z.boolean(),
  effectiveStrength: z.number().nonnegative().nullable(),
  status: unitStatusSchema,
  commanderOverrideId: idSchema.nullable().optional(),
  labelOverride: z.string().optional(),
  notes: z.string().optional(),
});
export type UnitPhaseState = z.infer<typeof unitPhaseStateSchema>;

export const annotationKindSchema = z.enum([
  'movementArrow',
  'attackArrow',
  'defenseLine',
  'highlight',
  'text',
]);
export type AnnotationKind = z.infer<typeof annotationKindSchema>;

export const annotationGeometrySchema = z.discriminatedUnion('type', [
  polygonGeometrySchema,
  polylineGeometrySchema,
  textGeometrySchema,
]);
export type AnnotationGeometry = z.infer<typeof annotationGeometrySchema>;

export const annotationStyleSchema = z.object({
  strokeColor: colorSchema,
  strokeWidth: z.number().positive(),
  fillColor: colorSchema.optional(),
  opacity: z.number().min(0).max(1),
  dash: z.array(z.number().nonnegative()),
  arrowhead: z.enum(['none', 'end', 'both']),
});
export type AnnotationStyle = z.infer<typeof annotationStyleSchema>;

const ANNOTATION_GEOMETRY_BY_KIND: Record<AnnotationKind, AnnotationGeometry['type']> = {
  movementArrow: 'polyline',
  attackArrow: 'polyline',
  defenseLine: 'polyline',
  highlight: 'polygon',
  text: 'textAnchor',
};

export const battleAnnotationSchema = z
  .object({
    id: idSchema,
    kind: annotationKindSchema,
    geometry: annotationGeometrySchema,
    style: annotationStyleSchema,
    label: z.string().optional(),
    linkedUnitId: idSchema.optional(),
  })
  .superRefine((annotation, ctx) => {
    if (annotation.geometry.type !== ANNOTATION_GEOMETRY_BY_KIND[annotation.kind]) {
      ctx.addIssue({
        code: 'custom',
        message: `${annotation.kind} annotations require ${ANNOTATION_GEOMETRY_BY_KIND[annotation.kind]} geometry`,
        path: ['geometry', 'type'],
      });
    }
  });
export type BattleAnnotation = z.infer<typeof battleAnnotationSchema>;

export const battlePhaseSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    order: z.number().int().nonnegative(),
    timeLabel: z.string().optional(),
    notes: z.string().optional(),
    unitStates: z.record(z.string(), unitPhaseStateSchema),
    annotations: z.array(battleAnnotationSchema),
  })
  .superRefine((phase, ctx) => {
    addDuplicateIdIssues(phase.annotations, ctx, ['annotations'], 'annotation');
  });
export type BattlePhase = z.infer<typeof battlePhaseSchema>;

const scenarioBaseSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: idSchema,
  name: nameSchema,
  description: z.string().optional(),
  terrainSnapshot: terrainMapSchema,
  rosterSnapshot: armyRosterSchema,
  phases: z.array(battlePhaseSchema).min(1, 'A scenario needs at least one phase'),
  activePhaseId: idSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const battleScenarioSchema = scenarioBaseSchema.superRefine((scenario, ctx) => {
  addDuplicateIdIssues(scenario.phases, ctx, ['phases'], 'phase');

  if (!scenario.phases.some((phase) => phase.id === scenario.activePhaseId)) {
    ctx.addIssue({
      code: 'custom',
      message: `Active phase "${scenario.activePhaseId}" does not exist`,
      path: ['activePhaseId'],
    });
  }

  const unitIds = new Set(scenario.rosterSnapshot.units.map((unit) => unit.id));
  const commanderIds = new Set(scenario.rosterSnapshot.commanders.map((commander) => commander.id));

  scenario.phases.forEach((phase, phaseIndex) => {
    Object.entries(phase.unitStates).forEach(([unitId, state]) => {
      if (!unitIds.has(unitId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Phase "${phase.id}" has state for unknown unit "${unitId}"`,
          path: ['phases', phaseIndex, 'unitStates', unitId],
        });
      }

      if (state.commanderOverrideId !== null && state.commanderOverrideId !== undefined) {
        if (!commanderIds.has(state.commanderOverrideId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Phase "${phase.id}" references unknown commander "${state.commanderOverrideId}"`,
            path: ['phases', phaseIndex, 'unitStates', unitId, 'commanderOverrideId'],
          });
        }
      }
    });

    phase.annotations.forEach((annotation, annotationIndex) => {
      if (annotation.linkedUnitId !== undefined && !unitIds.has(annotation.linkedUnitId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Annotation "${annotation.id}" links to unknown unit "${annotation.linkedUnitId}"`,
          path: ['phases', phaseIndex, 'annotations', annotationIndex, 'linkedUnitId'],
        });
      }
    });
  });
});
export type BattleScenario = z.infer<typeof battleScenarioSchema>;
