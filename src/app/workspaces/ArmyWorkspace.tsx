import { useState } from 'react';
import { useRosterLibraryStore } from '../../state/rosterLibraryStore';
import { useRosterStore } from '../../state/rosterStore';
import { OrderOfBattlePanel } from '../../features/army/OrderOfBattlePanel';
import { RosterToolbar } from '../../features/army/RosterToolbar';
import { FactionManagerPanel, RosterSettingsPanel } from '../../features/army/RosterSidebars';
import { UnitEditorPanel } from '../../features/army/UnitEditorPanel';
import { sectionHeadingClass } from '../../features/army/ui';

interface CreateSeed {
  factionId: string;
  parentUnitId: string | null;
}

export function ArmyWorkspace() {
  const roster = useRosterStore((state) => state.document);
  const ready = useRosterLibraryStore((state) => state.ready);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [createSeed, setCreateSeed] = useState<CreateSeed | null>(null);

  const activeSelectedUnitId =
    selectedUnitId && roster.units.some((unit) => unit.id === selectedUnitId)
      ? selectedUnitId
      : null;

  if (!ready) {
    return (
      <section
        role="tabpanel"
        id="workspace-panel-army"
        aria-labelledby="workspace-tab-army"
        className="flex h-full min-h-0 flex-col"
      >
        <div className="border-b border-[#d8cdb5] bg-[#f6efe0] px-4 py-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[#2f2b23]">
            Army Roster Editor
          </h2>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-[#7c715c]">
          Opening the local army roster library…
        </div>
      </section>
    );
  }

  const handleSelectUnit = (unitId: string | null): void => {
    setCreateSeed(null);
    setSelectedUnitId(unitId);
  };

  return (
    <section
      role="tabpanel"
      id="workspace-panel-army"
      aria-labelledby="workspace-tab-army"
      className="flex h-full min-h-0 flex-col"
    >
      <RosterToolbar roster={roster} />

      <div className="flex min-h-0 flex-1">
        <OrderOfBattlePanel
          roster={roster}
          selectedUnitId={activeSelectedUnitId}
          onSelectUnit={handleSelectUnit}
          onCreateUnit={(seed) => {
            setCreateSeed(seed);
          }}
        />

        <div className="min-w-0 flex-1 overflow-y-auto bg-[#f3ecdc]/50">
          <UnitEditorPanel
            roster={roster}
            selectedUnitId={activeSelectedUnitId}
            createSeed={createSeed}
            onSelectUnit={handleSelectUnit}
            onStartCreate={(seed) => setCreateSeed(seed)}
            onCancelCreate={() => setCreateSeed(null)}
          />
        </div>

        <aside
          aria-label="Roster records"
          className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-[#d8cdb5] bg-[#fbf7ed] p-3"
        >
          <RosterSettingsPanel />
          <FactionManagerPanel />

          <section
            aria-label="Roster guidance"
            className="rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2.5"
          >
            <h3 className={sectionHeadingClass}>Safe hierarchy</h3>
            <p className="mt-1 text-[0.68rem] leading-4 text-[#7c715c]">
              Parent options exclude the selected unit, its descendants, and other factions. The
              roster store validates every edit before it is committed, so cycles and dangling
              references are rejected.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
