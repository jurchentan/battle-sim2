import { useEffect } from 'react';
import { CanvasViewport } from '../../canvas/CanvasViewport';
import { EditorToolbar } from '../../features/terrain/EditorToolbar';
import { InspectorPanel } from '../../features/terrain/InspectorPanel';
import { LayerPanel } from '../../features/terrain/LayerPanel';
import { ToolRail } from '../../features/terrain/ToolRail';
import { useEditorShortcuts } from '../../features/terrain/useEditorShortcuts';
import { useEditorStore } from '../../state/editorStore';
import { useTerrainStore } from '../../state/terrainStore';

export function TerrainWorkspace() {
  const map = useTerrainStore((state) => state.document);
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const selectedFeatureId = useEditorStore((state) => state.selectedFeatureId);
  const selectFeature = useEditorStore((state) => state.selectFeature);

  useEditorShortcuts();

  useEffect(() => {
    if (activeLayerId && map.layers.some((layer) => layer.id === activeLayerId)) return;
    const firstLayer = map.layers[0];
    if (firstLayer) setActiveLayer(firstLayer.id);
  }, [activeLayerId, map.layers, setActiveLayer]);

  useEffect(() => {
    if (!selectedFeatureId) return;
    const feature = map.features.find((candidate) => candidate.id === selectedFeatureId);
    if (!feature) {
      selectFeature(null);
      return;
    }

    const layer = map.layers.find((candidate) => candidate.id === feature.layerId);
    if (!layer || !layer.visible || layer.locked) {
      selectFeature(null);
    }
  }, [map.features, map.layers, selectFeature, selectedFeatureId]);

  return (
    <section
      role="tabpanel"
      id="workspace-panel-terrain"
      aria-labelledby="workspace-tab-terrain"
      className="flex h-full min-h-0 flex-col"
    >
      <EditorToolbar map={map} />

      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <LayerPanel map={map} />
        <div className="min-w-0 flex-1">
          <CanvasViewport />
        </div>
        <InspectorPanel map={map} />
      </div>
    </section>
  );
}
