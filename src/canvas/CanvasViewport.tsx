import type Konva from 'konva';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage } from 'react-konva';
import {
  createPolygonFeature,
  createPolylineFeature,
  createTextFeature,
} from '../features/terrain/factories';
import { isTypingTarget } from '../features/terrain/useEditorShortcuts';
import type { Point, TerrainMap } from '../models';
import { useEditorStore } from '../state/editorStore';
import { useTerrainStore } from '../state/terrainStore';
import { screenToWorld } from './camera';
import { useCameraStore } from './cameraStore';
import { FeatureLayer } from './FeatureLayer';
import { flattenPoints } from './geometry';

const PAPER_FILL: Record<TerrainMap['backgroundStyle'], string> = {
  plain: '#fbf8f0',
  'aged-paper': '#f1e6cd',
  parchment: '#eeddc0',
};

interface CanvasSize {
  width: number;
  height: number;
}

export function CanvasViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const cursorReadoutRef = useRef<HTMLSpanElement>(null);
  const panCleanupRef = useRef<(() => void) | null>(null);
  const previousMapIdRef = useRef<string | null>(null);

  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [cursorWorld, setCursorWorld] = useState<Point | null>(null);

  const map = useTerrainStore((state) => state.document);
  const addFeature = useTerrainStore((state) => state.addFeature);
  const tool = useEditorStore((state) => state.tool);
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const draftPoints = useEditorStore((state) => state.draftPoints);
  const setDraftPoints = useEditorStore((state) => state.setDraftPoints);
  const clearDraft = useEditorStore((state) => state.clearDraft);
  const setTool = useEditorStore((state) => state.setTool);
  const selectFeature = useEditorStore((state) => state.selectFeature);
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
    if (previousMapIdRef.current === null) {
      previousMapIdRef.current = map.id;
      return;
    }
    if (previousMapIdRef.current !== map.id) {
      previousMapIdRef.current = map.id;
      useCameraStore.getState().reset();
    }
  }, [map.id]);

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const cameraState = useCameraStore.getState();
    if (!cameraState.fitted) {
      cameraState.fit(map.width, map.height);
    }
  }, [map.height, map.id, map.width, size.height, size.width]);

  const stopPan = useCallback(() => {
    panCleanupRef.current?.();
    panCleanupRef.current = null;
    setPanning(false);
  }, []);

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

  useEffect(() => stopPan, [stopPan]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        setSpaceDown(true);
        return;
      }

      if (event.key === 'Escape') {
        clearDraft();
        setCursorWorld(null);
        setTool('select');
        selectFeature(null);
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
  }, [clearDraft, selectFeature, setTool]);

  const resolveLayerId = useCallback((): string | null => {
    return activeLayerId ?? map.layers[0]?.id ?? null;
  }, [activeLayerId, map.layers]);

  const finishDraft = useCallback(() => {
    const layerId = resolveLayerId();
    if (!layerId) return;

    let feature = null;
    if (tool === 'polygon' && draftPoints.length >= 3) {
      feature = createPolygonFeature(map, layerId, draftPoints);
    } else if (tool === 'polyline' && draftPoints.length >= 2) {
      feature = createPolylineFeature(map, layerId, draftPoints);
    }

    if (!feature) return;

    addFeature(feature);
    setDraftPoints([]);
    setCursorWorld(null);
    setTool('select');
    selectFeature(feature.id);
  }, [addFeature, draftPoints, map, resolveLayerId, selectFeature, setDraftPoints, setTool, tool]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'Enter' && draftPoints.length > 0) {
        event.preventDefault();
        finishDraft();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPoints.length, finishDraft]);

  const stagePointer = (): Point | null => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    return screenToWorld(useCameraStore.getState().camera, pointer);
  };

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>): void => {
    const stage = event.target.getStage();
    const native = event.evt;

    if (tool === 'pan' || spaceDown || native.button === 1) {
      native.preventDefault();
      beginPan(native.clientX, native.clientY);
      return;
    }

    if (native.button !== 0) return;

    if (tool === 'select') {
      if (event.target === stage) selectFeature(null);
      return;
    }

    const point = stagePointer();
    if (!point) return;

    if (tool === 'polygon' || tool === 'polyline') {
      if (native.detail >= 2) {
        finishDraft();
        return;
      }
      setDraftPoints([...draftPoints, point]);
      setCursorWorld(point);
      return;
    }

    if (tool === 'text') {
      const layerId = resolveLayerId();
      if (!layerId) return;
      const feature = createTextFeature(map, layerId, point);
      addFeature(feature);
      setTool('select');
      selectFeature(feature.id);
    }
  };

  const handleMouseMove = (_event: Konva.KonvaEventObject<MouseEvent>): void => {
    const point = stagePointer();
    if (!point) return;

    if (cursorReadoutRef.current) {
      cursorReadoutRef.current.textContent = `${Math.round(point.x)}, ${Math.round(point.y)}`;
    }

    if (draftPoints.length > 0) {
      setCursorWorld(point);
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

  const previewPoints = cursorWorld ? [...draftPoints, cursorWorld] : draftPoints;
  const cursor =
    panning || tool === 'pan'
      ? panning
        ? 'grabbing'
        : 'grab'
      : spaceDown
        ? 'grab'
        : tool === 'text'
          ? 'text'
          : tool === 'select'
            ? 'default'
            : 'crosshair';

  return (
    <div
      ref={containerRef}
      data-testid="terrain-canvas"
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
            <Group
              x={camera.offsetX}
              y={camera.offsetY}
              scaleX={camera.scale}
              scaleY={camera.scale}
            >
              <Rect
                x={0}
                y={0}
                width={map.width}
                height={map.height}
                fill={PAPER_FILL[map.backgroundStyle]}
                stroke="#c4b48e"
                strokeWidth={2}
                shadowColor="#2f2b23"
                shadowBlur={28}
                shadowOpacity={0.18}
                shadowOffsetY={10}
              />
              <Rect
                x={12}
                y={12}
                width={map.width - 24}
                height={map.height - 24}
                stroke="#d2c3a1"
                strokeWidth={1}
                dash={[3, 7]}
                opacity={0.7}
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
              <FeatureLayer
                map={map}
                selectionEnabled={tool === 'select' && !spaceDown}
                draggable={!spaceDown}
              />
            </Group>
          </Layer>

          <Layer listening={false}>
            <Group
              x={camera.offsetX}
              y={camera.offsetY}
              scaleX={camera.scale}
              scaleY={camera.scale}
            >
              {draftPoints.length > 0 ? (
                <>
                  <Line
                    points={flattenPoints(previewPoints)}
                    closed={tool === 'polygon' && previewPoints.length >= 3}
                    fill={tool === 'polygon' ? 'rgba(125, 143, 106, 0.22)' : undefined}
                    stroke="#3d4b3f"
                    strokeWidth={2}
                    dash={[8, 5]}
                    lineJoin="round"
                  />
                  {draftPoints.map((point, index) => (
                    <Circle
                      key={`${index}-${point.x}-${point.y}`}
                      x={point.x}
                      y={point.y}
                      radius={5}
                      fill="#f7f2e6"
                      stroke="#3d4b3f"
                      strokeWidth={1.5}
                    />
                  ))}
                </>
              ) : null}
            </Group>
          </Layer>
        </Stage>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-medium tracking-wide text-[#6b6353]">
        <span className="rounded-md border border-[#cfc3a8] bg-[#f8f2e5]/90 px-2 py-1">
          World <span ref={cursorReadoutRef}>—</span>
        </span>
        <span className="rounded-md border border-[#cfc3a8] bg-[#f8f2e5]/90 px-2 py-1">
          Wheel to zoom · Space or middle-drag to pan
        </span>
      </div>
    </div>
  );
}
