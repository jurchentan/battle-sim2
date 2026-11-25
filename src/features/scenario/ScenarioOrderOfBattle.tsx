import { useState } from 'react';
import type { ArmyRoster, BattleScenario, Faction, UnitDefinition } from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import {
  ECHELON_LABELS,
  canHaveSubordinates,
  descendantUnitIds,
  effectiveUnitStrength,
  unitChildren,
  unitDisplayName,
} from '../army/rosterDocuments';
import { secondaryButtonClass, sectionHeadingClass } from '../army/ui';
import { GenerateArmyDialog } from './GenerateArmyDialog';
import { ScenarioAddUnitDialog } from './ScenarioAddUnitDialog';
import { ScenarioFactionDialog } from './ScenarioFactionDialog';
import { activeScenarioPhase } from './scenarioDocuments';

interface ScenarioOrderOfBattleProps {
  scenario: BattleScenario;
}

interface UnitRowProps {
  roster: ArmyRoster;
  unit: UnitDefinition;
  depth: number;
  deployedUnitIds: ReadonlySet<string>;
  selectedUnitIds: readonly string[];
  onSelectUnit: (unitId: string, additive: boolean) => void;
  onSelectHierarchy: (unitId: string) => void;
  onDeployUnit: (unitId: string) => void;
  onRemoveUnit: (unitId: string) => void;
  onAddSubordinate: (unit: UnitDefinition) => void;
}

