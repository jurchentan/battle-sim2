import { useMemo, useState } from 'react';
import type { ArmyRoster, UnitDefinition, UnitEchelon, UnitType } from '../../models';
import { useRosterStore } from '../../state/rosterStore';
import { ArmyField } from './ArmyField';
import {
  canHaveSubordinates,
  defaultSymbolStyle,
  defaultUnitStrength,
  draftUnitDisplayName,
  ECHELON_LABELS,
  ECHELON_ORDER,
  effectiveUnitStrength,
  eligibleParentUnits,
  findUnit,
  hierarchyPath,
  isStrengthAggregated,
  nextEchelonFor,
  unitChildren,
  unitDisplayName,
} from './rosterDocuments';
import {
  dangerButtonClass,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
  unitOptionLabel,
} from './ui';

const UNIT_TYPES: readonly UnitType[] = ['infantry', 'cavalry', 'artillery', 'other'];
const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
  other: 'Other',
};
const LABEL_POSITIONS: readonly UnitDefinition['defaultSymbolStyle']['labelPosition'][] = [
  'above',
  'below',
  'center',
];
const LABEL_POSITION_LABELS: Record<UnitDefinition['defaultSymbolStyle']['labelPosition'], string> =
  {
    above: 'Above the line',
    below: 'Below the line',
    center: 'Centered on the line',
  };

function typeLabel(value: UnitType): string {
  return UNIT_TYPE_LABELS[value];
}

function parentCandidates(
  roster: ArmyRoster,
  factionId: string,
  excludeUnitId?: string,
): UnitDefinition[] {
  return roster.units
    .filter((unit) => unit.factionId === factionId)
    .filter((unit) => unit.id !== excludeUnitId)
    .filter((unit) => canHaveSubordinates(roster, unit))
    .sort((a, b) => {
      const echelonDelta = ECHELON_ORDER.indexOf(a.echelon) - ECHELON_ORDER.indexOf(b.echelon);
      if (echelonDelta !== 0) return echelonDelta;
      return (
        unitDisplayName(roster, a).localeCompare(unitDisplayName(roster, b)) ||
        a.id.localeCompare(b.id)
      );
    });
}

