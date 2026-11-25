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
import { ArmyField } from './ArmyField';
import { ECHELON_LABELS, ECHELON_ORDER } from './rosterDocuments';
import { fieldClass, primaryButtonClass, secondaryButtonClass } from './ui';

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

export interface FactionFormValues {
  name: string;
  color: string;
  labelColor: string;
  namingModes: FactionNamingModes;
  defaultStrengths: FactionDefaultStrengths;
  notes?: string;
}

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

export function nextFactionColor(factions: readonly Faction[]): string {
  return FACTION_COLORS[factions.length % FACTION_COLORS.length] ?? FACTION_COLORS[0];
}

export function FactionForm({
  roster,
  initial,
  onSubmit,
  onDone,
  onCancel,
}: {
  roster: ArmyRoster;
  initial?: Faction;
  onSubmit: (values: FactionFormValues) => { ok: true } | { ok: false; error: string };
  onDone: () => void;
  onCancel: () => void;
}) {
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

    const result = onSubmit({
      name,
      color,
      labelColor,
      namingModes,
      defaultStrengths,
      notes: notes.trim() === '' ? undefined : notes,
    });
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
            Prefilled for new brigades in this faction.
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
