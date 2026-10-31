import type { ReactNode } from 'react';
import { useEditorStore, type EditorTool } from '../../state/editorStore';

interface ToolDefinition {
  id: EditorTool;
  label: string;
  shortcut: string;
  icon: ReactNode;
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const TOOLS: ToolDefinition[] = [
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
  {
    id: 'polygon',
    label: 'Polygon',
    shortcut: 'P',
    icon: (
      <svg {...iconProps}>
        <path d="M5 8.5 12 3l7 4.5-2 8-8 1.5-4-8.5Z" />
        <circle cx="12" cy="3" r="1" />
        <circle cx="19" cy="7.5" r="1" />
        <circle cx="17" cy="15.5" r="1" />
        <circle cx="9" cy="17" r="1" />
        <circle cx="5" cy="8.5" r="1" />
      </svg>
    ),
  },
  {
    id: 'polyline',
    label: 'Path',
    shortcut: 'L',
    icon: (
      <svg {...iconProps}>
        <path d="M4 18.5 9 8l6 6.5L20 5" />
        <circle cx="4" cy="18.5" r="1.2" />
        <circle cx="9" cy="8" r="1.2" />
        <circle cx="15" cy="14.5" r="1.2" />
        <circle cx="20" cy="5" r="1.2" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    shortcut: 'T',
    icon: (
      <svg {...iconProps}>
        <path d="M4.5 6.5V4.8h15v1.7" />
        <path d="M12 4.8v14.4" />
        <path d="M8.8 19.2h6.4" />
      </svg>
    ),
  },
];

export function ToolRail() {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);

  return (
    <aside
      aria-label="Terrain tools"
      className="flex w-[4.6rem] shrink-0 flex-col items-center gap-1 border-r border-[#d8cdb5] bg-[#f6efe0] px-1.5 py-2"
    >
      {TOOLS.map((definition) => {
        const active = definition.id === tool;
        return (
          <button
            key={definition.id}
            type="button"
            title={`${definition.label} (${definition.shortcut})`}
            aria-label={`${definition.label} tool`}
            aria-pressed={active}
            onClick={() => setTool(definition.id)}
            className={[
              'flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[0.62rem] font-semibold transition-colors',
              active
                ? 'bg-[#3d4b3f] text-[#f7f2e6] shadow-sm'
                : 'text-[#5f594b] hover:bg-[#e6dbc6] hover:text-[#2f2b23]',
            ].join(' ')}
          >
            {definition.icon}
            <span>{definition.label}</span>
          </button>
        );
      })}
    </aside>
  );
}
