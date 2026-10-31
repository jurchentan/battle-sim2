import { useState } from 'react';
import { pointsCenter } from '../../canvas/geometry';
import type { Point, TerrainFeature, TerrainMap } from '../../models';
import { useEditorStore } from '../../state/editorStore';
import { useTerrainStore } from '../../state/terrainStore';

const FEATURE_KIND_LABELS: Record<TerrainFeature['kind'], string> = {
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

function featureCenter(feature: TerrainFeature): Point {
  switch (feature.geometry.type) {
    case 'polygon':
    case 'polyline':
      return pointsCenter(feature.geometry.points);
    case 'point':
    case 'textAnchor':
      return feature.geometry.position;
  }
}

function featureSize(feature: TerrainFeature): string {
  switch (feature.geometry.type) {
    case 'polygon':
    case 'polyline': {
      const xs = feature.geometry.points.map((point) => point.x);
      const ys = feature.geometry.points.map((point) => point.y);
      return `${Math.round(Math.max(...xs) - Math.min(...xs))} × ${Math.round(
        Math.max(...ys) - Math.min(...ys),
      )}`;
    }
    case 'textAnchor':
      return feature.style.type === 'text' ? `${Math.round(feature.style.fontSize)} pt` : '—';
    case 'point':
      return 'Marker';
  }
}

function geometrySummary(feature: TerrainFeature): string {
  switch (feature.geometry.type) {
    case 'polygon':
      return `${feature.geometry.points.length} vertices`;
    case 'polyline':
      return `${feature.geometry.points.length} points`;
    case 'point':
      return `${Math.round(feature.geometry.position.x)}, ${Math.round(
        feature.geometry.position.y,
      )}`;
    case 'textAnchor':
      return `${Math.round(feature.geometry.position.x)}, ${Math.round(
        feature.geometry.position.y,
      )} · ${Math.round(feature.geometry.rotationDegrees)}°`;
  }
}

function FeatureNameField({
  feature,
  onRename,
}: {
  feature: TerrainFeature;
  onRename: (name: string | undefined) => void;
}) {
  const [nameDraft, setNameDraft] = useState(feature.name ?? '');

  const commitName = (): void => {
    const trimmed = nameDraft.trim();
    if (feature.kind === 'label' && trimmed.length === 0) {
      setNameDraft(feature.name ?? 'Label');
      return;
    }

    const nextName = trimmed.length > 0 ? trimmed : undefined;
    if (nextName !== feature.name) onRename(nextName);
  };

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
      {feature.kind === 'label' ? 'Label text' : 'Name'}
      <input
        type="text"
        value={nameDraft}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            setNameDraft(feature.name ?? '');
            event.currentTarget.blur();
          }
        }}
        className="rounded-md border border-[#cfc3a8] bg-white/70 px-2 py-1.5 text-sm text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25"
      />
    </label>
  );
}

function DetailRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#ded3bd] py-1.5 text-xs">
      <dt className="text-[#857a64]">{label}</dt>
      <dd data-testid={testId} className="text-right font-medium text-[#4a4438]">
        {value}
      </dd>
    </div>
  );
}

export function InspectorPanel({ map }: { map: TerrainMap }) {
  const selectedFeatureId = useEditorStore((state) => state.selectedFeatureId);
  const updateFeature = useTerrainStore((state) => state.updateFeature);
  const feature = map.features.find((candidate) => candidate.id === selectedFeatureId) ?? null;
  const layer = feature ? map.layers.find((candidate) => candidate.id === feature.layerId) : null;

  return (
    <aside
      aria-label="Inspector"
      className="flex w-72 shrink-0 flex-col border-l border-[#d8cdb5] bg-[#fbf7ed]"
    >
      <div className="border-b border-[#e0d6c1] px-3 py-2">
        <h3 className="text-[0.68rem] font-semibold tracking-[0.14em] text-[#857a64] uppercase">
          Inspector
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {feature ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                Selected object
              </p>
              <p className="font-display mt-1 text-lg font-semibold text-[#2f2b23]">
                {FEATURE_KIND_LABELS[feature.kind]}
              </p>
            </div>

            <FeatureNameField
              key={`${feature.id}:${feature.name ?? ''}`}
              feature={feature}
              onRename={(nextName) =>
                updateFeature(feature.id, (current) => ({ ...current, name: nextName }))
              }
            />

            <dl>
              <DetailRow label="Layer" value={layer?.name ?? 'Unknown layer'} />
              <DetailRow
                label="Position"
                value={`${Math.round(featureCenter(feature).x)}, ${Math.round(
                  featureCenter(feature).y,
                )}`}
                testId="selected-position"
              />
              <DetailRow label="Geometry" value={geometrySummary(feature)} />
              <DetailRow label="Size" value={featureSize(feature)} testId="selected-size" />
              <DetailRow label="Z-index" value={String(feature.zIndex)} />
              <DetailRow
                label="State"
                value={
                  layer && (!layer.visible || layer.locked)
                    ? layer.visible
                      ? 'Layer locked'
                      : 'Layer hidden'
                    : 'Editable'
                }
              />
            </dl>

            <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
              Drag the object to move it. Use the selection handles to resize or rotate. Changes are
              committed as a single undo step.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                Document
              </p>
              <p className="font-display mt-1 text-lg font-semibold text-[#2f2b23]">{map.name}</p>
              <p className="mt-1 text-xs text-[#7c715c]">
                {map.width} × {map.height} document units
              </p>
            </div>

            <dl>
              <DetailRow label="Layers" value={String(map.layers.length)} />
              <DetailRow label="Features" value={String(map.features.length)} />
            </dl>

            <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
              Select an object on the canvas to inspect it, or choose a drawing tool to add a
              polygon, path, or text label.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
