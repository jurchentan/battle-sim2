import { useState } from 'react';
import type {
  BattleScenario,
  TerrainFeature,
  UnitDefinition,
  UnitEchelon,
  UnitType,
} from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import {
  ECHELON_LABELS,
  ECHELON_ORDER,
  descendantUnitIds,
  effectiveUnitStrength,
  eligibleParentUnits,
  hierarchyPath,
  unitChildren,
  unitDisplayName,
} from '../army/rosterDocuments';
import {
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
  unitOptionLabel,
} from '../army/ui';
import { FEATURE_KIND_LABELS } from '../terrain/kinds';
import { NumberField, SelectField, TextField } from '../terrain/fields';
import { resolveBattleLineSelection } from './battleLine';
import { activeScenarioPhase, scenarioUnitLabel } from './scenarioDocuments';

const UNIT_TYPES: readonly UnitType[] = ['infantry', 'cavalry', 'artillery', 'other'];
const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
  other: 'Other',
};

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

function FormationActions({
  scenario,
  units,
}: {
  scenario: BattleScenario;
  units: UnitDefinition[];
}) {
  const roster = scenario.orderOfBattle;
  const phase = activeScenarioPhase(scenario);
  const deployedUnits = units.filter((unit) => phase?.unitStates[unit.id]);
  const singleUnit = units.length === 1 ? units[0] : undefined;
  const singleState = singleUnit ? phase?.unitStates[singleUnit.id] : undefined;

  const hiddenFactionIds = useScenarioEditorStore((store) => store.hiddenFactionIds);
  const battleLineActive = useScenarioEditorStore((store) => store.battleLineActive);
  const beginBattleLine = useScenarioEditorStore((store) => store.beginBattleLine);
  const cancelBattleLine = useScenarioEditorStore((store) => store.cancelBattleLine);
  const beginPlacement = useScenarioEditorStore((store) => store.beginPlacement);
  const placementUnitId = useScenarioEditorStore((store) => store.placementUnitId);
  const flipUnitStates = useScenarioStore((store) => store.flipUnitStates);
  const undeployUnits = useScenarioStore((store) => store.undeployUnits);

  const battleLineBrigadeCount = resolveBattleLineSelection(
    roster,
    units.map((unit) => unit.id),
    hiddenFactionIds,
  ).brigadeIds.length;
  const canPlace = singleUnit !== undefined && !singleState;
  const placeDisabled = !canPlace;
  const placeTitle = canPlace
    ? 'Arm placement, then click the map.'
    : singleUnit
      ? 'This formation is already deployed.'
      : 'Select one undeployed formation to place it on the map.';

  return (
    <div
      data-testid="formation-actions"
      className="flex flex-col gap-2 border-t border-[#e0d6c1] pt-3"
    >
      <h4 className={sectionHeadingClass}>Bulk actions</h4>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          data-testid="bulk-flip-180"
          className={secondaryButtonClass}
          disabled={deployedUnits.length === 0}
          title="Rotate every deployed selected formation by 180°."
          onClick={() => flipUnitStates(deployedUnits.map((unit) => unit.id))}
        >
          Flip 180°
        </button>
        <button
          type="button"
          data-testid="remove-selected-units"
          className={dangerButtonClass}
          disabled={deployedUnits.length === 0}
          title="Remove every deployed selected formation from the map."
          onClick={() => undeployUnits(deployedUnits.map((unit) => unit.id))}
        >
          Remove selected from map
        </button>
        <button
          type="button"
          data-testid="battle-line-draw"
          className={secondaryButtonClass}
          aria-pressed={battleLineActive}
          disabled={!battleLineActive && battleLineBrigadeCount === 0}
          title={
            battleLineActive
              ? 'Cancel the battle line tool (Esc).'
              : battleLineBrigadeCount === 0
                ? 'Select a formation with brigades, or select brigades directly.'
                : `Draw a battle line for the ${battleLineBrigadeCount} selected brigade${
                    battleLineBrigadeCount === 1 ? '' : 's'
                  }.`
          }
          onClick={() => {
            if (battleLineActive) {
              cancelBattleLine();
            } else {
              beginBattleLine();
            }
          }}
        >
          {battleLineActive ? 'Cancel battle line' : 'Draw battle line'}
        </button>
        <button
          type="button"
          data-testid="place-selected-on-map"
          className={primaryButtonClass}
          disabled={placeDisabled}
          title={placeTitle}
          onClick={() => {
            if (!singleUnit) return;
            beginPlacement(singleUnit.id);
          }}
        >
          {singleUnit && placementUnitId === singleUnit.id
            ? 'Click the map to place'
            : 'Place on map'}
        </button>
      </div>
      <p className="text-[0.68rem] leading-4 text-[#7c715c]">
        Actions apply to every selected formation. Place on map needs a single undeployed formation.
      </p>
    </div>
  );
}

