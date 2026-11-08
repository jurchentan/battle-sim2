import { useState } from 'react';
import { pointsCenter } from '../../canvas/geometry';
import type { Point, TerrainFeature, TerrainMap } from '../../models';
import { useEditorStore } from '../../state/editorStore';
import { useTerrainStore } from '../../state/terrainStore';
import { FeatureStyleEditor } from './FeatureStyleEditor';
import { FEATURE_KIND_LABELS } from './kinds';

const actionButtonClass =
  'rounded-md border border-[#c9bda3] bg-[#f8f2e5] px-2 py-1.5 text-[0.68rem] font-semibold text-[#4a4438] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40';

const dangerButtonClass =
  'rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-2 py-1.5 text-[0.68rem] font-semibold text-[#8b3a2f] transition-colors hover:border-[#b98a7b] hover:bg-[#f3ddd4]';

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

function SectionHeading({ children }: { children: string }) {
  return (
    <h4 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
      {children}
    </h4>
  );
}

export function InspectorPanel({ map }: { map: TerrainMap }) {
  const selectedFeatureId = useEditorStore((state) => state.selectedFeatureId);
  const selectFeature = useEditorStore((state) => state.selectFeature);
  const updateFeature = useTerrainStore((state) => state.updateFeature);
  const deleteFeature = useTerrainStore((state) => state.deleteFeature);
  const duplicateFeature = useTerrainStore((state) => state.duplicateFeature);
  const moveFeature = useTerrainStore((state) => state.moveFeature);
  const feature = map.features.find((candidate) => candidate.id === selectedFeatureId) ?? null;
  const layer = feature ? map.layers.find((candidate) => candidate.id === feature.layerId) : null;

  const siblings = feature
    ? map.features
        .filter((candidate) => candidate.layerId === feature.layerId)
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
    : [];
  const siblingIndex = feature
    ? siblings.findIndex((candidate) => candidate.id === feature.id)
    : -1;

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
              <p
                data-testid="selected-kind"
                className="font-display mt-1 text-lg font-semibold text-[#2f2b23]"
              >
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

            <div className="flex flex-col gap-2.5">
              <SectionHeading>Style</SectionHeading>
              <FeatureStyleEditor
                feature={feature}
                onChange={(nextFeature) => updateFeature(feature.id, () => nextFeature)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <SectionHeading>Arrange</SectionHeading>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => {
                    const id = duplicateFeature(feature.id);
                    if (id) selectFeature(id);
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => {
                    deleteFeature(feature.id);
                    selectFeature(null);
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  aria-label="Send to back"
                  onClick={() => moveFeature(feature.id, 'back')}
                  disabled={siblingIndex <= 0}
                >
                  To back
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  aria-label="Bring to front"
                  onClick={() => moveFeature(feature.id, 'front')}
                  disabled={siblingIndex === -1 || siblingIndex >= siblings.length - 1}
                >
                  To front
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  aria-label="Send backward"
                  onClick={() => moveFeature(feature.id, 'backward')}
                  disabled={siblingIndex <= 0}
                >
                  Backward
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  aria-label="Bring forward"
                  onClick={() => moveFeature(feature.id, 'forward')}
                  disabled={siblingIndex === -1 || siblingIndex >= siblings.length - 1}
                >
                  Forward
                </button>
              </div>
            </div>

            <div>
              <SectionHeading>Details</SectionHeading>
              <dl className="mt-1">
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
              </dl>
            </div>

            <p className="rounded-md border border-[#e2d8c3] bg-[#f8f2e5] px-2.5 py-2 text-[0.68rem] leading-4 text-[#7c715c]">
              Drag to move, then use the handles to resize or rotate. Ctrl/Cmd+D duplicates, Delete
              removes, and Ctrl/Cmd+] or [ changes stacking.
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
              Choose an area, path, symbol, or label tool to draw. Select an object to edit its
              geometry and style. Hidden and locked layers cannot be edited.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
