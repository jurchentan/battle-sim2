import { useCallback, useMemo } from 'react';
import { Rect } from 'react-konva';
import type { TerrainMap } from '../../models';
import { FeatureShape } from '../../canvas/FeatureShape';
import { getOrderedFeatures } from '../../canvas/layers';
import { terrainFeatureBounds } from './scenarioDocuments';

interface ScenarioTerrainLayerProps {
  map: TerrainMap;
  hiddenLayerIds: readonly string[];
  interactive: boolean;
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string) => void;
}

export function ScenarioTerrainLayer({
  map,
  hiddenLayerIds,
  interactive,
  selectedFeatureId,
  onSelectFeature,
}: ScenarioTerrainLayerProps) {
  const hidden = useMemo(() => new Set(hiddenLayerIds), [hiddenLayerIds]);
  const ordered = useMemo(
    () => getOrderedFeatures(map).filter(({ layer }) => layer.visible && !hidden.has(layer.id)),
    [hidden, map],
  );
  const selectedFeature = ordered.find(({ feature }) => feature.id === selectedFeatureId)?.feature;
  const handleChange = useCallback(() => undefined, []);
  const registerNode = useCallback(() => undefined, []);

  return (
    <>
      {ordered.map(({ feature, layer }) => (
        <FeatureShape
          key={feature.id}
          feature={feature}
          interactive={interactive && layer.visible}
          draggable={false}
          onSelect={onSelectFeature}
          onChange={handleChange}
          registerNode={registerNode}
        />
      ))}

      {selectedFeature ? (
        <TerrainSelectionOutline map={map} featureId={selectedFeature.id} />
      ) : null}
    </>
  );
}

function TerrainSelectionOutline({ map, featureId }: { map: TerrainMap; featureId: string }) {
  const feature = map.features.find((candidate) => candidate.id === featureId);
  if (!feature) return null;

  const bounds = terrainFeatureBounds(feature);
  return (
    <Rect
      x={bounds.x - 8}
      y={bounds.y - 8}
      width={bounds.width + 16}
      height={bounds.height + 16}
      stroke="#3d4b3f"
      strokeWidth={1.5}
      dash={[7, 5]}
      listening={false}
    />
  );
}
