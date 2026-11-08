import type { ReactNode } from 'react';
import { useEditorStore, type DrawMode, type EditorTool } from '../../state/editorStore';
import { isDrawKind } from './kinds';

interface ToolDefinition {
  id: EditorTool;
  label: string;
  shortcut: string;
  icon: ReactNode;
}

interface ToolGroup {
  title: string;
  tools: ToolDefinition[];
}

interface DrawModeDefinition {
  id: DrawMode;
  label: string;
  shortcut: string;
  description: string;
  icon: ReactNode;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const DRAW_MODES: DrawModeDefinition[] = [
  {
    id: 'freehand',
    label: 'Freehand',
    shortcut: 'A',
    description: 'Draw areas and paths with a freehand stroke',
    icon: (
      <svg {...iconProps}>
        <path d="m4 20 4-1 10-10-3-3L5 16l-1 4Z" />
        <path d="m13 6 3 3" />
      </svg>
    ),
  },
  {
    id: 'vertices',
    label: 'Vertices',
    shortcut: 'E',
    description: 'Place vertices for areas and paths',
    icon: (
      <svg {...iconProps}>
        <path d="M4 19 9 8l6 6.5L20 5" />
        <circle cx="4" cy="19" r="1.1" />
        <circle cx="9" cy="8" r="1.1" />
        <circle cx="15" cy="14.5" r="1.1" />
        <circle cx="20" cy="5" r="1.1" />
      </svg>
    ),
  },
];

const NAVIGATE_TOOLS: ToolDefinition[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'V',
    icon: (
      <svg {...iconProps}>
        <path d="M5 3.5 18 12l-5.6 1.2L9.4 19 5 3.5Z" />
      </svg>
    ),
  },
  {
    id: 'pan',
    label: 'Pan',
    shortcut: 'H',
    icon: (
      <svg {...iconProps}>
        <path d="M7.5 11V6.8a1.3 1.3 0 0 1 2.6 0V11" />
        <path d="M10.1 10.5V5.8a1.3 1.3 0 0 1 2.6 0v4.7" />
        <path d="M12.7 10.5V6.9a1.3 1.3 0 0 1 2.6 0v4.6" />
        <path d="M15.3 11.5v-2a1.3 1.3 0 0 1 2.6 0v4.2c0 3.4-2.2 6.3-5.7 6.3-2.5 0-4.1-1.2-5.4-3.3L4.9 13a1.4 1.4 0 0 1 2.2-1.7l1.6 1.8" />
      </svg>
    ),
  },
];

