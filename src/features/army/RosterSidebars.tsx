import { useState } from 'react';
import type { FactionNamingModes } from '../../models';
import { useRosterStore } from '../../state/rosterStore';
import { FactionForm } from './FactionForm';
import { dangerButtonClass, secondaryButtonClass, sectionHeadingClass } from './ui';

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

export function FactionManagerPanel() {
  const roster = useRosterStore((state) => state.document);
  const addFaction = useRosterStore((state) => state.addFaction);
  const updateFaction = useRosterStore((state) => state.updateFaction);
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
            onSubmit={(values) => addFaction(values)}
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
                  onSubmit={(values) =>
                    updateFaction(faction.id, {
                      name: values.name,
                      color: values.color,
                      labelColor: values.labelColor,
                      namingModes: values.namingModes,
                      defaultStrengths: values.defaultStrengths,
                      notes: values.notes,
                    })
                  }
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
