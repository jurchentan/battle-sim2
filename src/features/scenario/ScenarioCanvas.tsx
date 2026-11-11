import type Konva from 'konva';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage } from 'react-konva';
import { screenToWorld } from '../../canvas/camera';
import { useCameraStore } from '../../canvas/cameraStore';
import type { Point, TerrainMap } from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import { currentCanvasBounds } from '../terrain/canvasBounds';
import { isTypingTarget } from '../terrain/useEditorShortcuts';
import {
  activeScenarioPhase,
  isRectangleFormation,
  isUpsideDownRotation,
  renderedFrontageLength,
  scenarioUnitLabel,
} from './scenarioDocuments';
import { ScenarioTerrainLayer } from './ScenarioTerrainLayer';
import { UnitFormationLayer, UnitFormationTransformer } from './UnitFormationLayer';
import {
  isMeaningfulMarquee,
  rectangleFromPoints,
  rectanglesIntersect,
  type ScreenRect,
} from './marquee';

const PAPER_FILL: Record<TerrainMap['backgroundStyle'], string> = {
  plain: '#fbf8f0',
  'aged-paper': '#f1e6cd',
  parchment: '#eeddc0',
};

function formationScreenBounds(
  shapeNode: Konva.Node,
  labelNode: Konva.Node | undefined,
): ScreenRect {
  const shape = shapeNode.getClientRect();
  if (!labelNode) return shape;

  const label = labelNode.getClientRect();
  const x = Math.min(shape.x, label.x);
  const y = Math.min(shape.y, label.y);
  return {
    x,
    y,
    width: Math.max(shape.x + shape.width, label.x + label.width) - x,
    height: Math.max(shape.y + shape.height, label.y + label.height) - y,
  };
}

interface CanvasSize {
  width: number;
  height: number;
}

