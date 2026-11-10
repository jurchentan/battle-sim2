import type { BattleScenario, TerrainFeature, UnitDefinition } from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import {
  ECHELON_LABELS,
  effectiveUnitStrength,
  hierarchyPath,
  unitDisplayName,
} from '../army/rosterDocuments';
import { dangerButtonClass, primaryButtonClass, sectionHeadingClass } from '../army/ui';
import { FEATURE_KIND_LABELS } from '../terrain/kinds';
import { NumberField, TextField } from '../terrain/fields';
import { activeScenarioPhase, scenarioUnitLabel } from './scenarioDocuments';

function detailRow(label: string, value: string, testId?: string) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#ded3bd] py-1.5 text-xs">
      <dt className="text-[#857a64]">{label}</dt>
      <dd data-testid={testId} className="text-right font-medium text-[#4a4438]">
        {value}
      </dd>
    </div>
  );
}

function geometrySummary(feature: TerrainFeature): string {
  switch (feature.geometry.type) {
    case 'polygon':
      return `${feature.geometry.points.length} vertices`;
    case 'polyline':
      return `${feature.geometry.points.length} points`;
    case 'point':
      return `${Math.round(feature.geometry.position.x)}, ${Math.round(
        feature.geometry.position.y,
      )}`;
    case 'textAnchor':
      return `${Math.round(feature.geometry.position.x)}, ${Math.round(
        feature.geometry.position.y,
      )} · ${Math.round(feature.geometry.rotationDegrees)}°`;
  }
}

