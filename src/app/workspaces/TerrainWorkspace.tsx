import { InfoCard } from '../../components/InfoCard';
import { Stat, StatGrid } from '../../components/Stat';
import { WorkspacePanel } from '../../components/WorkspacePanel';
import { seedDocuments } from '../../models';

const FEATURE_LABELS: Record<string, string> = {
  forest: 'Forest',
  field: 'Field',
  river: 'River',
  road: 'Road',
  contour: 'Contour',
  lake: 'Lake',
  swamp: 'Swamp',
  building: 'Building',
  bridge: 'Bridge',
  fortification: 'Fortification',
  label: 'Label',
  customPath: 'Custom path',
};

export function TerrainWorkspace() {
  const map = seedDocuments.terrain;

  const featureCounts = new Map<string, number>();
  for (const feature of map.features) {
    featureCounts.set(feature.kind, (featureCounts.get(feature.kind) ?? 0) + 1);
  }

  const sortedLayers = [...map.layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <WorkspacePanel
      workspace="terrain"
      title="Terrain Editor"
      milestone="M1-M3"
      scope="Draw reusable battlefields from a blank canvas: forests, fields, water, roads, contours, buildings, and labels. Terrain documents are independent of any army or scenario."
    >
      <InfoCard eyebrow="Seeded demo terrain" title={map.name} subtitle={map.description}>
        <StatGrid>
          <Stat label="Canvas" value={`${map.width} × ${map.height}`} />
          <Stat label="Layers" value={map.layers.length} />
          <Stat label="Features" value={map.features.length} />
          <Stat label="Background" value={map.backgroundStyle} />
        </StatGrid>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold tracking-[0.14em] text-[#857a64] uppercase">
              Layer stack
            </h4>
            <ul className="mt-2 space-y-1.5">
              {sortedLayers.map((layer) => (
                <li
                  key={layer.id}
                  className="flex items-center justify-between rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[#3b352a]">{layer.name}</span>
                  <span className="text-xs text-[#7c715c]">
                    {layer.visible ? 'visible' : 'hidden'} · {layer.locked ? 'locked' : 'editable'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold tracking-[0.14em] text-[#857a64] uppercase">
              Feature mix
            </h4>
            <ul className="mt-2 space-y-1.5">
              {[...featureCounts.entries()].map(([kind, count]) => (
                <li
                  key={kind}
                  className="flex items-center justify-between border-b border-dashed border-[#ded3bd] pb-1.5 text-sm text-[#4a4438]"
                >
                  <span>{FEATURE_LABELS[kind] ?? kind}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </InfoCard>
    </WorkspacePanel>
  );
}