export function ScenarioCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const cursorReadoutRef = useRef<HTMLSpanElement>(null);
  const panCleanupRef = useRef<(() => void) | null>(null);
  const marqueeCleanupRef = useRef<(() => void) | null>(null);
  const [formationNodes] = useState(() => new Map<string, Konva.Node>());
  const [labelNodes] = useState(() => new Map<string, Konva.Node>());
  const [formationNodeVersion, setFormationNodeVersion] = useState(0);
  const [marqueeRect, setMarqueeRect] = useState<ScreenRect | null>(null);

  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [cursorWorld, setCursorWorld] = useState<Point | null>(null);

  const scenario = useScenarioStore((state) => state.document);
  const placeUnit = useScenarioStore((state) => state.placeUnit);
  const mode = useScenarioEditorStore((state) => state.mode);
  const selectedUnitIds = useScenarioEditorStore((state) => state.selectedUnitIds);
  const selectedFeatureId = useScenarioEditorStore((state) => state.selectedFeatureId);
  const hiddenFactionIds = useScenarioEditorStore((state) => state.hiddenFactionIds);
  const hiddenTerrainLayerIds = useScenarioEditorStore((state) => state.hiddenTerrainLayerIds);
  const placementUnitId = useScenarioEditorStore((state) => state.placementUnitId);
  const formationFontSizes = useScenarioEditorStore((state) => state.formationFontSizes);
  const formationLabelFormats = useScenarioEditorStore((state) => state.formationLabelFormats);
  const uppercaseFormationLabels = useScenarioEditorStore(
    (state) => state.uppercaseFormationLabels,
  );
  const dynamicFrontage = useScenarioEditorStore((state) => state.dynamicFrontage);
  const selectUnit = useScenarioEditorStore((state) => state.selectUnit);
  const selectUnits = useScenarioEditorStore((state) => state.selectUnits);
  const selectFeature = useScenarioEditorStore((state) => state.selectFeature);
  const cancelPlacement = useScenarioEditorStore((state) => state.cancelPlacement);
  const camera = useCameraStore((state) => state.camera);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      useCameraStore.getState().setViewport({ width, height });
      setSize({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    useCameraStore.getState().reset();
  }, [scenario.id]);

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const cameraState = useCameraStore.getState();
    if (!cameraState.fitted) {
      const bounds = currentCanvasBounds(scenario.terrainSnapshot);
      cameraState.fit(bounds.width, bounds.height, bounds.originX, bounds.originY);
    }
  }, [scenario.id, scenario.terrainSnapshot, size.height, size.width]);

  const stopPan = useCallback(() => {
    panCleanupRef.current?.();
    panCleanupRef.current = null;
    setPanning(false);
  }, []);

  const stopMarquee = useCallback(() => {
    marqueeCleanupRef.current?.();
    marqueeCleanupRef.current = null;
    setMarqueeRect(null);
  }, []);

  const registerFormationNode = useCallback(
    (unitId: string, node: Konva.Node | null) => {
      const current = formationNodes.get(unitId) ?? null;
      if (node) {
        formationNodes.set(unitId, node);
      } else {
        formationNodes.delete(unitId);
      }
      if (current !== node) {
        setFormationNodeVersion((version) => version + 1);
      }
    },
    [formationNodes],
  );

  const registerLabelNode = useCallback(
    (unitId: string, node: Konva.Node | null) => {
      if (node) {
        labelNodes.set(unitId, node);
      } else {
        labelNodes.delete(unitId);
      }
    },
    [labelNodes],
  );

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      stopPan();
      let lastX = clientX;
      let lastY = clientY;
      setPanning(true);

      const handleMove = (event: MouseEvent): void => {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        useCameraStore.getState().panBy(dx, dy);
      };

      const handleUp = (): void => {
        stopPan();
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      panCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    },
    [stopPan],
  );

  const beginMarquee = useCallback(
    (clientX: number, clientY: number, additive: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;

      stopPan();
      stopMarquee();

      const containerRect = stage.container().getBoundingClientRect();
      const start = { x: clientX - containerRect.left, y: clientY - containerRect.top };
      let latest = rectangleFromPoints(start, start);
      setMarqueeRect(latest);

      const handleMove = (event: MouseEvent): void => {
        latest = rectangleFromPoints(start, {
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top,
        });
        setMarqueeRect(latest);
      };

      const handleUp = (): void => {
        marqueeCleanupRef.current?.();
        marqueeCleanupRef.current = null;
        setMarqueeRect(null);

        if (!isMeaningfulMarquee(latest)) return;

        const hits: string[] = [];
        for (const [unitId, shapeNode] of formationNodes) {
          const bounds = formationScreenBounds(shapeNode, labelNodes.get(unitId));
          if (rectanglesIntersect(latest, bounds)) hits.push(unitId);
        }

        if (additive) {
          const current = useScenarioEditorStore.getState().selectedUnitIds;
          selectUnits([...current, ...hits]);
        } else {
          selectUnits(hits);
        }
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      marqueeCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    },
    [formationNodes, labelNodes, selectUnits, stopMarquee, stopPan],
  );

  useEffect(() => stopPan, [stopPan]);
  useEffect(() => stopMarquee, [stopMarquee]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        setSpaceDown(true);
        return;
      }

      if (event.key === 'Escape') {
        cancelPlacement();
        stopMarquee();
        selectUnits([]);
        selectFeature(null);
        setCursorWorld(null);
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setSpaceDown(false);
    };

    const handleBlur = (): void => setSpaceDown(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [cancelPlacement, selectFeature, selectUnits, stopMarquee]);

  const stagePointer = (): Point | null => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    return screenToWorld(useCameraStore.getState().camera, pointer);
  };

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>): void => {
    const stage = event.target.getStage();
    const native = event.evt;

    if (placementUnitId) {
      if (native.button !== 0) return;
      const point = stagePointer();
      if (!point) return;
      native.preventDefault();
      const result = placeUnit(placementUnitId, point);
      if (result.ok) {
        selectUnit(placementUnitId);
        cancelPlacement();
      }
      return;
    }

    if (native.button === 1 || spaceDown) {
      native.preventDefault();
      beginPan(native.clientX, native.clientY);
      return;
    }

    if (native.button !== 0) return;

    if (event.target === stage) {
      native.preventDefault();
      if (mode === 'units') {
        if (!native.shiftKey) selectUnits([]);
        beginMarquee(native.clientX, native.clientY, native.shiftKey);
      } else {
        selectUnit(null);
        selectFeature(null);
        beginPan(native.clientX, native.clientY);
      }
    }
  };

  const handleMouseMove = (): void => {
    const point = stagePointer();
    if (!point) return;

    setCursorWorld(point);
    if (cursorReadoutRef.current) {
      cursorReadoutRef.current.textContent = `${Math.round(point.x)}, ${Math.round(point.y)}`;
    }
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>): void => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const factor = event.evt.deltaY > 0 ? 1 / 1.12 : 1.12;
    useCameraStore.getState().zoomAtPoint(pointer, factor);
  };

  const phase = activeScenarioPhase(scenario);
  const deployedCount = phase ? Object.keys(phase.unitStates).length : 0;
  const hiddenFactions = new Set(hiddenFactionIds);
  const unitsById = new Map(scenario.rosterSnapshot.units.map((unit) => [unit.id, unit] as const));
  const visibleFormations = phase
    ? Object.entries(phase.unitStates).flatMap(([unitId, state]) => {
        if (!state.visible) return [];
        const unit = unitsById.get(unitId);
        if (!unit || hiddenFactions.has(unit.factionId)) return [];
        return [{ unit, state }];
      })
    : [];
  const visibleFormationCount = visibleFormations.length;
  const rectangleFormationCount = visibleFormations.filter(({ unit }) =>
    isRectangleFormation(unit.echelon, scenario.rosterSnapshot.smallestUnitEchelon),
  ).length;
  const textFormationCount = visibleFormationCount - rectangleFormationCount;
  const selectedUnitId = selectedUnitIds.length === 1 ? (selectedUnitIds[0] ?? null) : null;
  const selectedUnit = selectedUnitId ? unitsById.get(selectedUnitId) : undefined;
  const selectedState = selectedUnitId ? phase?.unitStates[selectedUnitId] : undefined;
  const selectedIsRectangle = selectedUnit
    ? isRectangleFormation(selectedUnit.echelon, scenario.rosterSnapshot.smallestUnitEchelon)
    : false;
  const selectedMapLabel =
    selectedUnit && selectedState
      ? scenarioUnitLabel(
          scenario,
          selectedUnit,
          selectedState,
          formationLabelFormats[selectedUnit.echelon],
        )
      : '';
  const selectedRenderedFrontage =
    selectedUnit && selectedState
      ? renderedFrontageLength(
          selectedState.frontageLength,
          selectedState.effectiveStrength ?? selectedUnit.initialStrength,
          dynamicFrontage,
        )
      : null;
  const selectedStates = Object.fromEntries(
    selectedUnitIds.flatMap((unitId) => {
      const state = phase?.unitStates[unitId];
      return state ? [[unitId, state] as const] : [];
    }),
  );

  const paperBounds = currentCanvasBounds(scenario.terrainSnapshot);
  const cursor = placementUnitId
    ? 'crosshair'
    : panning
      ? 'grabbing'
      : spaceDown
        ? 'grab'
        : marqueeRect
          ? 'crosshair'
          : 'default';

  return (
    <div
      ref={containerRef}
      data-testid="scenario-canvas"
      data-mode={mode}
      data-placement={placementUnitId ? 'true' : 'false'}
      data-deployed-count={deployedCount}
      data-visible-formations={visibleFormationCount}
      data-rectangle-formations={rectangleFormationCount}
      data-text-formations={textFormationCount}
      data-uppercase-labels={uppercaseFormationLabels ? 'true' : 'false'}
      data-formation-font-sizes={JSON.stringify(formationFontSizes)}
      data-formation-label-formats={JSON.stringify(formationLabelFormats)}
      data-selected-count={selectedUnitIds.length}
      data-selected-unit-ids={JSON.stringify(selectedUnitIds)}
      data-selected-states={JSON.stringify(selectedStates)}
      data-selected-kind={
        selectedUnit
          ? selectedIsRectangle
            ? 'rectangle'
            : 'text'
          : selectedUnitIds.length > 1
            ? 'multiple'
            : 'none'
      }
      data-selected-map-label={selectedMapLabel}
      data-selected-label-flipped={
        selectedState && isUpsideDownRotation(selectedState.rotationDegrees) ? 'true' : 'false'
      }
      data-dynamic-frontage={dynamicFrontage ? 'true' : 'false'}
      data-marquee-active={marqueeRect ? 'true' : 'false'}
      data-selected-rendered-frontage={
        selectedRenderedFrontage === null
          ? ''
          : String(Math.round(selectedRenderedFrontage * 100) / 100)
      }
      data-terrain-features={scenario.terrainSnapshot.features.length}
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#e8dfcd]"
      style={{ cursor, touchAction: 'none' }}
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        >
          <Layer listening={false}>
            <Rect
              x={camera.offsetX + paperBounds.originX * camera.scale}
              y={camera.offsetY + paperBounds.originY * camera.scale}
              width={paperBounds.width * camera.scale}
              height={paperBounds.height * camera.scale}
              fill={PAPER_FILL[scenario.terrainSnapshot.backgroundStyle]}
              stroke="#c4b48e"
              strokeWidth={2}
              shadowColor="#2f2b23"
              shadowBlur={28}
              shadowOpacity={0.18}
              shadowOffsetY={10}
            />
            <Rect
              x={camera.offsetX + (paperBounds.originX + 12) * camera.scale}
              y={camera.offsetY + (paperBounds.originY + 12) * camera.scale}
              width={Math.max(0, paperBounds.width - 24) * camera.scale}
              height={Math.max(0, paperBounds.height - 24) * camera.scale}
              stroke="#d2c3a1"
              strokeWidth={1 / camera.scale}
              dash={[3 / camera.scale, 7 / camera.scale]}
              opacity={0.7}
            />
          </Layer>

          <Layer>
            <Group
              x={camera.offsetX}
              y={camera.offsetY}
              scaleX={camera.scale}
              scaleY={camera.scale}
            >
              <ScenarioTerrainLayer
                map={scenario.terrainSnapshot}
                hiddenLayerIds={hiddenTerrainLayerIds}
                interactive={mode === 'terrain' && placementUnitId === null}
                selectedFeatureId={selectedFeatureId}
                onSelectFeature={selectFeature}
              />
            </Group>
          </Layer>

          <Layer>
            <Group
              x={camera.offsetX}
              y={camera.offsetY}
              scaleX={camera.scale}
              scaleY={camera.scale}
            >
              <UnitFormationLayer
                scenario={scenario}
                hiddenFactionIds={hiddenFactionIds}
                formationFontSizes={formationFontSizes}
                formationLabelFormats={formationLabelFormats}
                uppercaseLabels={uppercaseFormationLabels}
                dynamicFrontage={dynamicFrontage}
                interactive={mode === 'units' && placementUnitId === null}
                formationNodes={formationNodes}
                labelNodes={labelNodes}
                registerNode={registerFormationNode}
                registerLabelNode={registerLabelNode}
              />
            </Group>

            <UnitFormationTransformer
              nodeMap={formationNodes}
              nodeVersion={formationNodeVersion}
              selectedUnitIds={mode === 'units' ? selectedUnitIds : []}
              enabled={mode === 'units' && placementUnitId === null}
              resizable={selectedUnitIds.length === 1 && selectedIsRectangle}
            />
          </Layer>

          {marqueeRect ? (
            <Layer listening={false}>
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                fill="rgba(95, 115, 82, 0.12)"
                stroke="#5f7352"
                strokeWidth={1.5}
                dash={[5, 4]}
              />
            </Layer>
          ) : null}
        </Stage>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-medium tracking-wide text-[#6b6353]">
        <span className="rounded-md border border-[#cfc3a8] bg-[#f8f2e5]/90 px-2 py-1">
          World{' '}
          <span ref={cursorReadoutRef}>
            {cursorWorld ? `${Math.round(cursorWorld.x)}, ${Math.round(cursorWorld.y)}` : '—'}
          </span>
        </span>
        <span className="rounded-md border border-[#cfc3a8] bg-[#f8f2e5]/90 px-2 py-1">
          {placementUnitId
            ? 'Click the map to deploy the selected formation · Esc cancels'
            : mode === 'terrain'
              ? 'Terrain snapshot · click a feature to inspect · drag empty canvas to pan'
              : selectedUnitIds.length > 1
                ? `${selectedUnitIds.length} formations selected · drag any to move · top handle rotates all`
                : selectedUnitIds.length === 1
                  ? 'Drag the formation · side handles resize frontage · top handle rotates'
                  : 'Drag empty canvas to box-select · Shift-click adds · double-click a parent selects its command'}
        </span>
      </div>
    </div>
  );
}
