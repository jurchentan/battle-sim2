import { InfoCard } from '../../components/InfoCard';
import { Stat, StatGrid } from '../../components/Stat';
import { WorkspacePanel } from '../../components/WorkspacePanel';
import { seedDocuments } from '../../models';

export function ScenarioWorkspace() {
  const scenario = seedDocuments.scenario;
  const activePhase = scenario.phases.find((phase) => phase.id === scenario.activePhaseId);
  const sortedPhases = [...scenario.phases].sort((a, b) => a.order - b.order);

  const deployedUnitCount = activePhase ? Object.keys(activePhase.unitStates).length : 0;
  const activeAnnotationCount = activePhase?.annotations.length ?? 0;

  return (
    <WorkspacePanel
      workspace="scenario"
      title="Scenario Editor"
      milestone="M5-M6"
      scope="Combine a terrain snapshot and army roster into a battle, deploy formations, then build a timeline of phases with per-phase positions, strengths, statuses, and tactical annotations."
    >
      <InfoCard
        eyebrow="Seeded demo scenario"
        title={scenario.name}
        subtitle={scenario.description}
      >
        <StatGrid>
          <Stat label="Phases" value={scenario.phases.length} />
          <Stat label="Deployed units" value={deployedUnitCount} />
          <Stat label="Annotations" value={activeAnnotationCount} />
          <Stat label="Roster units" value={scenario.rosterSnapshot.units.length} />
        </StatGrid>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold tracking-[0.14em] text-[#857a64] uppercase">
              Phase timeline
            </h4>
            <ul className="mt-2 space-y-2">
              {sortedPhases.map((phase) => {
                const isActive = phase.id === scenario.activePhaseId;
                return (
                  <li
                    key={phase.id}
                    className={[
                      'rounded-md border px-3 py-2 text-sm',
                      isActive ? 'border-[#7d916f] bg-[#eef1e4]' : 'border-[#e2d8c3] bg-[#f8f2e5]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[#3b352a]">{phase.name}</span>
                      <span className="text-xs text-[#7c715c]">{phase.timeLabel ?? 'No time'}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#7c715c]">
                      {Object.keys(phase.unitStates).length} unit states ·{' '}
                      {phase.annotations.length} annotations
                      {isActive ? ' · active' : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold tracking-[0.14em] text-[#857a64] uppercase">
              Embedded snapshots
            </h4>
            <ul className="mt-2 space-y-1.5 text-sm text-[#4a4438]">
              <li className="flex items-center justify-between border-b border-dashed border-[#ded3bd] pb-1.5">
                <span>Terrain</span>
                <span className="font-medium">{scenario.terrainSnapshot.name}</span>
              </li>
              <li className="flex items-center justify-between border-b border-dashed border-[#ded3bd] pb-1.5">
                <span>Roster</span>
                <span className="font-medium">{scenario.rosterSnapshot.name}</span>
              </li>
              <li className="flex items-center justify-between border-b border-dashed border-[#ded3bd] pb-1.5">
                <span>Terrain features</span>
                <span className="font-medium">{scenario.terrainSnapshot.features.length}</span>
              </li>
              <li className="flex items-center justify-between border-b border-dashed border-[#ded3bd] pb-1.5">
                <span>Factions</span>
                <span className="font-medium">{scenario.rosterSnapshot.factions.length}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-[#7c715c]">
              Scenario copies are independent: later edits to library terrain or rosters will not
              silently alter a saved battle.
            </p>
          </div>
        </div>
      </InfoCard>
    </WorkspacePanel>
  );
}
