import type Konva from 'konva';
import { useCallback, useMemo, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Faction, UnitDefinition, UnitPhaseState } from '../../models';
import { isUpsideDownRotation } from './scenarioDocuments';

interface UnitFormationShapeProps {
  unit: UnitDefinition;
  faction: Faction;
  state: UnitPhaseState;
  displayName: string;
  renderAsRectangle: boolean;
  renderFrontageLength: number;
  labelFontSize: number;
  uppercaseLabel: boolean;
  interactive: boolean;
  onSelect: (unitId: string) => void;
  onChange: (patch: Partial<UnitPhaseState>) => void;
  registerNode: (unitId: string, node: Konva.Node | null) => void;
}

const LABEL_GAP = 8;
const LABEL_FONT_FAMILY = 'Georgia, serif';

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Measures text with the same font Konva uses so long labels are never clipped. */
function measureLabelWidth(text: string, fontSize: number): number {
  if (!text) return 0;
  if (typeof document !== 'undefined') {
    if (measureContext === undefined) {
      measureContext = document.createElement('canvas').getContext('2d');
    }
    if (measureContext) {
      measureContext.font = `bold ${fontSize}px ${LABEL_FONT_FAMILY}`;
      return measureContext.measureText(text).width;
    }
  }

  // Conservative fallback for non-browser environments.
  return text.length * fontSize * 0.75;
}

function normalizeDegrees(value: number): number {
  return Math.round(value * 100) / 100;
}

export function UnitFormationShape({
  unit,
  faction,
  state,
  displayName,
  renderAsRectangle,
  renderFrontageLength,
  labelFontSize,
  uppercaseLabel,
  interactive,
  onSelect,
  onChange,
  registerNode,
}: UnitFormationShapeProps) {
  const thickness = Math.max(2, unit.defaultSymbolStyle.thickness);
  const rectangleHeight = Math.max(6, thickness);
  const half = renderFrontageLength / 2;
  const displayText = uppercaseLabel ? displayName.toUpperCase() : displayName;
  const measuredTextWidth = useMemo(
    () => measureLabelWidth(displayText, labelFontSize),
    [displayText, labelFontSize],
  );
  const labelWidth = Math.max(72, measuredTextWidth + labelFontSize * 0.6);
  const labelHeight = labelFontSize * 1.3;
  const labelPosition = unit.defaultSymbolStyle.labelPosition;
  const flipLabel = isUpsideDownRotation(state.rotationDegrees);
  const labelTextRotation = flipLabel ? 180 : 0;
  const shapeRef = useRef<Konva.Group | null>(null);
  const labelRef = useRef<Konva.Group | null>(null);
  const setShapeNode = useCallback(
    (node: Konva.Group | null) => {
      shapeRef.current = node;
      registerNode(unit.id, node);
    },
    [registerNode, unit.id],
  );
  const setLabelNode = useCallback((node: Konva.Group | null) => {
    labelRef.current = node;
  }, []);

  const handleSelect = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void => {
    if (!interactive) return;
    event.cancelBubble = true;
    onSelect(unit.id);
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>): void => {
    const node = event.target;
    const x = Math.round(node.x() * 100) / 100;
    const y = Math.round(node.y() * 100) / 100;
    if (x === state.x && y === state.y) return;
    onChange({ x, y });
  };

  const handleTransformEnd = (event: Konva.KonvaEventObject<Event>): void => {
    const node = event.target;
    const scaleX = Math.abs(node.scaleX());
    const x = Math.round(node.x() * 100) / 100;
    const y = Math.round(node.y() * 100) / 100;
    const rotationDegrees = normalizeDegrees(node.rotation());
    const frontageLength = Math.round(state.frontageLength * Math.max(0.01, scaleX) * 100) / 100;

    node.scale({ x: 1, y: 1 });

    if (
      x === state.x &&
      y === state.y &&
      rotationDegrees === state.rotationDegrees &&
      frontageLength === state.frontageLength
    ) {
      return;
    }

    onChange({
      x,
      y,
      rotationDegrees,
      frontageLength: Math.max(20, frontageLength),
    });
  };

  const mirrorDragPosition = (event: Konva.KonvaEventObject<DragEvent>): void => {
    const target = event.target as Konva.Node;
    if (target === shapeRef.current && labelRef.current) {
      labelRef.current.position({ x: target.x(), y: target.y() });
    } else if (target === labelRef.current && shapeRef.current) {
      shapeRef.current.position({ x: target.x(), y: target.y() });
    }
  };

  const mirrorTransform = (event: Konva.KonvaEventObject<Event>): void => {
    const target = event.target as Konva.Node;
    const label = labelRef.current;
    if (target !== shapeRef.current || !label) return;
    label.position({ x: target.x(), y: target.y() });
    label.rotation(target.rotation());
  };

  const dragHandlers = {
    onClick: handleSelect,
    onTap: handleSelect,
    onDragStart: () => onSelect(unit.id),
    onDragMove: mirrorDragPosition,
    onDragEnd: handleDragEnd,
  };

  if (!renderAsRectangle) {
    return (
      <Group
        ref={setShapeNode}
        x={state.x}
        y={state.y}
        rotation={state.rotationDegrees}
        listening={interactive}
        draggable={interactive}
        onTransformEnd={handleTransformEnd}
        {...dragHandlers}
      >
        <Rect
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          fill="#2f2b23"
          opacity={0}
        />
        <Text
          x={0}
          y={0}
          width={labelWidth}
          height={labelHeight}
          offsetX={labelWidth / 2}
          offsetY={labelHeight / 2}
          rotation={labelTextRotation}
          text={displayText}
          align="center"
          verticalAlign="middle"
          wrap="none"
          fontFamily={LABEL_FONT_FAMILY}
          fontSize={labelFontSize}
          fontStyle="bold"
          fill={faction.color}
          listening={false}
        />
      </Group>
    );
  }

  const labelY =
    labelPosition === 'center'
      ? 0
      : labelPosition === 'above'
        ? -(rectangleHeight / 2 + LABEL_GAP + labelHeight / 2)
        : rectangleHeight / 2 + LABEL_GAP + labelHeight / 2;
  const labelColor = labelPosition === 'center' ? (faction.labelColor ?? '#fbf7ed') : faction.color;

  return (
    <>
      <Group
        ref={setShapeNode}
        x={state.x}
        y={state.y}
        rotation={state.rotationDegrees}
        listening={interactive}
        draggable={interactive}
        onTransform={mirrorTransform}
        onTransformEnd={handleTransformEnd}
        {...dragHandlers}
      >
        <Rect
          x={-half}
          y={-rectangleHeight / 2}
          width={renderFrontageLength}
          height={rectangleHeight}
          fill={faction.color}
          opacity={0.94}
        />
      </Group>

      <Group
        ref={setLabelNode}
        x={state.x}
        y={state.y}
        rotation={state.rotationDegrees}
        listening={interactive}
        draggable={interactive}
        {...dragHandlers}
      >
        <Rect
          x={-labelWidth / 2}
          y={labelY - labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          fill="#2f2b23"
          opacity={0}
        />
        <Text
          x={0}
          y={labelY}
          width={labelWidth}
          height={labelHeight}
          offsetX={labelWidth / 2}
          offsetY={labelHeight / 2}
          rotation={labelTextRotation}
          text={displayText}
          align="center"
          verticalAlign="middle"
          wrap="none"
          fontFamily={LABEL_FONT_FAMILY}
          fontSize={labelFontSize}
          fontStyle="bold"
          fill={labelColor}
          listening={false}
        />
      </Group>
    </>
  );
}
