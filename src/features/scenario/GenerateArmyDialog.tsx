import { useEffect, useMemo, useState } from 'react';
import type { BattleScenario, UnitType } from '../../models';
import { useScenarioStore } from '../../state/scenarioStore';
import {
  armyPlanSummaryLabel,
  GENERATOR_ARMS,
  planArmy,
  type ArmyGeneratorInput,
  type ArmyPlanNode,
  type ArmyStrengthMode,
  type ArmyStructure,
  type GeneratorArm,
} from '../army/armyGenerator';
import { nextFactionColor } from '../army/FactionForm';
import { ECHELON_LABELS } from '../army/rosterDocuments';
import { ArmyField } from '../army/ArmyField';
import { fieldClass, primaryButtonClass, secondaryButtonClass } from '../army/ui';

const ARM_LABELS: Record<GeneratorArm, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
};

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
  other: 'Other',
};

const STRUCTURE_OPTIONS: readonly { value: ArmyStructure; label: string }[] = [
  { value: 'independent', label: 'Independent brigades' },
  { value: 'divisions', label: 'Divisions' },
  { value: 'corps', label: 'Corps' },
  { value: 'army', label: 'Army' },
];

const STRENGTH_MODE_OPTIONS: readonly { value: ArmyStrengthMode; label: string }[] = [
  { value: 'average', label: 'Rough average per brigade' },
  { value: 'total', label: 'Exact total personnel' },
];

interface ArmDraft {
  brigadeCount: string;
  strengthMode: ArmyStrengthMode;
  strengthValue: string;
}

const DEFAULT_ARM_DRAFTS: Record<GeneratorArm, ArmDraft> = {
  infantry: { brigadeCount: '9', strengthMode: 'average', strengthValue: '3000' },
  cavalry: { brigadeCount: '3', strengthMode: 'average', strengthValue: '900' },
  artillery: { brigadeCount: '2', strengthMode: 'average', strengthValue: '800' },
};

function parseNumber(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? 0 : Number(trimmed);
}

function formatStrength(value: number): string {
  return Math.round(value).toLocaleString();
}

function armTotal(arm: ArmDraft): number {
  const count = parseNumber(arm.brigadeCount);
  const value = parseNumber(arm.strengthValue);
  if (!Number.isFinite(count) || !Number.isFinite(value) || count <= 0) return 0;
  return arm.strengthMode === 'total' ? value : count * value;
}

function planNodeLabel(node: ArmyPlanNode): string {
  if (node.customName) return node.customName;
  if (node.echelon === 'army') return 'Army';
  const typeLabel = node.unitType === 'other' ? '' : ` · ${UNIT_TYPE_LABELS[node.unitType]}`;
  return `${ECHELON_LABELS[node.echelon]}${typeLabel}`;
}

