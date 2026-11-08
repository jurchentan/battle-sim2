import type { AreaStyle, PathStyle, TerrainFeature } from '../../models';
import { ColorField, NumberField, SelectField, TextField } from './fields';

const AREA_PATTERN_OPTIONS: readonly { value: AreaStyle['pattern']; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'hatch-left', label: 'Hatch left' },
  { value: 'hatch-right', label: 'Hatch right' },
  { value: 'dots', label: 'Dots' },
];

const LINE_CAP_OPTIONS: readonly { value: PathStyle['lineCap']; label: string }[] = [
  { value: 'round', label: 'Round' },
  { value: 'butt', label: 'Butt' },
  { value: 'square', label: 'Square' },
];

const DASH_PRESETS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Solid' },
  { value: '10,6', label: 'Dashed' },
  { value: '2,4', label: 'Dotted' },
  { value: '6,4', label: 'Fine dash' },
  { value: '16,8', label: 'Long dash' },
];

const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia' },
  {
    value: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    label: 'Palatino',
  },
  { value: 'ui-sans-serif, system-ui, sans-serif', label: 'Sans serif' },
  { value: "'Courier New', monospace", label: 'Monospace' },
];

function dashOptions(current: readonly number[]): readonly { value: string; label: string }[] {
  const value = current.join(',');
  if (DASH_PRESETS.some((preset) => preset.value === value)) return DASH_PRESETS;
  return [...DASH_PRESETS, { value, label: `Custom (${value})` }];
}

function parseDash(value: string): number[] {
  if (!value.trim()) return [];
  return value
    .split(/[\s,]+/)
    .map(Number)
    .filter((number) => Number.isFinite(number) && number >= 0);
}

function fontOptions(current: string): readonly { value: string; label: string }[] {
  if (FONT_OPTIONS.some((option) => option.value === current)) return FONT_OPTIONS;
  return [...FONT_OPTIONS, { value: current, label: current }];
}

export function FeatureStyleEditor({
  feature,
  onChange,
}: {
  feature: TerrainFeature;
  onChange: (feature: TerrainFeature) => void;
}) {
  const style = feature.style;

  if (style.type === 'area') {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Fill color"
            value={style.fillColor}
            onCommit={(fillColor) => onChange({ ...feature, style: { ...style, fillColor } })}
          />
          <ColorField
            label="Stroke color"
            value={style.strokeColor}
            onCommit={(strokeColor) => onChange({ ...feature, style: { ...style, strokeColor } })}
          />
          <NumberField
            label="Stroke width"
            value={style.strokeWidth}
            min={0}
            max={24}
            step={0.5}
            onCommit={(strokeWidth) => onChange({ ...feature, style: { ...style, strokeWidth } })}
          />
          <NumberField
            label="Opacity"
            value={style.opacity}
            min={0}
            max={1}
            step={0.05}
            onCommit={(opacity) => onChange({ ...feature, style: { ...style, opacity } })}
          />
        </div>
        <SelectField
          label="Fill pattern"
          value={style.pattern}
          options={AREA_PATTERN_OPTIONS}
          onChange={(pattern) => onChange({ ...feature, style: { ...style, pattern } })}
        />
      </div>
    );
  }

  if (style.type === 'path') {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Stroke color"
            value={style.strokeColor}
            onCommit={(strokeColor) => onChange({ ...feature, style: { ...style, strokeColor } })}
          />
          <NumberField
            label="Stroke width"
            value={style.strokeWidth}
            min={0.1}
            max={30}
            step={0.5}
            onCommit={(strokeWidth) => onChange({ ...feature, style: { ...style, strokeWidth } })}
          />
          <NumberField
            label="Opacity"
            value={style.opacity}
            min={0}
            max={1}
            step={0.05}
            onCommit={(opacity) => onChange({ ...feature, style: { ...style, opacity } })}
          />
          <SelectField
            label="Line cap"
            hint="Shape of the stroke ends on open paths."
            value={style.lineCap}
            options={LINE_CAP_OPTIONS}
            onChange={(lineCap) => onChange({ ...feature, style: { ...style, lineCap } })}
          />
        </div>
        <SelectField
          label="Dash pattern"
          value={style.dash.join(',')}
          options={dashOptions(style.dash)}
          onChange={(value) =>
            onChange({ ...feature, style: { ...style, dash: parseDash(value) } })
          }
        />
        <TextField
          label="Custom dash"
          value={style.dash.join(', ')}
          placeholder="e.g. 10, 6"
          onCommit={(value) =>
            onChange({ ...feature, style: { ...style, dash: parseDash(value) } })
          }
        />
      </div>
    );
  }

  if (style.type === 'marker') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Fill color"
          value={style.fillColor}
          onCommit={(fillColor) => onChange({ ...feature, style: { ...style, fillColor } })}
        />
        <ColorField
          label="Stroke color"
          value={style.strokeColor}
          onCommit={(strokeColor) => onChange({ ...feature, style: { ...style, strokeColor } })}
        />
        <NumberField
          label="Stroke width"
          value={style.strokeWidth}
          min={0}
          max={24}
          step={0.5}
          onCommit={(strokeWidth) => onChange({ ...feature, style: { ...style, strokeWidth } })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Text color"
          value={style.textColor}
          onCommit={(textColor) => onChange({ ...feature, style: { ...style, textColor } })}
        />
        <NumberField
          label="Font size"
          value={style.fontSize}
          min={6}
          max={200}
          step={1}
          onCommit={(fontSize) => onChange({ ...feature, style: { ...style, fontSize } })}
        />
      </div>
      <SelectField
        label="Font family"
        value={style.fontFamily}
        options={fontOptions(style.fontFamily)}
        onChange={(fontFamily) => onChange({ ...feature, style: { ...style, fontFamily } })}
      />
    </div>
  );
}
