import { useEffect, useState, type FormEvent } from 'react';
import type { ArmyRoster, TerrainMap } from '../../models';
import { listRosterRecords } from '../army/rosterLibraryDb';
import { fieldClass, primaryButtonClass, secondaryButtonClass } from '../army/ui';
import { listTerrainMapRecords } from '../library/terrainLibraryDb';
import { useLibraryStore } from '../../state/libraryStore';
import { useRosterLibraryStore } from '../../state/rosterLibraryStore';
import { useScenarioStore } from '../../state/scenarioStore';

export function NewScenarioDialog({ onClose }: { onClose: () => void }) {
  const createScenario = useScenarioStore((state) => state.createScenario);

  const [name, setName] = useState('Untitled scenario');
  const [description, setDescription] = useState('');
  const [terrains, setTerrains] = useState<TerrainMap[]>([]);
  const [rosters, setRosters] = useState<ArmyRoster[]>([]);
  const [terrainId, setTerrainId] = useState('');
  const [rosterId, setRosterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSources = async (): Promise<void> => {
      try {
        await Promise.all([
          useLibraryStore.getState().saveNow(),
          useRosterLibraryStore.getState().saveNow(),
        ]);
        const [terrainRecords, rosterRecords] = await Promise.all([
          listTerrainMapRecords(),
          listRosterRecords(),
        ]);
        if (cancelled) return;

        setTerrains(terrainRecords);
        setRosters(rosterRecords);

        const activeMapId = useLibraryStore.getState().activeMapId;
        const activeRosterId = useRosterLibraryStore.getState().activeRosterId;
        setTerrainId(
          terrainRecords.find((map) => map.id === activeMapId)?.id ?? terrainRecords[0]?.id ?? '',
        );
        setRosterId(
          rosterRecords.find((roster) => roster.id === activeRosterId)?.id ??
            rosterRecords[0]?.id ??
            '',
        );
      } catch (error) {
        if (!cancelled) {
          setSourceError(
            `Could not read the terrain or army libraries: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const terrain = terrains.find((candidate) => candidate.id === terrainId);
  const roster = rosters.find((candidate) => candidate.id === rosterId);
  const validationError = !name.trim()
    ? 'Enter a scenario name.'
    : loading
      ? 'Loading saved terrain maps and rosters…'
      : !terrain || !roster
        ? 'Choose a saved terrain map and army roster.'
        : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (validationError || submitting || !terrain || !roster) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = createScenario({
        name: name.trim(),
        description,
        terrain,
        roster,
      });
      if (result.ok) {
        onClose();
      } else {
        setSubmitError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
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
        aria-labelledby="new-scenario-heading"
        data-testid="new-scenario-dialog"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            New battle scenario
          </p>
          <h2
            id="new-scenario-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            Combine a battlefield and order of battle
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            The scenario receives independent snapshot copies. Later changes to the terrain map or
            roster do not alter this battle.
          </p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Scenario name
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Description
              <textarea
                value={description}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Terrain map
              <select
                value={terrainId}
                onChange={(event) => setTerrainId(event.target.value)}
                disabled={loading}
                className={fieldClass}
              >
                {terrains.length === 0 ? <option value="">No saved terrain maps</option> : null}
                {terrains.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} · {map.features.length} features
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Army roster
              <select
                value={rosterId}
                onChange={(event) => setRosterId(event.target.value)}
                disabled={loading}
                className={fieldClass}
              >
                {rosters.length === 0 ? <option value="">No saved army rosters</option> : null}
                {rosters.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.units.length} formations
                  </option>
                ))}
              </select>
            </label>

            {loading ? (
              <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-xs text-[#6b6353]">
                Reading the local terrain and army libraries…
              </p>
            ) : terrain && roster ? (
              <p
                data-testid="new-scenario-source-summary"
                className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-xs text-[#6b6353]"
              >
                Snapshot: {terrain.width} × {terrain.height} terrain · {roster.units.length}{' '}
                formations in {roster.factions.length} factions.
              </p>
            ) : null}

            {sourceError ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {sourceError}
              </p>
            ) : null}

            {submitError ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {submitError}
              </p>
            ) : null}

            {!loading && validationError ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {validationError}
              </p>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-[#e0d6c1] bg-[#f8f2e5] px-5 py-3">
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={Boolean(validationError) || !terrain || !roster || submitting}
            >
              {submitting ? 'Creating…' : 'Create scenario'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
