import { useState } from 'react';
import {
  defaultFactionNamingModes,
  defaultFactionStrengths,
  type ArmyRoster,
  type Faction,
  type FactionDefaultStrengths,
  type FactionNamingMode,
  type FactionNamingModes,
  type UnitEchelon,
} from '../../models';
import { useRosterStore } from '../../state/rosterStore';
import { ArmyField } from './ArmyField';
import { ECHELON_LABELS, ECHELON_ORDER } from './rosterDocuments';
import {
  dangerButtonClass,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
} from './ui';

const FACTION_COLORS = ['#2f5d8a', '#9b3b34', '#4f6b45', '#8a6a2f', '#6b4d78', '#3f6b6b'] as const;

const NAMING_MODE_LABELS: Record<FactionNamingMode, string> = {
  'numeric-universal': 'Universal numbers',
  'numeric-local': 'Local numbers',
  commander: 'Commander name',
};

const STRENGTH_TYPES = ['infantry', 'cavalry', 'artillery'] as const;
type StrengthType = (typeof STRENGTH_TYPES)[number];

const STRENGTH_TYPE_LABELS: Record<StrengthType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
};

type StrengthDraft = Record<StrengthType, Record<UnitEchelon, string>>;

function strengthDraftFrom(strengths: FactionDefaultStrengths): StrengthDraft {
  const draft = {} as StrengthDraft;
  for (const type of STRENGTH_TYPES) {
    draft[type] = {} as Record<UnitEchelon, string>;
    for (const echelon of ECHELON_ORDER) {
      draft[type][echelon] = String(strengths[type][echelon]);
    }
  }
  return draft;
}

function parseStrengthDraft(draft: StrengthDraft): FactionDefaultStrengths | null {
  const strengths = {} as FactionDefaultStrengths;
  for (const type of STRENGTH_TYPES) {
    strengths[type] = {} as Record<UnitEchelon, number>;
    for (const echelon of ECHELON_ORDER) {
      const raw = draft[type][echelon].trim();
      const value = raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(value) || value < 0) return null;
      strengths[type][echelon] = value;
    }
  }
  return strengths;
}

function namingSummary(modes: FactionNamingModes): string {
  const values = new Set(Object.values(modes));
  if (values.size > 1) return 'Mixed naming';

  const mode = modes.army;
  return mode === 'commander'
    ? 'Commander names'
    : mode === 'numeric-local'
      ? 'Local numbers'
      : 'Universal numbers';
}

function nextFactionColor(factions: readonly Faction[]): string {
  return FACTION_COLORS[factions.length % FACTION_COLORS.length] ?? FACTION_COLORS[0];
}