function UnitRow({
  roster,
  unit,
  depth,
  deployedUnitIds,
  selectedUnitIds,
  onSelectUnit,
  onSelectHierarchy,
  onDeployUnit,
  onRemoveUnit,
  onAddSubordinate,
}: UnitRowProps) {
  const children = unitChildren(roster, unit.id);
  const name = unitDisplayName(roster, unit);
  const deployed = deployedUnitIds.has(unit.id);
  const selected = selectedUnitIds.includes(unit.id);
  const strength = effectiveUnitStrength(roster, unit.id);
  const canAddSubordinate = canHaveSubordinates(roster, unit);

  return (
    <li>
      <div
        data-testid={`oob-unit-${unit.id}`}
        className={[
          'flex flex-wrap items-center justify-between gap-1.5 rounded-md border px-2 py-1.5',
          selected
            ? 'border-[#7d916f] bg-[#eef1e4]'
            : deployed
              ? 'border-[#cfc3a8] bg-[#f8f2e5]'
              : 'border-transparent bg-transparent',
        ].join(' ')}
        style={{ marginLeft: depth * 10 }}
      >
        <button
          type="button"
          aria-label={`Select unit ${name}`}
          className="min-w-0 flex-1 text-left"
          onClick={(event) => onSelectUnit(unit.id, event.shiftKey)}
          onDoubleClick={() => onSelectHierarchy(unit.id)}
        >
          <span className="block truncate text-xs font-semibold text-[#3b352a]">{name}</span>
          <span className="block truncate text-[0.62rem] text-[#7c715c]">
            {ECHELON_LABELS[unit.echelon]}
            {unit.commander ? ` · ${unit.commander}` : ''}
            {strength !== null ? ` · ${strength.toLocaleString()}` : ''}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {canAddSubordinate ? (
            <button
              type="button"
              aria-label={`Add subordinate to ${name}`}
              title="Add subordinate"
              className="rounded border border-[#c9bda3] bg-[#f8f2e5] px-1.5 py-0.5 text-[0.7rem] font-semibold leading-4 text-[#5f594b] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2]"
              onClick={() => onAddSubordinate(unit)}
            >
              +
            </button>
          ) : null}

          {deployed ? (
            <button
              type="button"
              aria-label={`Remove ${name} from map`}
              className="rounded border border-[#d3b3a8] bg-[#f9ede8] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#8b3a2f] transition-colors hover:border-[#b98a7b] hover:bg-[#f3ddd4]"
              onClick={() => onRemoveUnit(unit.id)}
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              aria-label={`Deploy ${name}`}
              className="rounded border border-[#a9bc99] bg-[#eef1e4] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#3d5236] transition-colors hover:border-[#7d916f] hover:bg-[#e2e8d7]"
              onClick={() => onDeployUnit(unit.id)}
            >
              Deploy
            </button>
          )}
        </div>
      </div>

      {children.length > 0 ? (
        <ul className="mt-1 space-y-1 border-l border-dashed border-[#d8cdb5] pl-1">
          {children.map((child) => (
            <UnitRow
              key={child.id}
              roster={roster}
              unit={child}
              depth={depth + 1}
              deployedUnitIds={deployedUnitIds}
              selectedUnitIds={selectedUnitIds}
              onSelectUnit={onSelectUnit}
              onSelectHierarchy={onSelectHierarchy}
              onDeployUnit={onDeployUnit}
              onRemoveUnit={onRemoveUnit}
              onAddSubordinate={onAddSubordinate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FactionSection({
  roster,
  faction,
  deployedUnitIds,
  hidden,
  selectedUnitIds,
  onToggleVisible,
  onSelectUnit,
  onSelectHierarchy,
  onDeployUnit,
  onRemoveUnit,
  onAddSubordinate,
  onAddUnit,
  onEditFaction,
}: {
  roster: ArmyRoster;
  faction: Faction;
  deployedUnitIds: ReadonlySet<string>;
  hidden: boolean;
  selectedUnitIds: readonly string[];
  onToggleVisible: () => void;
  onSelectUnit: (unitId: string, additive: boolean) => void;
  onSelectHierarchy: (unitId: string) => void;
  onDeployUnit: (unitId: string) => void;
  onRemoveUnit: (unitId: string) => void;
  onAddSubordinate: (unit: UnitDefinition) => void;
  onAddUnit: (factionId: string) => void;
  onEditFaction: (factionId: string) => void;
}) {
  const factionUnits = roster.units.filter((unit) => unit.factionId === faction.id);
  const deployedCount = factionUnits.filter((unit) => deployedUnitIds.has(unit.id)).length;
  const roots = unitChildren(roster, null).filter((unit) => unit.factionId === faction.id);

  return (
    <section
      data-testid={`oob-faction-${faction.id}`}
      aria-label={`Faction ${faction.name}`}
      className="rounded-lg border border-[#e2d8c3] bg-[#fbf7ed] p-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#3b352a]">
          <input
            type="checkbox"
            checked={!hidden}
            aria-label={`Show faction ${faction.name}`}
            onChange={onToggleVisible}
            className="h-3.5 w-3.5 accent-[#5f7352]"
          />
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-full border border-black/15"
            style={{ backgroundColor: faction.color }}
          />
          <span className="truncate">{faction.name}</span>
        </label>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[0.58rem] font-semibold tracking-wide text-[#857a64] uppercase">
            {deployedCount}/{factionUnits.length} deployed
          </span>
          <button
            type="button"
            aria-label={`Edit faction ${faction.name}`}
            className="rounded border border-[#c9bda3] bg-[#f8f2e5] px-1.5 py-0.5 text-[0.58rem] font-semibold text-[#5f594b] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2]"
            onClick={() => onEditFaction(faction.id)}
          >
            Edit
          </button>
        </div>
      </div>

      {hidden ? (
        <p className="mt-2 rounded border border-dashed border-[#d8cdb5] px-2 py-1.5 text-[0.64rem] text-[#857a64]">
          Hidden on map. Restore visibility to deploy or select this faction.
        </p>
      ) : roots.length === 0 ? (
        <div className="mt-2 rounded border border-dashed border-[#d8cdb5] px-2 py-2 text-center">
          <p className="text-[0.64rem] text-[#857a64]">No formations in this faction.</p>
          <button
            type="button"
            className={`${secondaryButtonClass} mt-1.5`}
            onClick={() => onAddUnit(faction.id)}
          >
            Add unit
          </button>
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {roots.map((unit) => (
            <UnitRow
              key={unit.id}
              roster={roster}
              unit={unit}
              depth={0}
              deployedUnitIds={deployedUnitIds}
              selectedUnitIds={selectedUnitIds}
              onSelectUnit={onSelectUnit}
              onSelectHierarchy={onSelectHierarchy}
              onDeployUnit={onDeployUnit}
              onRemoveUnit={onRemoveUnit}
              onAddSubordinate={onAddSubordinate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScenarioOrderOfBattle({ scenario }: ScenarioOrderOfBattleProps) {
  const phase = activeScenarioPhase(scenario);
  const roster = scenario.orderOfBattle;
  const deployedUnitIds = new Set(Object.keys(phase?.unitStates ?? {}));
  const hiddenFactionIds = useScenarioEditorStore((state) => state.hiddenFactionIds);
  const selectedUnitIds = useScenarioEditorStore((state) => state.selectedUnitIds);
  const selectUnit = useScenarioEditorStore((state) => state.selectUnit);
  const selectUnits = useScenarioEditorStore((state) => state.selectUnits);
  const toggleUnitSelection = useScenarioEditorStore((state) => state.toggleUnitSelection);
  const beginPlacement = useScenarioEditorStore((state) => state.beginPlacement);
  const toggleFactionVisible = useScenarioEditorStore((state) => state.toggleFactionVisible);
  const undeployUnit = useScenarioStore((state) => state.undeployUnit);

  const [factionDialog, setFactionDialog] = useState<{ factionId?: string } | null>(null);
  const [addUnitSeed, setAddUnitSeed] = useState<{
    factionId?: string;
    parentUnitId?: string | null;
  } | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const handleSelectUnit = (unitId: string, additive: boolean): void => {
    if (additive) {
      toggleUnitSelection(unitId);
    } else {
      selectUnit(unitId);
    }
  };

  const handleSelectHierarchy = (unitId: string): void => {
    const hierarchyIds = [unitId, ...descendantUnitIds(roster, unitId)];
    const deployedHierarchyIds = hierarchyIds.filter((id) => deployedUnitIds.has(id));
    selectUnits(deployedHierarchyIds);
  };

  const handleAddSubordinate = (unit: UnitDefinition): void => {
    setAddUnitSeed({ factionId: unit.factionId, parentUnitId: unit.id });
  };

  return (
    <aside
      aria-label="Order of battle"
      data-testid="scenario-oob"
      className="flex w-80 shrink-0 flex-col border-r border-[#d8cdb5] bg-[#f3ecdc]"
    >
      <div className="border-b border-[#e0d6c1] px-3 py-2">
        <h3 className={sectionHeadingClass}>Order of battle</h3>
        <p className="mt-1 text-[0.64rem] text-[#7c715c]">
          {roster.units.length} formations · {roster.factions.length} factions ·{' '}
          {deployedUnitIds.size} deployed
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            data-testid="oob-add-faction"
            className="rounded border border-[#c9bda3] bg-[#f8f2e5] px-1.5 py-1 text-[0.6rem] font-semibold text-[#5f594b] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2]"
            onClick={() => setFactionDialog({})}
          >
            + Faction
          </button>
          <button
            type="button"
            data-testid="oob-add-unit"
            className="rounded border border-[#c9bda3] bg-[#f8f2e5] px-1.5 py-1 text-[0.6rem] font-semibold text-[#5f594b] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={roster.factions.length === 0}
            onClick={() => setAddUnitSeed({ factionId: roster.factions[0]?.id })}
          >
            + Unit
          </button>
          <button
            type="button"
            data-testid="oob-generate-army"
            className="rounded border border-[#a9bc99] bg-[#eef1e4] px-1.5 py-1 text-[0.6rem] font-semibold text-[#3d5236] transition-colors hover:border-[#7d916f] hover:bg-[#e2e8d7]"
            onClick={() => setGeneratorOpen(true)}
          >
            Generate army
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {roster.factions.length === 0 ? (
          <div
            data-testid="oob-empty-state"
            className="rounded-lg border border-dashed border-[#d8cdb5] bg-[#fbf7ed]/70 px-3 py-6 text-center"
          >
            <p className="text-xs font-semibold text-[#4a4438]">This order of battle is empty.</p>
            <p className="mt-1 text-[0.66rem] leading-4 text-[#857a64]">
              Add a faction, then create formations or generate an army. Everything here belongs to
              this scenario.
            </p>
            <button
              type="button"
              className={`${secondaryButtonClass} mt-2`}
              onClick={() => setFactionDialog({})}
            >
              Add the first faction
            </button>
          </div>
        ) : null}

        {roster.factions.map((faction) => (
          <FactionSection
            key={faction.id}
            roster={roster}
            faction={faction}
            deployedUnitIds={deployedUnitIds}
            hidden={hiddenFactionIds.includes(faction.id)}
            selectedUnitIds={selectedUnitIds}
            onToggleVisible={() => toggleFactionVisible(faction.id)}
            onSelectUnit={handleSelectUnit}
            onSelectHierarchy={handleSelectHierarchy}
            onDeployUnit={beginPlacement}
            onRemoveUnit={(unitId) => {
              undeployUnit(unitId);
            }}
            onAddSubordinate={handleAddSubordinate}
            onAddUnit={(factionId) => setAddUnitSeed({ factionId })}
            onEditFaction={(factionId) => setFactionDialog({ factionId })}
          />
        ))}
      </div>

      <p className="border-t border-[#e0d6c1] px-3 py-2 text-[0.62rem] leading-4 text-[#7c715c]">
        Select a formation to edit it in the inspector. Choose Deploy, then click the map to place a
        formation. Parent formations also place their undeployed subordinates in front. Shift-click
        to add formations to the selection, or double-click a parent to select its deployed command.
      </p>

      {factionDialog ? (
        <ScenarioFactionDialog
          scenario={scenario}
          factionId={factionDialog.factionId}
          onClose={() => setFactionDialog(null)}
        />
      ) : null}

      {addUnitSeed ? (
        <ScenarioAddUnitDialog
          scenario={scenario}
          seed={addUnitSeed}
          onClose={() => setAddUnitSeed(null)}
        />
      ) : null}

      {generatorOpen ? (
        <GenerateArmyDialog scenario={scenario} onClose={() => setGeneratorOpen(false)} />
      ) : null}
    </aside>
  );
}
