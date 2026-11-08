import type { AreaStyle } from '../models';

const TILE_SIZE = 24;
const HATCH_SPACING = 8;
const cache = new Map<string, HTMLCanvasElement>();

function drawHatch(
  context: CanvasRenderingContext2D,
  strokeColor: string,
  direction: 'left' | 'right',
): void {
  context.strokeStyle = strokeColor;
  context.lineWidth = 1.4;
  context.globalAlpha = 0.7;

  for (let offset = -TILE_SIZE; offset <= TILE_SIZE * 2; offset += HATCH_SPACING) {
    context.beginPath();
    if (direction === 'left') {
      context.moveTo(offset, TILE_SIZE);
      context.lineTo(offset + TILE_SIZE, 0);
    } else {
      context.moveTo(offset, 0);
      context.lineTo(offset + TILE_SIZE, TILE_SIZE);
    }
    context.stroke();
  }
}

function drawDots(context: CanvasRenderingContext2D, strokeColor: string): void {
  context.fillStyle = strokeColor;
  context.globalAlpha = 0.65;

  for (const [x, y] of [
    [6, 6],
    [18, 18],
    [18, 6],
    [6, 18],
  ]) {
    context.beginPath();
    context.arc(x, y, 1.3, 0, Math.PI * 2);
    context.fill();
  }
}

export function getAreaPatternImage(style: AreaStyle): HTMLCanvasElement | undefined {
  if (style.pattern === 'solid') return undefined;

  const key = `${style.pattern}:${style.fillColor}:${style.strokeColor}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;

  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.fillStyle = style.fillColor;
  context.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  if (style.pattern === 'hatch-left' || style.pattern === 'hatch-right') {
    drawHatch(context, style.strokeColor, style.pattern === 'hatch-left' ? 'left' : 'right');
  } else {
    drawDots(context, style.strokeColor);
  }

  cache.set(key, canvas);
  return canvas;
}