export function RosterSettingsPanel() {
  const roster = useRosterStore((state) => state.document);
  const setSmallestUnitEchelon = useRosterStore((state) => state.setSmallestUnitEchelon);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (echelon: UnitEchelon): void => {
    const result = setSmallestUnitEchelon(echelon);
    setError(result.ok ? null : result.error);
  };

  return (
    <section aria-label="Roster settings" data-testid="roster-settings">
      <h3 className={sectionHeadingClass}>Roster settings</h3>
      <div className="mt-2 rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2.5">
        <ArmyField
          label="Smallest unit"
          hint="Formations above this echelon total the strength of their subordinates."
        >
          <select
            value={roster.smallestUnitEchelon}
            onChange={(event) => handleChange(event.target.value as UnitEchelon)}
            className={fieldClass}
          >
            {ECHELON_ORDER.map((echelon) => (
              <option key={echelon} value={echelon}>
                {ECHELON_LABELS[echelon]}
              </option>
            ))}
          </select>
        </ArmyField>
        <p className="mt-2 text-[0.65rem] leading-4 text-[#7c715c]">
          Units at or below {ECHELON_LABELS[roster.smallestUnitEchelon]} carry their own strength.
          {roster.smallestUnitEchelon === 'other'
            ? ''
            : ` Formations above ${ECHELON_LABELS[roster.smallestUnitEchelon]} total their descendants.`}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded border border-[#d3b3a8] bg-[#f9ede8] px-2 py-1.5 text-[0.68rem] text-[#8b3a2f]"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function FactionForm({
  roster,
  initial,
  onDone,
  onCancel,
}: {
  roster: ArmyRoster;
  initial?: Faction;
  onDone: () => void;
  onCancel: () => void;
}) {
  const addFaction = useRosterStore((state) => state.addFaction);
  const updateFaction = useRosterStore((state) => state.updateFaction);

  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? nextFactionColor(roster.factions));
  const [labelColor, setLabelColor] = useState(initial?.labelColor ?? '#f7f2e6');
  const [namingModes, setNamingModes] = useState<FactionNamingModes>(() =>
    structuredClone(initial?.namingModes ?? defaultFactionNamingModes()),
  );
  const [strengthDraft, setStrengthDraft] = useState<StrengthDraft>(() =>
    strengthDraftFrom(initial?.defaultStrengths ?? defaultFactionStrengths()),
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setError('A faction name is required.');
      return;
    }

    const defaultStrengths = parseStrengthDraft(strengthDraft);
    if (!defaultStrengths) {
      setError('Default strengths must be non-negative numbers.');
      return;
    }

    const values = {
      name,
      color,
      labelColor,
      namingModes,
      defaultStrengths,
      notes: notes.trim() === '' ? undefined : notes,
    };
    const result = initial ? updateFaction(initial.id, values) : addFaction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div className="rounded-lg border border-[#c9bda3] bg-[#f8f2e5] p-3">
      <div className="flex flex-col gap-2">
        <ArmyField label="Faction name">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
          />
        </ArmyField>
        <div className="grid grid-cols-2 gap-2">
          <ArmyField label="Faction color">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-[#cfc3a8] bg-white p-1"
            />
          </ArmyField>
          <ArmyField label="Label color">
            <input
              type="color"
              value={labelColor}
              onChange={(event) => setLabelColor(event.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-[#cfc3a8] bg-white p-1"
            />
          </ArmyField>
        </div>
        <fieldset className="rounded-md border border-[#e2d8c3] bg-white/40 p-2">
          <legend className="px-1 text-xs font-medium text-[#5f594b]">Naming by echelon</legend>
          <p className="text-[0.65rem] leading-4 font-normal text-[#8a7a58]">
            Commander style uses the unit's commander text. Generated names apply when a unit has no
            custom name.
          </p>
          <div className="mt-1.5 flex flex-col gap-1">
            {ECHELON_ORDER.map((echelon) => (
              <label
                key={echelon}
                className="flex items-center gap-2 text-[0.65rem] font-normal text-[#5f594b]"
              >
                <span className="w-16 shrink-0">{ECHELON_LABELS[echelon]}</span>
                <select
                  aria-label={`${ECHELON_LABELS[echelon]} naming mode`}
                  value={namingModes[echelon]}
                  onChange={(event) =>
                    setNamingModes((current) => ({
                      ...current,
                      [echelon]: event.target.value as FactionNamingMode,
                    }))
                  }
                  className={fieldClass}
                >
                  {(Object.keys(NAMING_MODE_LABELS) as FactionNamingMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {NAMING_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rounded-md border border-[#e2d8c3] bg-white/40 p-2">
          <legend className="px-1 text-xs font-medium text-[#5f594b]">
            Default unit strengths
          </legend>
          <p className="text-[0.65rem] leading-4 font-normal text-[#8a7a58]">
            Prefilled for new units at or below the roster's smallest unit.
          </p>
          <div className="mt-1.5 flex flex-col gap-2">
            {ECHELON_ORDER.map((echelon) => (
              <div key={echelon}>
                <p className="text-[0.62rem] font-semibold text-[#5f594b]">
                  {ECHELON_LABELS[echelon]}
                </p>
                <div className="mt-0.5 grid grid-cols-3 gap-1">
                  {STRENGTH_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex flex-col gap-0.5 text-[0.55rem] font-normal text-[#8a7a58]"
                    >
                      {STRENGTH_TYPE_LABELS[type]}
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`${STRENGTH_TYPE_LABELS[type]} ${ECHELON_LABELS[echelon]} default strength`}
                        value={strengthDraft[type][echelon]}
                        onChange={(event) =>
                          setStrengthDraft((current) => ({
                            ...current,
                            [type]: {
                              ...current[type],
                              [echelon]: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border border-[#cfc3a8] bg-white px-1 py-0.5 text-xs text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <ArmyField label="Faction notes">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className={fieldClass}
          />
        </ArmyField>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[0.68rem] font-medium text-[#8b3a2f]">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={primaryButtonClass} onClick={handleSubmit}>
          {initial ? 'Save faction' : 'Create faction'}
        </button>
      </div>
    </div>
  );
}

export function FactionManagerPanel() {
  const roster = useRosterStore((state) => state.document);
  const deleteFaction = useRosterStore((state) => state.deleteFaction);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = (factionId: string): void => {
    const result = deleteFaction(factionId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setConfirmDeleteId(null);
  };

  return (
    <section aria-label="Factions" data-testid="faction-manager">
      <div className="flex items-center justify-between gap-2">
        <h3 className={sectionHeadingClass}>Factions</h3>
        <button
          type="button"
          className={secondaryButtonClass}
          aria-label="Add faction"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
            setConfirmDeleteId(null);
            setError(null);
          }}
        >
          + Faction
        </button>
      </div>

      {adding ? (
        <div className="mt-2">
          <FactionForm
            roster={roster}
            onDone={() => {
              setAdding(false);
              setError(null);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded border border-[#d3b3a8] bg-[#f9ede8] px-2 py-1.5 text-[0.68rem] text-[#8b3a2f]"
        >
          {error}
        </p>
      ) : null}

      <ul className="mt-2 space-y-1.5">
        {roster.factions.length === 0 ? (
          <li className="rounded border border-dashed border-[#d8cdb5] px-2 py-3 text-center text-[0.68rem] text-[#8a7a58]">
            No factions yet.
          </li>
        ) : null}

        {roster.factions.map((faction) => {
          const unitCount = roster.units.filter((unit) => unit.factionId === faction.id).length;

          if (editingId === faction.id) {
            return (
              <li key={faction.id}>
                <FactionForm
                  roster={roster}
                  initial={faction}
                  onDone={() => {
                    setEditingId(null);
                    setError(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }

          return (
            <li
              key={faction.id}
              data-testid={`faction-row-${faction.id}`}
              className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: faction.color }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#3b352a]">
                  {faction.name}
                </span>
                <span className="text-[0.6rem] text-[#8a7a58]">
                  {namingSummary(faction.namingModes)} · {unitCount} unit
                  {unitCount === 1 ? '' : 's'}
                </span>
              </div>

              {confirmDeleteId === faction.id ? (
                <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
                  <span className="text-[0.62rem] font-semibold text-[#8b3a2f]">
                    Delete faction?
                  </span>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    onClick={() => handleDelete(faction.id)}
                  >
                    Confirm delete faction
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    aria-label={`Edit faction ${faction.name}`}
                    onClick={() => {
                      setEditingId(faction.id);
                      setAdding(false);
                      setConfirmDeleteId(null);
                      setError(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    aria-label={`Delete faction ${faction.name}`}
                    onClick={() => {
                      setConfirmDeleteId(faction.id);
                      setEditingId(null);
                      setError(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