function UnitInspector({ scenario, unit }: { scenario: BattleScenario; unit: UnitDefinition }) {
  const roster = scenario.orderOfBattle;
  const phase = activeScenarioPhase(scenario);
  const state = phase?.unitStates[unit.id];
  const updateUnit = useScenarioStore((store) => store.updateUnit);
  const reparentUnit = useScenarioStore((store) => store.reparentUnit);
  const deleteUnit = useScenarioStore((store) => store.deleteUnit);
  const updateUnitState = useScenarioStore((store) => store.updateUnitState);
  const selectUnit = useScenarioEditorStore((store) => store.selectUnit);

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const faction = roster.factions.find((candidate) => candidate.id === unit.factionId);
  const displayName = scenarioUnitLabel(scenario, unit, state);
  const generatedName = unitDisplayName(roster, unit);
  const path = hierarchyPath(roster, unit.id)
    .map((entry) => unitDisplayName(roster, entry))
    .join(' › ');
  const strength = effectiveUnitStrength(roster, unit.id);
  const children = unitChildren(roster, unit.id);
  const descendantCount = descendantUnitIds(roster, unit.id).size;
  const parents = eligibleParentUnits(roster, unit.id);

  const report = (result: { ok: true } | { ok: false; error: string }): void => {
    setError(result.ok ? null : result.error);
  };

  const commitStrength = (value: string): void => {
    const raw = value.trim();
    if (raw === '') {
      if (unit.initialStrength === null) return;
      report(updateUnit(unit.id, { initialStrength: null }));
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Initial strength must be a non-negative number, or left blank.');
      return;
    }
    if (parsed === unit.initialStrength) return;
    report(updateUnit(unit.id, { initialStrength: parsed }));
  };

  const handleDelete = (): void => {
    const result = deleteUnit(unit.id);
    if (!result.ok) {
      setError(result.error);
      setConfirmDelete(false);
      return;
    }
    selectUnit(null);
  };

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
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className={sectionHeadingClass}>Order of battle</h4>
        <TextField
          label="Custom name"
          value={unit.customName ?? ''}
          placeholder={generatedName}
          onCommit={(value) => report(updateUnit(unit.id, { customName: value }))}
        />
        <TextField
          label="Commander"
          value={unit.commander ?? ''}
          placeholder="Commander name"
          onCommit={(value) => report(updateUnit(unit.id, { commander: value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Echelon"
            value={unit.echelon}
            options={ECHELON_ORDER.map((echelon) => ({
              value: echelon,
              label: ECHELON_LABELS[echelon],
            }))}
            onChange={(echelon: UnitEchelon) => report(updateUnit(unit.id, { echelon }))}
          />
          <SelectField
            label="Unit type"
            value={unit.unitType}
            options={UNIT_TYPES.map((type) => ({
              value: type,
              label: UNIT_TYPE_LABELS[type],
            }))}
            onChange={(unitType: UnitType) => report(updateUnit(unit.id, { unitType }))}
          />
        </div>
        <SelectField
          label="Parent formation"
          hint="Descendants and other factions are excluded to prevent cycles."
          value={unit.parentUnitId ?? ''}
          options={[
            { value: '', label: 'None (root formation)' },
            ...parents.map((parent) => ({
              value: parent.id,
              label: unitOptionLabel(roster, parent),
            })),
          ]}
          onChange={(parentUnitId) =>
            report(reparentUnit(unit.id, parentUnitId === '' ? null : parentUnitId))
          }
        />
        {unit.echelon === 'brigade' ? (
          <TextField
            label="Initial strength"
            value={unit.initialStrength === null ? '' : String(unit.initialStrength)}
            placeholder="Unknown"
            onCommit={commitStrength}
          />
        ) : (
          <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
            Strength rolls up from brigades.
          </p>
        )}
        <TextField
          label="Notes"
          value={unit.notes ?? ''}
          onCommit={(value) => report(updateUnit(unit.id, { notes: value }))}
        />
      </div>

      {state ? (
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
      ) : (
        <div className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2.5">
          <p className="text-xs font-semibold text-[#4a4438]">Not deployed in this phase</p>
          <p className="mt-1 text-[0.68rem] leading-4 text-[#7c715c]">
            Place this formation on the map from Bulk actions, then drag it into position.
          </p>
        </div>
      )}

      <FormationActions scenario={scenario} units={[unit]} />

      <div>
        <h4 className={sectionHeadingClass}>Details</h4>
        <dl className="mt-1">
          {detailRow('Faction', faction?.name ?? 'Unknown', 'selected-unit-faction')}
          {detailRow('Display label', displayName, 'selected-unit-label')}
          {state
            ? detailRow(
                'Position',
                `${Math.round(state.x)}, ${Math.round(state.y)}`,
                'selected-unit-position',
              )
            : null}
          {state
            ? detailRow(
                'Frontage',
                `${Math.round(state.frontageLength)} units`,
                'selected-unit-frontage',
              )
            : null}
          {state
            ? detailRow(
                'Rotation',
                `${Math.round(state.rotationDegrees)}°`,
                'selected-unit-rotation',
              )
            : null}
          {detailRow('Strength', strength === null ? '—' : strength.toLocaleString())}
          {detailRow('Command', path || '—')}
          {children.length > 0 ? detailRow('Subordinates', String(children.length)) : null}
        </dl>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-[#e0d6c1] pt-3">
        {confirmDelete ? (
          <>
            <p
              data-testid="delete-unit-warning"
              className="text-[0.68rem] font-semibold text-[#8b3a2f]"
            >
              {descendantCount > 0
                ? `This formation has ${descendantCount} subordinate formation${
                    descendantCount === 1 ? '' : 's'
                  }. Delete ${descendantCount === 1 ? 'it' : 'them all'} and remove ${
                    descendantCount === 1 ? 'its state' : 'their states'
                  } from every phase?`
                : 'Delete this formation and remove its phase states from every phase?'}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={dangerButtonClass}
                onClick={handleDelete}
                data-testid="confirm-delete-unit"
              >
                Confirm delete
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className={`${dangerButtonClass} self-start`}
            data-testid="delete-unit"
            title={
              descendantCount > 0
                ? 'Delete this formation and its subordinates after confirmation.'
                : 'Delete this formation from the order of battle.'
            }
            onClick={() => {
              if (state || descendantCount > 0) {
                setConfirmDelete(true);
              } else {
                handleDelete();
              }
            }}
          >
            Delete unit
          </button>
        )}
        {error ? (
          <p role="alert" className="text-[0.68rem] font-medium text-[#8b3a2f]">
            {error}
          </p>
        ) : null}
      </div>
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

function MultiUnitInspector({
  scenario,
  units,
}: {
  scenario: BattleScenario;
  units: UnitDefinition[];
}) {
  const roster = scenario.orderOfBattle;
  const phase = activeScenarioPhase(scenario);
  const updateUnitStates = useScenarioStore((store) => store.updateUnitStates);
  const deployedUnits = units.filter((unit) => phase?.unitStates[unit.id]);
  const primaryState = deployedUnits[0] ? phase?.unitStates[deployedUnits[0].id] : undefined;

  const setRotation = (rotationDegrees: number): void => {
    updateUnitStates(
      Object.fromEntries(deployedUnits.map((unit) => [unit.id, { rotationDegrees }] as const)),
    );
  };

  const setFrontage = (frontageLength: number): void => {
    if (deployedUnits.length === 0) return;
    updateUnitStates(
      Object.fromEntries(deployedUnits.map((unit) => [unit.id, { frontageLength }] as const)),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={sectionHeadingClass}>Multiple formations</p>
        <p
          data-testid="selected-unit-count"
          className="font-display mt-1 text-lg font-semibold text-[#2f2b23]"
        >
          {units.length} formations selected
        </p>
        <p className="mt-0.5 text-xs text-[#7c715c]">
          {deployedUnits.length} on the map in {phase?.name ?? 'the active phase'}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className={sectionHeadingClass}>Bulk transform</h4>
        <NumberField
          label="Rotation (all selected)"
          value={primaryState?.rotationDegrees ?? 0}
          step={1}
          onCommit={setRotation}
        />
        <NumberField
          label="Frontage (all selected)"
          value={primaryState?.frontageLength ?? 120}
          min={20}
          step={5}
          onCommit={setFrontage}
        />
        <p className="text-[0.68rem] leading-4 text-[#7c715c]">
          Bulk frontage changes the stored width only; it does not re-space the battle line. Redraw
          the line if the spacing needs to change.
        </p>
        <p className="text-[0.68rem] leading-4 text-[#7c715c]">
          Drag any selected formation to move the whole group. The transformer&apos;s top handle
          rotates every selected formation around the group centre.
        </p>
      </div>

      <FormationActions scenario={scenario} units={units} />

      <div>
        <h4 className={sectionHeadingClass}>Selection</h4>
        <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto pr-1">
          {units.map((unit) => {
            const faction = roster.factions.find((candidate) => candidate.id === unit.factionId);
            return (
              <li
                key={unit.id}
                className="flex items-baseline justify-between gap-2 border-b border-dashed border-[#ded3bd] py-1 text-xs"
              >
                <span className="min-w-0 truncate font-medium text-[#4a4438]">
                  {unitDisplayName(roster, unit)}
                </span>
                <span className="shrink-0 text-[0.62rem] text-[#857a64]">
                  {ECHELON_LABELS[unit.echelon]} · {faction?.name ?? 'Unknown'}
                  {phase?.unitStates[unit.id] ? '' : ' · not deployed'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function ScenarioInspector({ scenario }: { scenario: BattleScenario }) {
  const roster = scenario.orderOfBattle;
  const mode = useScenarioEditorStore((state) => state.mode);
  const selectedUnitIds = useScenarioEditorStore((state) => state.selectedUnitIds);
  const selectedFeatureId = useScenarioEditorStore((state) => state.selectedFeatureId);
  const selectedUnits =
    mode === 'units'
      ? selectedUnitIds.flatMap((unitId) => {
          const unit = roster.units.find((candidate) => candidate.id === unitId);
          return unit ? [unit] : [];
        })
      : [];
  const selectedUnit = selectedUnits.length === 1 ? selectedUnits[0] : undefined;
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
        ) : selectedUnits.length > 1 ? (
          <MultiUnitInspector scenario={scenario} units={selectedUnits} />
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
                {mode === 'terrain' ? 'Terrain mode' : 'Order of battle mode'} ·{' '}
                {phase?.name ?? 'No active phase'}
              </p>
            </div>

            <dl>
              {detailRow('Terrain snapshot', scenario.terrainSnapshot.name)}
              {detailRow('Order of battle', roster.name)}
              {detailRow('Terrain features', String(scenario.terrainSnapshot.features.length))}
              {detailRow('Factions', String(roster.factions.length))}
              {detailRow('Deployed formations', String(deployedCount))}
              {detailRow('Formations', String(roster.units.length))}
            </dl>

            <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
              {mode === 'terrain'
                ? 'Click a terrain feature to inspect it. Terrain is a read-only snapshot in the scenario.'
                : 'Add factions and formations in the order of battle, or generate an army. Select a formation to edit it, then deploy it and click the map.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
