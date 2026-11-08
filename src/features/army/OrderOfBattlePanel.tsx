import type { ArmyRoster, Faction, UnitDefinition } from '../../models';
import {
  canHaveSubordinates,
  ECHELON_LABELS,
  effectiveUnitStrength,
  isStrengthAggregated,
  unitChildren,
  unitDisplayName,
} from './rosterDocuments';
import { primaryButtonClass, sectionHeadingClass } from './ui';

const ECHELON_SHORT: Record<UnitDefinition['echelon'], string> = {
  army: 'A',
  corps: 'C',
  division: 'D',
  brigade: 'B',
  regiment: 'R',
  other: 'O',
};

function unitMeta(roster: ArmyRoster, unit: UnitDefinition): string {
  const parts: string[] = [ECHELON_LABELS[unit.echelon]];
  const strength = effectiveUnitStrength(roster, unit.id);
  if (strength !== null) {
    parts.push(`${isStrengthAggregated(roster, unit) ? 'Σ ' : ''}${strength.toLocaleString()}`);
  }
  if (unit.commander) parts.push(unit.commander);
  return parts.join(' · ');
}

function UnitBranch({
  roster,
  parentUnitId,
  factionId,
  selectedUnitId,
  onSelectUnit,
  onAddSubordinate,
}: {
  roster: ArmyRoster;
  parentUnitId: string | null;
  factionId: string;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onAddSubordinate: (unit: UnitDefinition) => void;
}) {
  const units = (
    parentUnitId === null
      ? unitChildren(roster, null).filter((unit) => unit.factionId === factionId)
      : unitChildren(roster, parentUnitId)
  ).filter((unit) => unit.factionId === factionId);

  if (units.length === 0) return null;

  return (
    <ul
      className={
        parentUnitId === null ? 'space-y-0.5' : 'ml-3 space-y-0.5 border-l border-[#ded3bd] pl-2'
      }
    >
      {units.map((unit) => {
        const selected = unit.id === selectedUnitId;
        const hasChildren = roster.units.some((candidate) => candidate.parentUnitId === unit.id);
        const displayName = unitDisplayName(roster, unit);

        return (
          <li key={unit.id}>
            <div className="flex items-start gap-1">
              <button
                type="button"
                data-testid={`oob-unit-${unit.id}`}
                aria-label={`Select unit ${displayName}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelectUnit(unit.id)}
                className={[
                  'min-w-0 flex-1 rounded-md border px-2 py-1.5 text-left transition-colors',
                  selected
                    ? 'border-[#7d916f] bg-[#eef1e4]'
                    : 'border-transparent hover:border-[#e2d8c3] hover:bg-[#f8f2e5]',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#c9bda3] bg-[#fbf7ed] text-[0.55rem] font-bold text-[#6b5d42]"
                  >
                    {ECHELON_SHORT[unit.echelon]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#3b352a]">
                    {displayName}
                  </span>
                  {hasChildren ? (
                    <span aria-hidden="true" className="text-[0.6rem] text-[#9b8f78]">
                      ›
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate pl-6 text-[0.62rem] text-[#7c715c]">
                  {unitMeta(roster, unit)}
                </span>
              </button>
              {canHaveSubordinates(roster, unit) ? (
                <button
                  type="button"
                  data-testid={`oob-add-subordinate-${unit.id}`}
                  aria-label={`Add subordinate to ${displayName}`}
                  title={`Add subordinate to ${displayName}`}
                  onClick={() => onAddSubordinate(unit)}
                  className="mt-0.5 shrink-0 rounded-md border border-[#c9bda3] bg-[#f8f2e5] px-2 py-1.5 text-xs font-bold text-[#5f594b] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2]"
                >
                  +
                </button>
              ) : null}
            </div>
            <UnitBranch
              roster={roster}
              parentUnitId={unit.id}
              factionId={factionId}
              selectedUnitId={selectedUnitId}
              onSelectUnit={onSelectUnit}
              onAddSubordinate={onAddSubordinate}
            />
          </li>
        );
      })}
    </ul>
  );
}

function FactionSection({
  roster,
  faction,
  selectedUnitId,
  onSelectUnit,
  onAddSubordinate,
}: {
  roster: ArmyRoster;
  faction: Faction;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onAddSubordinate: (unit: UnitDefinition) => void;
}) {
  const factionUnits = roster.units.filter((unit) => unit.factionId === faction.id);
  const roots = unitChildren(roster, null).filter((unit) => unit.factionId === faction.id);

  return (
    <section
      data-testid={`oob-faction-${faction.id}`}
      aria-label={`${faction.name} order of battle`}
    >
      <header className="flex items-center gap-2 px-1 py-1">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: faction.color }}
        />
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-[#4a4438]">
          {faction.name}
        </h3>
        <span className="text-[0.6rem] font-semibold text-[#8a7a58]">
          {factionUnits.length} unit{factionUnits.length === 1 ? '' : 's'}
        </span>
      </header>

      {roots.length === 0 ? (
        <p className="rounded border border-dashed border-[#ded3bd] px-2 py-1.5 text-[0.65rem] text-[#8a7a58]">
          No units in this faction yet.
        </p>
      ) : (
        <UnitBranch
          roster={roster}
          parentUnitId={null}
          factionId={faction.id}
          selectedUnitId={selectedUnitId}
          onSelectUnit={onSelectUnit}
          onAddSubordinate={onAddSubordinate}
        />
      )}
    </section>
  );
}

export function OrderOfBattlePanel({
  roster,
  selectedUnitId,
  onSelectUnit,
  onCreateUnit,
}: {
  roster: ArmyRoster;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onCreateUnit: (seed: { factionId: string; parentUnitId: string | null }) => void;
}) {
  return (
    <aside
      aria-label="Order of battle"
      className="flex w-72 shrink-0 flex-col border-r border-[#d8cdb5] bg-[#fbf7ed]"
    >
      <div className="border-b border-[#e0d6c1] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className={sectionHeadingClass}>Order of Battle</h3>
          <button
            type="button"
            className={primaryButtonClass}
            aria-label="Add unit"
            disabled={roster.factions.length === 0}
            onClick={() => {
              const faction = roster.factions[0];
              if (faction) onCreateUnit({ factionId: faction.id, parentUnitId: null });
            }}
          >
            + Unit
          </button>
        </div>
        <p className="mt-1 text-[0.65rem] text-[#7c715c]">
          {roster.units.length} unit{roster.units.length === 1 ? '' : 's'} across{' '}
          {roster.factions.length} faction{roster.factions.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {roster.factions.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#d8cdb5] px-3 py-6 text-center text-xs leading-5 text-[#7c715c]">
            No factions yet. Add a faction in the right sidebar, then build the chain of command.
          </p>
        ) : (
          roster.factions.map((faction) => (
            <FactionSection
              key={faction.id}
              roster={roster}
              faction={faction}
              selectedUnitId={selectedUnitId}
              onSelectUnit={onSelectUnit}
              onAddSubordinate={(unit) =>
                onCreateUnit({ factionId: unit.factionId, parentUnitId: unit.id })
              }
            />
          ))
        )}
      </div>
    </aside>
  );
}
