import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Transformer } from 'react-konva';
import type { TerrainFeature, TerrainMap } from '../models';
import { useEditorStore } from '../state/editorStore';
import { useTerrainStore } from '../state/terrainStore';
import { FeatureShape } from './FeatureShape';
import { isLayerInteractive, getOrderedFeatures } from './layers';

const TEXT_ANCHORS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'middle-left',
  'middle-right',
];

interface FeatureLayerProps {
  map: TerrainMap;
  selectionEnabled: boolean;
  draggable: boolean;
}

export function FeatureLayer({ map, selectionEnabled, draggable }: FeatureLayerProps) {
  const selectedFeatureId = useEditorStore((state) => state.selectedFeatureId);
  const selectFeature = useEditorStore((state) => state.selectFeature);
  const updateFeature = useTerrainStore((state) => state.updateFeature);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeMap = useRef(new Map<string, Konva.Node>());

  const ordered = useMemo(() => getOrderedFeatures(map), [map]);
  const visibleOrdered = useMemo(() => ordered.filter(({ layer }) => layer.visible), [ordered]);
  const selectedFeature = useMemo(
    () => map.features.find((feature) => feature.id === selectedFeatureId) ?? null,
    [map.features, selectedFeatureId],
  );

  const registerNode = useCallback((featureId: string, node: Konva.Node | null) => {
    if (node) {
      nodeMap.current.set(featureId, node);
    } else {
      nodeMap.current.delete(featureId);
    }
  }, []);

  const handleChange = useCallback(
    (nextFeature: TerrainFeature) => {
      updateFeature(nextFeature.id, () => nextFeature);
    },
    [updateFeature],
  );

  const geometryType = selectedFeature?.geometry.type;
  const selectedLayer = selectedFeature
    ? map.layers.find((layer) => layer.id === selectedFeature.layerId)
    : undefined;
  const canTransform =
    selectionEnabled && selectedFeature !== null && selectedLayer !== undefined
      ? isLayerInteractive(selectedLayer)
      : false;

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const node =
      canTransform && selectedFeatureId ? nodeMap.current.get(selectedFeatureId) : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [canTransform, selectedFeatureId, selectedFeature]);

  const enabledAnchors =
    geometryType === 'textAnchor'
      ? TEXT_ANCHORS
      : geometryType === 'polygon' || geometryType === 'polyline'
        ? undefined
        : [];

  return (
    <>
      {visibleOrdered.map(({ feature, layer }) => {
        const interactive = selectionEnabled && isLayerInteractive(layer);

        return (
          <FeatureShape
            key={feature.id}
            feature={feature}
            interactive={interactive}
            draggable={interactive && draggable}
            onSelect={selectFeature}
            onChange={handleChange}
            registerNode={registerNode}
          />
        );
      })}

      <Transformer
        ref={transformerRef}
        enabledAnchors={enabledAnchors}
        rotateEnabled={canTransform && geometryType !== 'point'}
        rotateAnchorOffset={24}
        borderStroke="#3d4b3f"
        borderDash={[5, 4]}
        borderStrokeWidth={1.5}
        anchorStroke="#3d4b3f"
        anchorFill="#f7f2e6"
        anchorSize={8}
        anchorCornerRadius={2}
        padding={4}
        flipEnabled={false}
        ignoreStroke
        boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
      />
    </>
  );
}
