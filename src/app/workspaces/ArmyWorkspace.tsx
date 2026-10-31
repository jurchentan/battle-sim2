import { InfoCard } from '../../components/InfoCard';
import { Stat, StatGrid } from '../../components/Stat';
import { WorkspacePanel } from '../../components/WorkspacePanel';
import { seedDocuments, type UnitEchelon } from '../../models';

const ECHELON_ORDER: UnitEchelon[] = ['army', 'corps', 'division', 'brigade', 'regiment', 'other'];

export function ArmyWorkspace() {
  const roster = seedDocuments.roster;

  const unitsByEchelon = new Map<UnitEchelon, number>();
  for (const unit of roster.units) {
    unitsByEchelon.set(unit.echelon, (unitsByEchelon.get(unit.echelon) ?? 0) + 1);
  }

  return (
    <WorkspacePanel
      workspace="army"
      title="Army Roster Editor"
      milestone="M4"
      scope="Build reusable order-of-battle rosters: factions, commanders, and a configurable army hierarchy. Brigades are the default deployable unit, but any echelon can be represented."
    >
      <InfoCard
        eyebrow="Seeded demo roster"
        title={roster.name}
        subtitle="One roster can contain multiple opposing factions."
      >
        <StatGrid>
          <Stat label="Factions" value={roster.factions.length} />
          <Stat label="Commanders" value={roster.commanders.length} />
          <Stat label="Units" value={roster.units.length} />
          <Stat label="Brigades" value={unitsByEchelon.get('brigade') ?? 0} />
        </StatGrid>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold tracking-[0.14em] text-[#857a64] uppercase">
              Factions
            </h4>
            <ul className="mt-2 space-y-2">
              {roster.factions.map((faction) => (
                <li
                  key={faction.id}
                  className="flex items-center gap-3 rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: faction.color }}
                  />
                  <span className="font-medium text-[#3b352a]">{faction.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold tracking-[0.14em] text-[#857a64] uppercase">
              Units by echelon
            </h4>
            <ul className="mt-2 space-y-1.5">
              {ECHELON_ORDER.filter((echelon) => unitsByEchelon.has(echelon)).map((echelon) => (
                <li
                  key={echelon}
                  className="flex items-center justify-between border-b border-dashed border-[#ded3bd] pb-1.5 text-sm text-[#4a4438]"
                >
                  <span className="capitalize">{echelon}</span>
                  <span className="font-medium">{unitsByEchelon.get(echelon)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </InfoCard>
    </WorkspacePanel>
  );
}
