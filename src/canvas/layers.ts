import type { TerrainFeature, TerrainLayer, TerrainMap } from '../models';

export interface OrderedTerrainFeature {
  feature: TerrainFeature;
  layer: TerrainLayer;
}

export function getOrderedFeatures(map: TerrainMap): OrderedTerrainFeature[] {
  const layersById = new Map(map.layers.map((layer) => [layer.id, layer] as const));

  return map.features
    .map((feature) => ({ feature, layer: layersById.get(feature.layerId) }))
    .filter((entry): entry is OrderedTerrainFeature => entry.layer !== undefined)
    .sort((a, b) => {
      if (a.layer.zIndex !== b.layer.zIndex) return a.layer.zIndex - b.layer.zIndex;
      if (a.feature.zIndex !== b.feature.zIndex) return a.feature.zIndex - b.feature.zIndex;
      return a.feature.id.localeCompare(b.feature.id);
    });
}

export function isLayerInteractive(layer: TerrainLayer): boolean {
  return layer.visible && !layer.locked;
}

export function isFeatureInteractive(map: TerrainMap, featureId: string): boolean {
  const feature = map.features.find((candidate) => candidate.id === featureId);
  if (!feature) return false;
  const layer = map.layers.find((candidate) => candidate.id === feature.layerId);
  return layer !== undefined && isLayerInteractive(layer);
}