function SymbolPreview({
  color,
  thickness,
  dash,
}: {
  color: string;
  thickness: number;
  dash: number[];
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 40"
      className="h-10 w-full rounded border border-[#e2d8c3] bg-[#f8f2e5]"
      preserveAspectRatio="none"
    >
      <line
        x1="18"
        y1="20"
        x2="162"
        y2="20"
        stroke={color}
        strokeWidth={Math.max(2, Math.min(12, thickness))}
        strokeDasharray={dash.length > 0 ? dash.join(' ') : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

function UnitCreateForm({
  roster,
  seed,
  onCreated,
  onCancel,
}: {
  roster: ArmyRoster;
  seed: { factionId: string; parentUnitId: string | null };
  onCreated: (unitId: string) => void;
  onCancel: () => void;
}) {
  const addUnit = useRosterStore((state) => state.addUnit);

  const parent = seed.parentUnitId ? findUnit(roster, seed.parentUnitId) : undefined;
  const initialFaction = roster.factions.some((faction) => faction.id === seed.factionId)
    ? seed.factionId
    : (roster.factions[0]?.id ?? '');
  const initialEchelon = nextEchelonFor(parent?.echelon ?? null);

  const [factionId, setFactionId] = useState(initialFaction);
  const [parentUnitId, setParentUnitId] = useState<string>(
    parent && parent.factionId === initialFaction ? parent.id : '',
  );
  const [echelon, setEchelon] = useState<UnitEchelon>(initialEchelon);
  const [customName, setCustomName] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('infantry');
  const [commander, setCommander] = useState('');
  const [strengthText, setStrengthText] = useState(() => {
    const strength = defaultUnitStrength('infantry', initialEchelon, roster.smallestUnitEchelon);
    return strength === null ? '' : String(strength);
  });
  const [strengthEdited, setStrengthEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const faction = roster.factions.find((candidate) => candidate.id === factionId);
  const candidates = parentCandidates(roster, factionId);
  const previewName = draftUnitDisplayName(roster, {
    factionId,
    echelon,
    commander,
    customName,
  });

  const defaultStrengthText = (type: UnitType, value: UnitEchelon): string => {
    const strength = defaultUnitStrength(type, value, roster.smallestUnitEchelon);
    return strength === null ? '' : String(strength);
  };

  const handleFactionChange = (nextFactionId: string): void => {
    setFactionId(nextFactionId);
    const currentParent = parentUnitId ? findUnit(roster, parentUnitId) : undefined;
    if (currentParent && currentParent.factionId !== nextFactionId) {
      setParentUnitId('');
      setEchelon('army');
      if (!strengthEdited) setStrengthText(defaultStrengthText(unitType, 'army'));
    }
  };

  const handleEchelonChange = (nextEchelon: UnitEchelon): void => {
    setEchelon(nextEchelon);
    if (!strengthEdited) setStrengthText(defaultStrengthText(unitType, nextEchelon));
  };

  const handleUnitTypeChange = (nextType: UnitType): void => {
    setUnitType(nextType);
    if (!strengthEdited) setStrengthText(defaultStrengthText(nextType, echelon));
  };

  const handleParentChange = (nextParentId: string): void => {
    setParentUnitId(nextParentId);
    const nextParent = nextParentId ? findUnit(roster, nextParentId) : undefined;
    const nextEchelon = nextEchelonFor(nextParent?.echelon ?? null);
    setEchelon(nextEchelon);
    if (!strengthEdited) setStrengthText(defaultStrengthText(unitType, nextEchelon));
  };

  const handleCreate = (): void => {
    setError(null);
    const strength = strengthText.trim() === '' ? null : Number(strengthText);
    if (strength !== null && (!Number.isFinite(strength) || strength < 0)) {
      setError('Initial strength must be a non-negative number, or left blank.');
      return;
    }

    const result = addUnit({
      factionId,
      customName,
      echelon,
      unitType,
      parentUnitId: parentUnitId || null,
      commander,
      initialStrength: strength,
      defaultSymbolStyle: faction ? defaultSymbolStyle(faction.color) : undefined,
      notes,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(result.id);
  };

  return (
    <div data-testid="unit-create-form" className="mx-auto w-full max-w-3xl px-6 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={sectionHeadingClass}>New formation</p>
          <h3 className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]">Add a unit</h3>
          <p className="mt-1 text-xs text-[#7c715c]">
            Named{' '}
            <span data-testid="unit-name-preview" className="font-semibold text-[#4a4438]">
              {previewName}
            </span>
            . Parent selection keeps the hierarchy valid and the default echelon follows the parent.
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </header>

      <div className="mt-4 grid gap-4 rounded-xl border border-[#d3c7ad] bg-[#fbf7ed]/90 p-5 md:grid-cols-2">
        <ArmyField label="Commander" hint="Free text; used by commander-style faction naming.">
          <input
            autoFocus
            type="text"
            value={commander}
            onChange={(event) => setCommander(event.target.value)}
            placeholder="Commander name"
            className={fieldClass}
          />
        </ArmyField>

        <ArmyField label="Custom name" hint="Leave blank to use the generated name.">
          <input
            type="text"
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder={previewName}
            className={fieldClass}
          />
        </ArmyField>

        <ArmyField label="Faction">
          <select
            value={factionId}
            onChange={(event) => handleFactionChange(event.target.value)}
            className={fieldClass}
          >
            {roster.factions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField label="Echelon">
          <select
            value={echelon}
            onChange={(event) => handleEchelonChange(event.target.value as UnitEchelon)}
            className={fieldClass}
          >
            {ECHELON_ORDER.map((value) => (
              <option key={value} value={value}>
                {ECHELON_LABELS[value]}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField label="Unit type">
          <select
            value={unitType}
            onChange={(event) => handleUnitTypeChange(event.target.value as UnitType)}
            className={fieldClass}
          >
            {UNIT_TYPES.map((value) => (
              <option key={value} value={value}>
                {typeLabel(value)}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField label="Parent formation" hint="Only units in the same faction can be parents.">
          <select
            value={parentUnitId}
            onChange={(event) => handleParentChange(event.target.value)}
            className={fieldClass}
          >
            <option value="">None (root formation)</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {unitOptionLabel(roster, candidate)}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField
          label="Initial strength"
          hint={
            defaultUnitStrength(unitType, echelon, roster.smallestUnitEchelon) === null
              ? 'Strength rolls up from subordinates at this echelon. Leave blank when unknown.'
              : `Prefilled with the default. Leave blank when strength is unknown.`
          }
        >
          <input
            type="number"
            min={0}
            step={1}
            value={strengthText}
            onChange={(event) => {
              setStrengthEdited(true);
              setStrengthText(event.target.value);
            }}
            className={fieldClass}
          />
        </ArmyField>

        <ArmyField label="Notes">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className={fieldClass}
          />
        </ArmyField>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-3 py-2 text-xs text-[#8b3a2f]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!factionId}
          onClick={handleCreate}
        >
          Create unit
        </button>
      </div>
    </div>
  );
}

interface UnitFormDraft {
  customName: string;
  echelon: UnitEchelon;
  unitType: UnitType;
  parentUnitId: string;
  commander: string;
  strengthText: string;
  notes: string;
}

function draftFromUnit(unit: UnitDefinition): UnitFormDraft {
  return {
    customName: unit.customName ?? '',
    echelon: unit.echelon,
    unitType: unit.unitType,
    parentUnitId: unit.parentUnitId ?? '',
    commander: unit.commander ?? '',
    strengthText: unit.initialStrength === null ? '' : String(unit.initialStrength),
    notes: unit.notes ?? '',
  };
}

function UnitEditForm({
  roster,
  unit,
  onAddSubordinate,
  onDeleted,
}: {
  roster: ArmyRoster;
  unit: UnitDefinition;
  onAddSubordinate: () => void;
  onDeleted: () => void;
}) {
  const updateUnit = useRosterStore((state) => state.updateUnit);
  const reparentUnit = useRosterStore((state) => state.reparentUnit);
  const deleteUnit = useRosterStore((state) => state.deleteUnit);

  const [draft, setDraft] = useState<UnitFormDraft>(() => draftFromUnit(unit));
  const [style, setStyle] = useState(() => structuredClone(unit.defaultSymbolStyle));
  const [dashText, setDashText] = useState(unit.defaultSymbolStyle.dash.join(' '));
  const [thicknessText, setThicknessText] = useState(String(unit.defaultSymbolStyle.thickness));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const faction = roster.factions.find((candidate) => candidate.id === unit.factionId);
  const displayName = unitDisplayName(roster, unit);
  const parents = useMemo(() => eligibleParentUnits(roster, unit.id), [roster, unit.id]);
  const path = hierarchyPath(roster, unit.id);
  const children = unitChildren(roster, unit.id);
  const aggregatedStrength = isStrengthAggregated(roster, unit);
  const effectiveStrength = effectiveUnitStrength(roster, unit.id);
  const canAddSubordinate = canHaveSubordinates(roster, unit);

  const report = (result: { ok: true } | { ok: false; error: string }): void => {
    setError(result.ok ? null : result.error);
  };

  const commitCustomName = (): void => {
    if (draft.customName.trim() === (unit.customName ?? '')) return;
    report(updateUnit(unit.id, { customName: draft.customName }));
  };

  const commitCommander = (): void => {
    if (draft.commander.trim() === (unit.commander ?? '')) return;
    report(updateUnit(unit.id, { commander: draft.commander }));
  };

  const commitNotes = (): void => {
    const nextNotes = draft.notes.trim() === '' ? undefined : draft.notes;
    if (nextNotes === unit.notes) return;
    report(updateUnit(unit.id, { notes: draft.notes }));
  };

  const commitStrength = (): void => {
    const raw = draft.strengthText.trim();
    if (raw === '') {
      if (unit.initialStrength === null) return;
      report(updateUnit(unit.id, { initialStrength: null }));
      return;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError('Initial strength must be a non-negative number, or left blank.');
      return;
    }
    if (value === unit.initialStrength) return;
    report(updateUnit(unit.id, { initialStrength: value }));
  };

  const commitStyle = (nextStyle: UnitDefinition['defaultSymbolStyle']): void => {
    report(updateUnit(unit.id, { defaultSymbolStyle: nextStyle }));
  };

  const commitThickness = (): void => {
    const value = Number(thicknessText);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Symbol thickness must be a positive number.');
      return;
    }
    if (value === style.thickness) return;
    const nextStyle = { ...style, thickness: value };
    setStyle(nextStyle);
    commitStyle(nextStyle);
  };

  const commitDash = (): void => {
    const tokens = dashText.trim() === '' ? [] : dashText.trim().split(/[\s,]+/);
    const dash = tokens.map(Number);
    if (dash.some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Dash lengths must be non-negative numbers separated by spaces or commas.');
      return;
    }

    const nextStyle = { ...style, dash };
    setStyle(nextStyle);
    commitStyle(nextStyle);
  };

  const handleDelete = (): void => {
    const result = deleteUnit(unit.id);
    if (result.ok) {
      onDeleted();
    } else {
      setError(result.error);
    }
  };

  return (
    <div data-testid="unit-editor" className="mx-auto w-full max-w-3xl px-6 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={sectionHeadingClass}>
            {faction ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: faction.color }}
                />
                {faction.name}
              </span>
            ) : (
              'Unknown faction'
            )}
          </p>
          <h3 className="font-display mt-1 truncate text-2xl font-semibold text-[#2f2b23]">
            {displayName}
          </h3>
          <p className="mt-1 text-xs text-[#7c715c]">
            {path.map((ancestor) => unitDisplayName(roster, ancestor)).join(' → ') ||
              'Root formation'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canAddSubordinate ? (
            <button
              type="button"
              className={secondaryButtonClass}
              aria-label="Add subordinate unit"
              onClick={onAddSubordinate}
            >
              + Subordinate
            </button>
          ) : null}
          {confirmDelete ? (
            <>
              <span className="text-[0.68rem] font-semibold text-[#8b3a2f]">Delete this unit?</span>
              <button type="button" className={dangerButtonClass} onClick={handleDelete}>
                Confirm delete unit
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={dangerButtonClass}
              aria-label="Delete unit"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </header>

      <div className="mt-4 grid gap-4 rounded-xl border border-[#d3c7ad] bg-[#fbf7ed]/90 p-5 md:grid-cols-2">
        <ArmyField label="Commander" hint="Free text; used by commander-style faction naming.">
          <input
            type="text"
            value={draft.commander}
            onChange={(event) =>
              setDraft((current) => ({ ...current, commander: event.target.value }))
            }
            onBlur={commitCommander}
            placeholder="Commander name"
            className={fieldClass}
          />
        </ArmyField>

        <ArmyField label="Custom name" hint="Overrides the generated name when set.">
          <input
            type="text"
            value={draft.customName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, customName: event.target.value }))
            }
            onBlur={commitCustomName}
            placeholder={displayName}
            className={fieldClass}
          />
        </ArmyField>

        <ArmyField
          label="Faction"
          hint="Faction changes use safe reparenting in the library; create a new unit to switch sides."
        >
          <input
            type="text"
            value={faction?.name ?? 'Unknown faction'}
            readOnly
            className={fieldClass}
          />
        </ArmyField>

        <ArmyField label="Echelon">
          <select
            value={draft.echelon}
            onChange={(event) => {
              const echelon = event.target.value as UnitEchelon;
              const result = updateUnit(unit.id, { echelon });
              if (result.ok) {
                setDraft((current) => ({ ...current, echelon }));
              }
              report(result);
            }}
            className={fieldClass}
          >
            {ECHELON_ORDER.map((value) => (
              <option key={value} value={value}>
                {ECHELON_LABELS[value]}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField label="Unit type">
          <select
            value={draft.unitType}
            onChange={(event) => {
              const unitType = event.target.value as UnitType;
              setDraft((current) => ({ ...current, unitType }));
              report(updateUnit(unit.id, { unitType }));
            }}
            className={fieldClass}
          >
            {UNIT_TYPES.map((value) => (
              <option key={value} value={value}>
                {typeLabel(value)}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField
          label="Parent formation"
          hint="Descendants and other factions are excluded to prevent cycles."
        >
          <select
            value={draft.parentUnitId}
            onChange={(event) => {
              const parentUnitId = event.target.value || null;
              const result = reparentUnit(unit.id, parentUnitId);
              if (result.ok) {
                setDraft((current) => ({ ...current, parentUnitId: parentUnitId ?? '' }));
              }
              report(result);
            }}
            className={fieldClass}
          >
            <option value="">None (root formation)</option>
            {parents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {unitOptionLabel(roster, candidate)}
              </option>
            ))}
          </select>
        </ArmyField>

        <ArmyField
          label={aggregatedStrength ? 'Aggregated strength' : 'Initial strength'}
          hint={
            aggregatedStrength
              ? 'Total strength of this formation’s subordinates. Edit the smallest units to change it.'
              : 'Leave blank when strength is unknown or not applicable.'
          }
        >
          {aggregatedStrength ? (
            <input
              type="text"
              readOnly
              value={
                effectiveStrength === null
                  ? 'No subordinate strength'
                  : effectiveStrength.toLocaleString()
              }
              className={fieldClass}
            />
          ) : (
            <input
              type="number"
              min={0}
              step={1}
              value={draft.strengthText}
              onChange={(event) =>
                setDraft((current) => ({ ...current, strengthText: event.target.value }))
              }
              onBlur={commitStrength}
              className={fieldClass}
            />
          )}
        </ArmyField>

        <ArmyField label="Notes">
          <textarea
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            onBlur={commitNotes}
            rows={2}
            className={fieldClass}
          />
        </ArmyField>

        <div className="md:col-span-2">
          <h4 className={sectionHeadingClass}>Default symbol style</h4>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <ArmyField label="Symbol color">
              <input
                type="color"
                value={style.color}
                onChange={(event) =>
                  setStyle((current) => ({ ...current, color: event.target.value }))
                }
                onBlur={() => {
                  if (style.color !== unit.defaultSymbolStyle.color) commitStyle(style);
                }}
                className="h-9 w-full cursor-pointer rounded border border-[#cfc3a8] bg-white p-1"
              />
            </ArmyField>

            <ArmyField label="Symbol thickness">
              <input
                type="number"
                min={1}
                step={1}
                value={thicknessText}
                onChange={(event) => setThicknessText(event.target.value)}
                onBlur={commitThickness}
                className={fieldClass}
              />
            </ArmyField>

            <ArmyField
              label="Symbol dash"
              hint="Space-separated lengths, for example 14 5. Blank is solid."
            >
              <input
                type="text"
                value={dashText}
                onChange={(event) => setDashText(event.target.value)}
                onBlur={commitDash}
                className={fieldClass}
              />
            </ArmyField>

            <ArmyField label="Label position">
              <select
                value={style.labelPosition}
                onChange={(event) => {
                  const labelPosition = event.target
                    .value as UnitDefinition['defaultSymbolStyle']['labelPosition'];
                  const nextStyle = { ...style, labelPosition };
                  setStyle(nextStyle);
                  commitStyle(nextStyle);
                }}
                className={fieldClass}
              >
                {LABEL_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {LABEL_POSITION_LABELS[position]}
                  </option>
                ))}
              </select>
            </ArmyField>

            <div className="md:col-span-2">
              <SymbolPreview color={style.color} thickness={style.thickness} dash={style.dash} />
            </div>
          </div>
        </div>
      </div>

      {children.length > 0 ? (
        <p className="mt-3 text-[0.68rem] text-[#7c715c]">
          {children.length} direct subordinate{children.length === 1 ? '' : 's'}:{' '}
          {children.map((child) => unitDisplayName(roster, child)).join(', ')}. Reparent or delete
          them first to remove this formation.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-3 py-2 text-xs text-[#8b3a2f]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function UnitEditorPanel({
  roster,
  selectedUnitId,
  createSeed,
  onSelectUnit,
  onStartCreate,
  onCancelCreate,
}: {
  roster: ArmyRoster;
  selectedUnitId: string | null;
  createSeed: { factionId: string; parentUnitId: string | null } | null;
  onSelectUnit: (unitId: string | null) => void;
  onStartCreate: (seed: { factionId: string; parentUnitId: string | null }) => void;
  onCancelCreate: () => void;
}) {
  const selectedUnit = selectedUnitId ? findUnit(roster, selectedUnitId) : undefined;

  if (createSeed) {
    const faction = roster.factions.find((candidate) => candidate.id === createSeed.factionId);
    if (faction) {
      return (
        <UnitCreateForm
          roster={roster}
          seed={createSeed}
          onCreated={(unitId) => onSelectUnit(unitId)}
          onCancel={onCancelCreate}
        />
      );
    }
  }

  if (selectedUnit) {
    return (
      <UnitEditForm
        key={`${selectedUnit.id}:${JSON.stringify(selectedUnit)}`}
        roster={roster}
        unit={selectedUnit}
        onAddSubordinate={() =>
          onStartCreate({ factionId: selectedUnit.factionId, parentUnitId: selectedUnit.id })
        }
        onDeleted={() => onSelectUnit(null)}
      />
    );
  }

  const firstFaction = roster.factions[0];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8">
      <header>
        <p className={sectionHeadingClass}>Roster workspace</p>
        <h3 className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]">
          Build the chain of command
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b6353]">
          Select a unit in the order of battle to edit its commander, custom name, strength, type,
          notes, and symbol style. The roster setting controls the smallest echelon; formations
          above it roll up the strength of their subordinates. Use the + button beside a formation
          to add a subordinate directly.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        {(['army', 'corps', 'division', 'brigade'] as const).map((echelon) => (
          <div
            key={echelon}
            className="rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2.5"
          >
            <p className="text-[0.6rem] font-semibold tracking-[0.12em] text-[#8a7a58] uppercase">
              {ECHELON_LABELS[echelon]}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#3b352a]">
              {roster.units.filter((unit) => unit.echelon === echelon).length}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-[#d8cdb5] bg-[#fbf7ed]/70 px-5 py-6">
        <p className="text-sm text-[#6b6353]">
          {firstFaction
            ? 'Choose a formation on the left, or add a new unit to this roster.'
            : 'Add a faction in the right sidebar before creating units.'}
        </p>
        <div className="mt-3">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={!firstFaction}
            onClick={() => {
              if (firstFaction) {
                onStartCreate({ factionId: firstFaction.id, parentUnitId: null });
              }
            }}
          >
            Add the first unit
          </button>
        </div>
      </div>
    </div>
  );
}
