import { useEffect, useState } from 'react';
import type {
  ArmyRoster,
  BattleScenario,
  UnitDefinition,
  UnitEchelon,
  UnitType,
} from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import { ArmyField } from '../army/ArmyField';
import {
  canEchelonBeSubordinateOf,
  canHaveSubordinates,
  defaultUnitStrength,
  draftUnitDisplayName,
  ECHELON_LABELS,
  ECHELON_ORDER,
  findUnit,
  nextEchelonFor,
  unitDisplayName,
} from '../army/rosterDocuments';
import { fieldClass, primaryButtonClass, secondaryButtonClass, unitOptionLabel } from '../army/ui';

const UNIT_TYPES: readonly UnitType[] = ['infantry', 'cavalry', 'artillery', 'other'];
const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
  other: 'Other',
};

function parentCandidates(
  roster: ArmyRoster,
  factionId: string,
  childEchelon: UnitEchelon,
): UnitDefinition[] {
  return roster.units
    .filter((unit) => unit.factionId === factionId)
    .filter((unit) => canHaveSubordinates(roster, unit))
    .filter((unit) => canEchelonBeSubordinateOf(childEchelon, unit.echelon))
    .sort((a, b) => {
      const echelonDelta = ECHELON_ORDER.indexOf(a.echelon) - ECHELON_ORDER.indexOf(b.echelon);
      if (echelonDelta !== 0) return echelonDelta;
      return (
        unitDisplayName(roster, a).localeCompare(unitDisplayName(roster, b)) ||
        a.id.localeCompare(b.id)
      );
    });
}

export function ScenarioAddUnitDialog({
  scenario,
  seed,
  onClose,
}: {
  scenario: BattleScenario;
  seed?: { factionId?: string; parentUnitId?: string | null };
  onClose: () => void;
}) {
  const roster = scenario.orderOfBattle;
  const addUnit = useScenarioStore((state) => state.addUnit);
  const selectUnit = useScenarioEditorStore((state) => state.selectUnit);
  const beginPlacement = useScenarioEditorStore((state) => state.beginPlacement);

  const seedParent = seed?.parentUnitId ? findUnit(roster, seed.parentUnitId) : undefined;
  const initialFactionId =
    (seed?.factionId && roster.factions.some((faction) => faction.id === seed.factionId)
      ? seed.factionId
      : undefined) ??
    seedParent?.factionId ??
    roster.factions[0]?.id ??
    '';
  const initialParentId =
    seedParent && seedParent.factionId === initialFactionId ? seedParent.id : '';
  const initialEchelon = nextEchelonFor(seedParent?.echelon ?? null);
  const initialFaction = roster.factions.find((candidate) => candidate.id === initialFactionId);
  const initialStrength =
    initialEchelon === 'brigade'
      ? defaultUnitStrength(initialFaction, 'infantry', initialEchelon, roster.smallestUnitEchelon)
      : null;

  const [factionId, setFactionId] = useState(initialFactionId);
  const [parentUnitId, setParentUnitId] = useState(initialParentId);
  const [echelon, setEchelon] = useState<UnitEchelon>(initialEchelon);
  const [unitType, setUnitType] = useState<UnitType>('infantry');
  const [customName, setCustomName] = useState('');
  const [commander, setCommander] = useState('');
  const [strengthText, setStrengthText] = useState(
    initialStrength === null ? '' : String(initialStrength),
  );
  const [strengthEdited, setStrengthEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const candidates = parentCandidates(roster, factionId, echelon);
  const previewName = draftUnitDisplayName(roster, {
    factionId,
    echelon,
    parentUnitId: parentUnitId || null,
    commander,
    customName,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const defaultStrengthText = (
    type: UnitType,
    value: UnitEchelon,
    targetFactionId = factionId,
  ): string => {
    if (value !== 'brigade') return '';
    const targetFaction = roster.factions.find((candidate) => candidate.id === targetFactionId);
    const strength = defaultUnitStrength(targetFaction, type, value, roster.smallestUnitEchelon);
    return strength === null ? '' : String(strength);
  };

  const handleFactionChange = (nextFactionId: string): void => {
    setFactionId(nextFactionId);
    const currentParent = parentUnitId ? findUnit(roster, parentUnitId) : undefined;
    if (currentParent && currentParent.factionId !== nextFactionId) {
      setParentUnitId('');
      setEchelon('army');
    }
    if (!strengthEdited) setStrengthText(defaultStrengthText(unitType, echelon, nextFactionId));
  };

  const handleEchelonChange = (nextEchelon: UnitEchelon): void => {
    setEchelon(nextEchelon);
    const currentParent = parentUnitId ? findUnit(roster, parentUnitId) : undefined;
    if (currentParent && !canEchelonBeSubordinateOf(nextEchelon, currentParent.echelon)) {
      setParentUnitId('');
    }
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

  const handleAdd = (place: boolean): void => {
    setError(null);
    if (!factionId) {
      setError('Add a faction before creating a formation.');
      return;
    }

    let initialStrength: number | null = null;
    if (echelon === 'brigade') {
      const raw = strengthText.trim();
      if (raw !== '') {
        initialStrength = Number(raw);
        if (!Number.isFinite(initialStrength) || initialStrength < 0) {
          setError('Initial strength must be a non-negative number, or left blank.');
          return;
        }
      }
    }

    const result = addUnit({
      factionId,
      customName,
      echelon,
      unitType,
      parentUnitId: parentUnitId || null,
      commander,
      initialStrength,
      notes,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    selectUnit(result.id);
    if (place) beginPlacement(result.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2b23]/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-add-unit-heading"
        data-testid="scenario-add-unit-dialog"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            Scenario order of battle
          </p>
          <h2
            id="scenario-add-unit-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            Add a formation
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            Named{' '}
            <span data-testid="scenario-unit-name-preview" className="font-semibold text-[#4a4438]">
              {roster.factions.length > 0 ? previewName : '—'}
            </span>
            . Adding a formation does not deploy it; use Add and place to put it on the map now.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {roster.factions.length === 0 ? (
            <p
              role="alert"
              className="rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-3 py-2 text-xs text-[#8b3a2f]"
            >
              Add a faction to this scenario before creating formations.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
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

              <ArmyField label="Parent formation" hint="Only the same faction can be a parent.">
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
                      {UNIT_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
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

              <ArmyField
                label="Commander"
                hint="Free text; used by commander-style faction naming."
              >
                <input
                  type="text"
                  value={commander}
                  onChange={(event) => setCommander(event.target.value)}
                  placeholder="Commander name"
                  className={fieldClass}
                />
              </ArmyField>

              <ArmyField
                label="Initial strength"
                hint={
                  echelon === 'brigade'
                    ? 'Brigades carry their own strength. Leave blank when unknown.'
                    : 'Strength rolls up from brigades.'
                }
              >
                {echelon === 'brigade' ? (
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
                ) : (
                  <input
                    type="text"
                    readOnly
                    value="Rolls up from brigades"
                    className={fieldClass}
                  />
                )}
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
          )}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-3 py-2 text-xs text-[#8b3a2f]"
            >
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e0d6c1] bg-[#f8f2e5] px-5 py-3">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={roster.factions.length === 0}
            onClick={() => handleAdd(false)}
          >
            Add formation
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={roster.factions.length === 0}
            onClick={() => handleAdd(true)}
          >
            Add and place
          </button>
        </footer>
      </div>
    </div>
  );
}
