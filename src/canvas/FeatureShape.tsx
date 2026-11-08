import type Konva from 'konva';
import { Line, Rect, Star, Text } from 'react-konva';
import type { Point, TerrainFeature } from '../models';
import { getAreaPatternImage } from './areaPattern';
import { flattenPoints, pointsCenter, pointsEqual } from './geometry';

interface FeatureShapeProps {
  feature: TerrainFeature;
  interactive: boolean;
  draggable: boolean;
  onSelect: (featureId: string) => void;
  onChange: (feature: TerrainFeature) => void;
  registerNode: (featureId: string, node: Konva.Node | null) => void;
}

function toWorldPoints(node: Konva.Node, points: readonly Point[]): Point[] {
  const transform = node.getTransform();
  return points.map((point) => {
    const transformed = transform.point(point);
    return { x: transformed.x, y: transformed.y };
  });
}

function selectHandler(
  featureId: string,
  onSelect: (featureId: string) => void,
): (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void {
  return (event) => {
    event.cancelBubble = true;
    onSelect(featureId);
  };
}

export function FeatureShape({
  feature,
  interactive,
  draggable,
  onSelect,
  onChange,
  registerNode,
}: FeatureShapeProps) {
  switch (feature.geometry.type) {
    case 'polygon':
    case 'polyline':
      return (
        <LineFeature
          feature={feature}
          interactive={interactive}
          draggable={draggable}
          onSelect={onSelect}
          onChange={onChange}
          registerNode={registerNode}
        />
      );
    case 'textAnchor':
      return (
        <TextFeature
          feature={feature}
          interactive={interactive}
          draggable={draggable}
          onSelect={onSelect}
          onChange={onChange}
          registerNode={registerNode}
        />
      );
    case 'point':
      return (
        <PointFeature
          feature={feature}
          interactive={interactive}
          draggable={draggable}
          onSelect={onSelect}
          onChange={onChange}
          registerNode={registerNode}
        />
      );
  }
}

function LineFeature({
  feature,
  interactive,
  draggable,
  onSelect,
  onChange,
  registerNode,
}: FeatureShapeProps) {
  const geometry = feature.geometry;
  const style = feature.style;
  if (
    (geometry.type !== 'polygon' && geometry.type !== 'polyline') ||
    (style.type !== 'area' && style.type !== 'path')
  ) {
    return null;
  }

  const closed = geometry.type === 'polygon';
  const center = pointsCenter(geometry.points);
  const relativePoints = geometry.points.map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
  }));
  const patternImage =
    closed && style.type === 'area'
      ? (getAreaPatternImage(style) as unknown as HTMLImageElement | undefined)
      : undefined;

  const commitGeometry = (node: Konva.Node): void => {
    const nextPoints = toWorldPoints(node, relativePoints);
    node.scale({ x: 1, y: 1 });
    node.rotation(0);
    node.position(pointsCenter(nextPoints));

    if (pointsEqual(nextPoints, geometry.points)) return;
    onChange({
      ...feature,
      geometry: { ...geometry, points: nextPoints },
    });
  };

  return (
    <Line
      ref={(node) => registerNode(feature.id, node)}
      x={center.x}
      y={center.y}
      points={flattenPoints(relativePoints)}
      closed={closed}
      fill={closed && style.type === 'area' && !patternImage ? style.fillColor : undefined}
      fillPatternImage={patternImage}
      fillPatternRepeat="repeat"
      stroke={style.strokeColor}
      strokeWidth={style.strokeWidth}
      opacity={style.opacity}
      dash={style.type === 'path' ? style.dash : []}
      lineCap={style.type === 'path' ? style.lineCap : 'round'}
      lineJoin="round"
      hitStrokeWidth={14}
      listening={interactive}
      draggable={interactive && draggable}
      onClick={selectHandler(feature.id, onSelect)}
      onTap={selectHandler(feature.id, onSelect)}
      onDragEnd={(event) => commitGeometry(event.target)}
      onTransformEnd={(event) => commitGeometry(event.target)}
    />
  );
}

function TextFeature({
  feature,
  interactive,
  draggable,
  onSelect,
  onChange,
  registerNode,
}: FeatureShapeProps) {
  const geometry = feature.geometry;
  const style = feature.style;
  if (geometry.type !== 'textAnchor' || style.type !== 'text') {
    return null;
  }

  const commitTransform = (node: Konva.Node): void => {
    const scale = Math.sqrt(Math.abs(node.scaleX() * node.scaleY()));
    const fontSize = Math.max(4, Math.round(style.fontSize * scale * 100) / 100);
    node.scale({ x: 1, y: 1 });

    const nextGeometry = {
      ...geometry,
      position: { x: node.x(), y: node.y() },
      rotationDegrees: node.rotation(),
    };

    if (
      fontSize === style.fontSize &&
      nextGeometry.position.x === geometry.position.x &&
      nextGeometry.position.y === geometry.position.y &&
      nextGeometry.rotationDegrees === geometry.rotationDegrees
    ) {
      return;
    }

    onChange({
      ...feature,
      geometry: nextGeometry,
      style: { ...style, fontSize },
    });
  };

  const commitDrag = (node: Konva.Node): void => {
    const position = { x: node.x(), y: node.y() };
    if (position.x === geometry.position.x && position.y === geometry.position.y) return;

    onChange({
      ...feature,
      geometry: { ...geometry, position },
    });
  };

  return (
    <Text
      ref={(node) => registerNode(feature.id, node)}
      x={geometry.position.x}
      y={geometry.position.y}
      rotation={geometry.rotationDegrees}
      text={feature.name ?? 'Label'}
      fontFamily={style.fontFamily}
      fontSize={style.fontSize}
      fill={style.textColor}
      listening={interactive}
      draggable={interactive && draggable}
      onClick={selectHandler(feature.id, onSelect)}
      onTap={selectHandler(feature.id, onSelect)}
      onDragEnd={(event) => commitDrag(event.target)}
      onTransformEnd={(event) => commitTransform(event.target)}
    />
  );
}

function PointFeature({
  feature,
  interactive,
  draggable,
  onSelect,
  onChange,
  registerNode,
}: FeatureShapeProps) {
  const geometry = feature.geometry;
  const style = feature.style;
  if (geometry.type !== 'point' || style.type !== 'marker') {
    return null;
  }

  const commitDrag = (node: Konva.Node): void => {
    const position = { x: node.x(), y: node.y() };
    if (position.x === geometry.position.x && position.y === geometry.position.y) return;

    onChange({
      ...feature,
      geometry: { ...geometry, position },
    });
  };

  const sharedProps = {
    x: geometry.position.x,
    y: geometry.position.y,
    fill: style.fillColor,
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    listening: interactive,
    draggable: interactive && draggable,
    onClick: selectHandler(feature.id, onSelect),
    onTap: selectHandler(feature.id, onSelect),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => commitDrag(event.target),
  };

  if (feature.kind === 'bridge') {
    return (
      <Rect
        ref={(node) => registerNode(feature.id, node)}
        {...sharedProps}
        width={28}
        height={12}
        offsetX={14}
        offsetY={6}
        cornerRadius={2}
      />
    );
  }

  if (feature.kind === 'building') {
    return (
      <Rect
        ref={(node) => registerNode(feature.id, node)}
        {...sharedProps}
        width={18}
        height={18}
        offsetX={9}
        offsetY={9}
      />
    );
  }

  return (
    <Star
      ref={(node) => registerNode(feature.id, node)}
      {...sharedProps}
      numPoints={5}
      innerRadius={4.5}
      outerRadius={10}
    />
  );
}