function PlanTree({ nodes, depth = 0 }: { nodes: readonly ArmyPlanNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {nodes.map((node, index) => (
        <li key={`${depth}:${index}:${node.echelon}:${node.unitType}`}>
          <div
            className="flex items-baseline justify-between gap-2 rounded border border-[#e2d8c3] bg-white/50 px-2 py-1"
            style={{ marginLeft: depth * 12 }}
          >
            <span className="min-w-0 truncate text-[0.68rem] font-medium text-[#4a4438]">
              {planNodeLabel(node)}
            </span>
            {node.echelon === 'brigade' && node.initialStrength !== null ? (
              <span className="shrink-0 text-[0.6rem] tabular-nums text-[#857a64]">
                {formatStrength(node.initialStrength)}
              </span>
            ) : null}
          </div>
          {node.children.length > 0 ? <PlanTree nodes={node.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function GenerateArmyDialog({
  scenario,
  onClose,
}: {
  scenario: BattleScenario;
  onClose: () => void;
}) {
  const generateArmy = useScenarioStore((state) => state.generateArmy);
  const roster = scenario.orderOfBattle;

  const [factionMode, setFactionMode] = useState<'existing' | 'new'>(
    roster.factions.length > 0 ? 'existing' : 'new',
  );
  const [existingFactionId, setExistingFactionId] = useState(roster.factions[0]?.id ?? '');
  const [newFactionName, setNewFactionName] = useState('New faction');
  const [newFactionColor, setNewFactionColor] = useState(() => nextFactionColor(roster.factions));
  const [structure, setStructure] = useState<ArmyStructure>('divisions');
  const [brigadesPerDivision, setBrigadesPerDivision] = useState('3');
  const [divisionsPerCorps, setDivisionsPerCorps] = useState('2');
  const [armyName, setArmyName] = useState('');
  const [armDrafts, setArmDrafts] = useState<Record<GeneratorArm, ArmDraft>>(DEFAULT_ARM_DRAFTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const generatorInput = useMemo<ArmyGeneratorInput>(
    () => ({
      faction:
        factionMode === 'existing'
          ? { kind: 'existing', factionId: existingFactionId }
          : { kind: 'new', name: newFactionName, color: newFactionColor },
      structure,
      ...(structure === 'independent'
        ? {}
        : { brigadesPerDivision: parseNumber(brigadesPerDivision) }),
      ...(structure === 'corps' || structure === 'army'
        ? { divisionsPerCorps: parseNumber(divisionsPerCorps) }
        : {}),
      ...(structure === 'army' && armyName.trim() ? { armyName } : {}),
      arms: GENERATOR_ARMS.map((unitType) => ({
        unitType,
        brigadeCount: parseNumber(armDrafts[unitType].brigadeCount),
        strengthMode: armDrafts[unitType].strengthMode,
        strengthValue: parseNumber(armDrafts[unitType].strengthValue),
      })),
    }),
    [
      armDrafts,
      armyName,
      brigadesPerDivision,
      divisionsPerCorps,
      existingFactionId,
      factionMode,
      newFactionColor,
      newFactionName,
      structure,
    ],
  );

  const plan = useMemo(() => planArmy(generatorInput), [generatorInput]);
  const armyTotal = GENERATOR_ARMS.reduce((total, arm) => total + armTotal(armDrafts[arm]), 0);
  const factionError =
    factionMode === 'existing'
      ? !existingFactionId
        ? 'Choose a faction for the generated army.'
        : null
      : !newFactionName.trim()
        ? 'Enter a name for the new faction.'
        : null;
  const commitError = factionError ?? (plan.ok ? null : plan.error);

  const updateArm = (arm: GeneratorArm, patch: Partial<ArmDraft>): void => {
    setArmDrafts((current) => ({ ...current, [arm]: { ...current[arm], ...patch } }));
  };

  const handleGenerate = (): void => {
    setError(null);
    if (factionError) {
      setError(factionError);
      return;
    }

    const result = generateArmy(generatorInput);
    if (!result.ok) {
      setError(result.error);
      return;
    }
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
        aria-labelledby="generate-army-heading"
        data-testid="generate-army-dialog"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            Scenario order of battle
          </p>
          <h2
            id="generate-army-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            Generate an army
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            Build a homogeneous army from per-arm brigade counts. The whole army is appended as one
            undoable edit and is not deployed automatically.
          </p>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] p-3">
              <h3 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                Faction
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                <select
                  aria-label="Generator faction"
                  value={factionMode === 'existing' ? existingFactionId : '__new__'}
                  onChange={(event) => {
                    if (event.target.value === '__new__') {
                      setFactionMode('new');
                    } else {
                      setFactionMode('existing');
                      setExistingFactionId(event.target.value);
                    }
                  }}
                  className={fieldClass}
                >
                  {roster.factions.map((faction) => (
                    <option key={faction.id} value={faction.id}>
                      {faction.name}
                    </option>
                  ))}
                  <option value="__new__">New faction…</option>
                </select>

                {factionMode === 'new' ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <ArmyField label="New faction name">
                      <input
                        type="text"
                        value={newFactionName}
                        onChange={(event) => setNewFactionName(event.target.value)}
                        className={fieldClass}
                      />
                    </ArmyField>
                    <ArmyField label="Color">
                      <input
                        type="color"
                        value={newFactionColor}
                        onChange={(event) => setNewFactionColor(event.target.value)}
                        className="h-8 w-full min-w-20 cursor-pointer rounded border border-[#cfc3a8] bg-white p-1"
                      />
                    </ArmyField>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] p-3">
              <h3 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                Structure
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <ArmyField label="Command structure">
                  <select
                    value={structure}
                    onChange={(event) => setStructure(event.target.value as ArmyStructure)}
                    className={fieldClass}
                  >
                    {STRUCTURE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </ArmyField>

                {structure !== 'independent' ? (
                  <ArmyField label="Brigades per division">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={brigadesPerDivision}
                      onChange={(event) => setBrigadesPerDivision(event.target.value)}
                      className={fieldClass}
                    />
                  </ArmyField>
                ) : null}

                {structure === 'corps' || structure === 'army' ? (
                  <ArmyField label="Divisions per corps">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={divisionsPerCorps}
                      onChange={(event) => setDivisionsPerCorps(event.target.value)}
                      className={fieldClass}
                    />
                  </ArmyField>
                ) : null}

                {structure === 'army' ? (
                  <ArmyField label="Army name" hint="Optional; otherwise the naming rules apply.">
                    <input
                      type="text"
                      value={armyName}
                      onChange={(event) => setArmyName(event.target.value)}
                      placeholder="Army name"
                      className={fieldClass}
                    />
                  </ArmyField>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                  Arms
                </h3>
                <span className="text-[0.62rem] font-semibold text-[#6b5d42]">
                  Army total: {formatStrength(armyTotal)}
                </span>
              </div>

              <div className="mt-2 space-y-2">
                {GENERATOR_ARMS.map((arm) => {
                  const draft = armDrafts[arm];
                  return (
                    <div
                      key={arm}
                      data-testid={`generator-arm-${arm}`}
                      className="grid gap-1.5 rounded-md border border-[#e2d8c3] bg-white/50 p-2 sm:grid-cols-[5.5rem_4.5rem_1fr_5.5rem_5rem] sm:items-end"
                    >
                      <p className="text-xs font-semibold text-[#4a4438] sm:pb-1.5">
                        {ARM_LABELS[arm]}
                      </p>
                      <ArmyField label="Brigades">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          aria-label={`${ARM_LABELS[arm]} brigades`}
                          value={draft.brigadeCount}
                          onChange={(event) => updateArm(arm, { brigadeCount: event.target.value })}
                          className={fieldClass}
                        />
                      </ArmyField>
                      <ArmyField label="Strength mode">
                        <select
                          aria-label={`${ARM_LABELS[arm]} strength mode`}
                          value={draft.strengthMode}
                          onChange={(event) =>
                            updateArm(arm, {
                              strengthMode: event.target.value as ArmyStrengthMode,
                            })
                          }
                          className={fieldClass}
                        >
                          {STRENGTH_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </ArmyField>
                      <ArmyField label={draft.strengthMode === 'total' ? 'Total' : 'Per brigade'}>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          aria-label={`${ARM_LABELS[arm]} strength value`}
                          value={draft.strengthValue}
                          onChange={(event) =>
                            updateArm(arm, { strengthValue: event.target.value })
                          }
                          className={fieldClass}
                        />
                      </ArmyField>
                      <div className="text-right text-[0.62rem] text-[#6b5d42] sm:pb-1.5">
                        <span className="block text-[0.55rem] uppercase tracking-wide text-[#8a7a58]">
                          Total
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatStrength(armTotal(draft))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="flex min-h-0 flex-col rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] p-3">
            <h3 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
              Preview
            </h3>
            {plan.ok ? (
              <>
                <p
                  data-testid="generator-summary"
                  className="mt-1 text-[0.68rem] leading-4 text-[#6b5d42]"
                >
                  {armyPlanSummaryLabel(plan.summary)} ·{' '}
                  {formatStrength(plan.summary.totalStrength)} personnel
                </p>
                <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
                  <PlanTree nodes={plan.roots} />
                </div>
              </>
            ) : (
              <p
                role="alert"
                className="mt-2 rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-2 py-1.5 text-[0.68rem] text-[#8b3a2f]"
              >
                {plan.error}
              </p>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0d6c1] bg-[#f8f2e5] px-5 py-3">
          <div className="min-w-0">
            {error ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {error}
              </p>
            ) : commitError ? (
              <p className="text-[0.68rem] text-[#8b3a2f]">{commitError}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={Boolean(commitError)}
              onClick={handleGenerate}
            >
              Generate army
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