const TOOL_GROUPS: ToolGroup[] = [
  {
    title: 'Areas',
    tools: [
      {
        id: 'forest',
        label: 'Forest',
        shortcut: 'F',
        icon: (
          <svg {...iconProps}>
            <path d="M12 3 7.5 10H10l-4 6h12l-4-6h2.5L12 3Z" />
            <path d="M12 16v5" />
          </svg>
        ),
      },
      {
        id: 'field',
        label: 'Field',
        shortcut: 'G',
        icon: (
          <svg {...iconProps}>
            <path d="M4 6h16v13H4z" />
            <path d="M4 10h16M4 14h16M8 6v13M16 6v13" />
          </svg>
        ),
      },
      {
        id: 'lake',
        label: 'Water',
        shortcut: 'W',
        icon: (
          <svg {...iconProps}>
            <path d="M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
            <path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          </svg>
        ),
      },
      {
        id: 'swamp',
        label: 'Marsh',
        shortcut: 'M',
        icon: (
          <svg {...iconProps}>
            <path d="M6 20V9M6 12l-2-2M6 15l2-2" />
            <path d="M12 20V5M12 9l-2-2M12 13l2-2" />
            <path d="M18 20v-7M18 15l-2-2M18 17l2-2" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Paths',
    tools: [
      {
        id: 'river',
        label: 'River',
        shortcut: 'R',
        icon: (
          <svg {...iconProps}>
            <path d="M4 5c4 2.5 8 2.5 12 0" />
            <path d="M4 12c4 2.5 8 2.5 12 0" />
            <path d="M4 19c4 2.5 8 2.5 12 0" />
          </svg>
        ),
      },
      {
        id: 'road',
        label: 'Road',
        shortcut: 'O',
        icon: (
          <svg {...iconProps}>
            <path d="M7 3v18M17 3v18" />
            <path d="M12 5v3M12 11v3M12 17v2" />
          </svg>
        ),
      },
      {
        id: 'contour',
        label: 'Contour',
        shortcut: 'C',
        icon: (
          <svg {...iconProps}>
            <path d="M4 19c0-6 3.5-11 8-11s8 5 8 11" />
            <path d="M8 19c0-3.5 2-6 4-6s4 2.5 4 6" />
          </svg>
        ),
      },
      {
        id: 'customPath',
        label: 'Path',
        shortcut: 'P',
        icon: (
          <svg {...iconProps}>
            <path d="M4 19 9 8l6 6.5L20 5" />
            <circle cx="4" cy="19" r="1.1" />
            <circle cx="9" cy="8" r="1.1" />
            <circle cx="15" cy="14.5" r="1.1" />
            <circle cx="20" cy="5" r="1.1" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Symbols',
    tools: [
      {
        id: 'building',
        label: 'Building',
        shortcut: 'B',
        icon: (
          <svg {...iconProps}>
            <path d="M4 20V9l8-5 8 5v11" />
            <path d="M9 20v-6h6v6" />
          </svg>
        ),
      },
      {
        id: 'bridge',
        label: 'Bridge',
        shortcut: 'K',
        icon: (
          <svg {...iconProps}>
            <path d="M3 16h18" />
            <path d="M5 16c0-4 3-7 7-7s7 3 7 7" />
            <path d="M9 16v-2M15 16v-2" />
          </svg>
        ),
      },
      {
        id: 'fortification',
        label: 'Fort',
        shortcut: 'N',
        icon: (
          <svg {...iconProps}>
            <path d="M4 20V8h3V5h3v3h4V5h3v3h3v12H4Z" />
          </svg>
        ),
      },
      {
        id: 'label',
        label: 'Label',
        shortcut: 'T',
        icon: (
          <svg {...iconProps}>
            <path d="M4.5 6.5V4.8h15v1.7" />
            <path d="M12 4.8v14.4" />
            <path d="M8.8 19.2h6.4" />
          </svg>
        ),
      },
    ],
  },
];

const toolButtonClass = (active: boolean): string =>
  [
    'flex min-h-[2.35rem] w-full flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 text-[0.56rem] leading-tight font-semibold transition-colors',
    active
      ? 'bg-[#3d4b3f] text-[#f7f2e6] shadow-sm'
      : 'text-[#5f594b] hover:bg-[#e6dbc6] hover:text-[#2f2b23]',
  ].join(' ');

export function ToolRail() {
  const tool = useEditorStore((state) => state.tool);
  const drawMode = useEditorStore((state) => state.drawMode);
  const setTool = useEditorStore((state) => state.setTool);
  const setDrawMode = useEditorStore((state) => state.setDrawMode);

  return (
    <aside
      aria-label="Terrain tools"
      className="flex w-[7.4rem] shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#d8cdb5] bg-[#f6efe0] p-1.5"
    >
      <div>
        <p className="mb-1 px-1 text-[0.55rem] font-semibold tracking-[0.12em] text-[#8a7a58] uppercase">
          Navigate
        </p>
        <div className="grid grid-cols-2 gap-1">
          {NAVIGATE_TOOLS.map((definition) => (
            <button
              key={definition.id}
              type="button"
              title={`${definition.label} (${definition.shortcut})`}
              aria-label={`${definition.label} tool`}
              aria-pressed={definition.id === tool}
              onClick={() => setTool(definition.id)}
              className={toolButtonClass(definition.id === tool)}
            >
              {definition.icon}
              <span>{definition.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 px-1 text-[0.55rem] font-semibold tracking-[0.12em] text-[#8a7a58] uppercase">
          Draw
        </p>
        <div className="grid grid-cols-2 gap-1">
          {DRAW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              title={`${mode.label} (${mode.shortcut}) — ${mode.description}`}
              aria-label={`${mode.label} mode`}
              aria-pressed={mode.id === drawMode}
              onClick={() => setDrawMode(mode.id)}
              className={toolButtonClass(mode.id === drawMode)}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {TOOL_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-1 text-[0.55rem] font-semibold tracking-[0.12em] text-[#8a7a58] uppercase">
            {group.title}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {group.tools.map((definition) => {
              const active = definition.id === tool;
              const modeHint = isDrawKind(definition.id) ? ` · ${drawMode}` : '';
              return (
                <button
                  key={definition.id}
                  type="button"
                  title={`${definition.label} (${definition.shortcut})${modeHint}`}
                  aria-label={`${definition.label} tool`}
                  aria-pressed={active}
                  onClick={() => setTool(definition.id)}
                  className={toolButtonClass(active)}
                >
                  {definition.icon}
                  <span>{definition.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