function UnitInspector({ scenario, unit }: { scenario: BattleScenario; unit: UnitDefinition }) {
  const phase = activeScenarioPhase(scenario);
  const state = phase?.unitStates[unit.id];
  const updateUnitState = useScenarioStore((store) => store.updateUnitState);
  const beginPlacement = useScenarioEditorStore((store) => store.beginPlacement);
  const placementUnitId = useScenarioEditorStore((store) => store.placementUnitId);

  const faction = scenario.rosterSnapshot.factions.find(
    (candidate) => candidate.id === unit.factionId,
  );
  const displayName = scenarioUnitLabel(scenario, unit, state);
  const generatedName = unitDisplayName(scenario.rosterSnapshot, unit);
  const path = hierarchyPath(scenario.rosterSnapshot, unit.id)
    .map((entry) => unitDisplayName(scenario.rosterSnapshot, entry))
    .join(' › ');
  const strength = effectiveUnitStrength(scenario.rosterSnapshot, unit.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={sectionHeadingClass}>Selected formation</p>
          <p
            data-testid="selected-unit-name"
            className="font-display mt-1 truncate text-lg font-semibold text-[#2f2b23]"
          >
            {displayName}
          </p>
          <p className="mt-0.5 text-xs text-[#7c715c]">
            {ECHELON_LABELS[unit.echelon]} · {faction?.name ?? 'Unknown faction'}
          </p>
        </div>
        {state ? (
          <button
            type="button"
            data-testid="remove-unit-from-map"
            className={`${dangerButtonClass} shrink-0`}
            onClick={() => {
              useScenarioStore.getState().undeployUnit(unit.id);
            }}
          >
            Remove from map
          </button>
        ) : null}
      </div>

      {state ? (
        <>
          <div className="flex flex-col gap-2.5">
            <h4 className={sectionHeadingClass}>Deployment</h4>
            <TextField
              label="Label override"
              value={state.labelOverride ?? ''}
              placeholder={generatedName}
              onCommit={(value) => {
                updateUnitState(unit.id, { labelOverride: value });
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Position X"
                value={state.x}
                step={1}
                onCommit={(value) => updateUnitState(unit.id, { x: value })}
              />
              <NumberField
                label="Position Y"
                value={state.y}
                step={1}
                onCommit={(value) => updateUnitState(unit.id, { y: value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Frontage length"
                value={state.frontageLength}
                min={20}
                step={5}
                onCommit={(value) => updateUnitState(unit.id, { frontageLength: value })}
              />
              <NumberField
                label="Rotation"
                value={state.rotationDegrees}
                step={1}
                onCommit={(value) => updateUnitState(unit.id, { rotationDegrees: value })}
              />
            </div>
          </div>

          <div>
            <h4 className={sectionHeadingClass}>Details</h4>
            <dl className="mt-1">
              {detailRow('Faction', faction?.name ?? 'Unknown', 'selected-unit-faction')}
              {detailRow('Display label', displayName, 'selected-unit-label')}
              {detailRow(
                'Position',
                `${Math.round(state.x)}, ${Math.round(state.y)}`,
                'selected-unit-position',
              )}
              {detailRow(
                'Frontage',
                `${Math.round(state.frontageLength)} units`,
                'selected-unit-frontage',
              )}
              {detailRow(
                'Rotation',
                `${Math.round(state.rotationDegrees)}°`,
                'selected-unit-rotation',
              )}
              {detailRow('Strength', strength === null ? '—' : strength.toLocaleString())}
              {detailRow('Command', path || '—')}
            </dl>
          </div>
        </>
      ) : (
        <div className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2.5">
          <p className="text-xs font-semibold text-[#4a4438]">Not deployed in this phase</p>
          <p className="mt-1 text-[0.68rem] leading-4 text-[#7c715c]">
            Place this formation on the map, then drag it into position.
          </p>
          <button
            type="button"
            className={`${primaryButtonClass} mt-2`}
            onClick={() => beginPlacement(unit.id)}
          >
            {placementUnitId === unit.id ? 'Click the map to place' : 'Place on map'}
          </button>
        </div>
      )}
    </div>
  );
}

function FeatureInspector({
  scenario,
  feature,
}: {
  scenario: BattleScenario;
  feature: TerrainFeature;
}) {
  const layer = scenario.terrainSnapshot.layers.find(
    (candidate) => candidate.id === feature.layerId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={sectionHeadingClass}>Selected terrain feature</p>
        <p
          data-testid="selected-terrain-kind"
          className="font-display mt-1 text-lg font-semibold text-[#2f2b23]"
        >
          {FEATURE_KIND_LABELS[feature.kind]}
        </p>
        <p className="mt-0.5 text-xs text-[#7c715c]">{feature.name ?? 'Unnamed feature'}</p>
      </div>

      <dl>
        {detailRow('Layer', layer?.name ?? 'Unknown layer')}
        {detailRow('Geometry', geometrySummary(feature))}
        {detailRow('Stack', String(feature.zIndex))}
      </dl>

      <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
        Terrain mode is inspect-only in a scenario. The map is a snapshot and cannot be changed
        here; edit the source map in the Terrain workspace.
      </p>
    </div>
  );
}

export function ScenarioInspector({ scenario }: { scenario: BattleScenario }) {
  const mode = useScenarioEditorStore((state) => state.mode);
  const selectedUnitId = useScenarioEditorStore((state) => state.selectedUnitId);
  const selectedFeatureId = useScenarioEditorStore((state) => state.selectedFeatureId);
  const selectedUnit =
    mode === 'units'
      ? scenario.rosterSnapshot.units.find((unit) => unit.id === selectedUnitId)
      : undefined;
  const selectedFeature =
    mode === 'terrain'
      ? scenario.terrainSnapshot.features.find((feature) => feature.id === selectedFeatureId)
      : undefined;
  const phase = activeScenarioPhase(scenario);
  const deployedCount = phase ? Object.keys(phase.unitStates).length : 0;

  return (
    <aside
      aria-label="Inspector"
      className="flex w-80 shrink-0 flex-col border-l border-[#d8cdb5] bg-[#fbf7ed]"
    >
      <div className="border-b border-[#e0d6c1] px-3 py-2">
        <h3 className="text-[0.68rem] font-semibold tracking-[0.14em] text-[#857a64] uppercase">
          Inspector
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selectedUnit ? (
          <UnitInspector key={selectedUnit.id} scenario={scenario} unit={selectedUnit} />
        ) : selectedFeature ? (
          <FeatureInspector scenario={scenario} feature={selectedFeature} />
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className={sectionHeadingClass}>Scenario</p>
              <p className="font-display mt-1 text-lg font-semibold text-[#2f2b23]">
                {scenario.name}
              </p>
              <p className="mt-1 text-xs text-[#7c715c]">
                {mode === 'terrain' ? 'Terrain mode' : 'Units mode'} ·{' '}
                {phase?.name ?? 'No active phase'}
              </p>
            </div>

            <dl>
              {detailRow('Terrain snapshot', scenario.terrainSnapshot.name)}
              {detailRow('Roster snapshot', scenario.rosterSnapshot.name)}
              {detailRow('Terrain features', String(scenario.terrainSnapshot.features.length))}
              {detailRow('Factions', String(scenario.rosterSnapshot.factions.length))}
              {detailRow('Deployed formations', String(deployedCount))}
              {detailRow('Roster formations', String(scenario.rosterSnapshot.units.length))}
            </dl>

            <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
              {mode === 'terrain'
                ? 'Click a terrain feature to inspect it. Terrain is a read-only snapshot in the scenario.'
                : 'Choose a faction in the order of battle, deploy a formation, then click the map. Select a formation to drag it, resize its frontage, rotate it, or edit its label.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
