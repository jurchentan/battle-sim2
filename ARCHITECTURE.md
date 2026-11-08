# Architecture

Status: M2 complete (hand-drawn terrain editor). Terrain editing supports area,
path, symbol, and label tools, style controls, layer visibility/locking/z-order,
object stacking and duplication, and simplified freehand drawing. Persistence
begins in M3.

## 1. Stack and tooling

| Concern     | Choice                                       |
| ----------- | -------------------------------------------- |
| Build/dev   | Vite 8, React 19, TypeScript 7 (strict)      |
| Canvas      | Konva / react-konva                          |
| State       | Zustand (workspace, camera, editor, terrain) |
| Validation  | Zod 4                                        |
| Persistence | Dexie / IndexedDB (from M3)                  |
| Styling     | Tailwind CSS 4 via `@tailwindcss/vite`       |
| Unit tests  | Vitest                                       |
| E2E tests   | Playwright                                   |
| Lint/format | Oxlint, Prettier                             |

Scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `test:watch`,
`test:e2e`, `preview`.

`npm run build` runs `tsc -b` before Vite, so type errors fail the build. Strict
mode is enabled explicitly in `tsconfig.app.json`.

## 2. Directory layout

```text
src/
  app/                 root shell, workspace tabs, workspace panels
  canvas/              camera math/store, geometry, layer ordering, Konva viewport
  components/          reusable presentational components
  features/terrain/    toolbar, tool rail, layers, inspector, shortcuts, factories
  models/              TypeScript types, Zod schemas, seed documents, id helper
  state/               Zustand stores (workspace, camera, editor, terrain history)
  styles/              global Tailwind entry and theme tokens
```

Planned additions follow the original spec:

```text
  features/armies/     roster editor and hierarchy (M4)
  features/units/      formation rendering and placement (M5)
  features/phases/     timeline, phase snapshots, annotations (M6)
  features/library/    IndexedDB library browser (M3-M4)
  features/files/      import/export, validation, PNG capture (M3, M7)
  tests/               cross-cutting model/state/geometry tests
e2e/                   Playwright specs
```

## 3. Domain model

All document types and validation live in `src/models/schemas.ts`; TypeScript
types are inferred from Zod schemas so runtime and compile-time shapes cannot
drift. IDs are stable strings (UUIDs via `createId()`; readable fixed IDs in seed
data) and are never array indices. Seed data is deterministic and independently
cloned in `src/models/seed.ts`.

### TerrainMap

- `layers`: ordered by explicit `zIndex`; each layer has `visible` and `locked`.
- `features`: discriminated `kind` plus geometry/style unions.
- Geometry variants: `polygon`, `polyline`, `point`, `textAnchor`.
- Style variants: `area`, `path`, `marker`, `text`.
- Kind/geometry and kind/style compatibility is validated (for example, `forest`
  must be a polygon with an area style; `label` must be a text anchor with text).
- Features may not reference missing layers; layer and feature IDs must be unique.

### ArmyRoster

- `factions`, `commanders`, `units` in one reusable document.
- Units carry `factionId`, `parentUnitId`, `commanderId`, `echelon`, `unitType`,
  initial strength, and a default symbol style.
- Validation rejects duplicate IDs, unknown factions/commanders, dangling parents,
  cross-faction parents, negative strength, and direct or indirect hierarchy
  cycles.

### BattleScenario

- Embeds deep `terrainSnapshot` and `rosterSnapshot`; no live references to the
  libraries.
- Ordered `phases`, each with `unitStates` keyed by unit ID and an annotation
  list.
- Unit state is the complete set of phase-varying data: position, rotation,
  frontage, optional shape points, visibility, effective strength, status,
  commander override, label override, and notes.
- Scenario validation rejects duplicate phase IDs, missing active phase, states
  for unknown units, unknown commander overrides, unknown annotation-linked
  units, and kind/geometry mismatches.
- Scenario snapshots are created by copying; they are not linked to library
  documents.

### Identity rules

- Shared identity and organization: unit definitions, commanders, factions.
- Phase-local state: positions, strength, status, overrides, annotations.
- Renaming a unit definition changes its global base name; phase naming is
  explicit via label overrides.

## 4. State and undo strategy

- Document and transient UI state are separate Zustand stores
  (`terrainStore`, `editorStore`, `cameraStore`).
- Documents are normalized by ID; selection stores IDs, never object references.
- Every document edit goes through explicit named actions (`addFeature`,
  `updateFeature`, `deleteFeature`, `duplicateFeature`, `moveFeature`,
  `setLayerVisible`, `setLayerLocked`, `moveLayer`, later phase/roster actions).
- Undo/redo is a snapshot history around committed document edits, capped at 100
  entries in `terrainStore`.
- Pointer gestures buffer a preview, then commit once on pointer-up: dragging,
  transforming, and drawing each produce one history entry.
- Name, color, and numeric edits commit on blur; style selects commit
  immediately. Camera navigation, tool choice, and selection are not undoable
  document edits.
- Locked or hidden layers reject document mutations, including add, update,
  delete, duplicate, and z-order changes.
- History is scoped to the open document and reset deliberately on open/create.
- Autosave is debounced and only runs after successful committed edits (M3).

## 5. Canvas and interaction

- Single document coordinate space (default 2000 × 1400), centered and fitted in
  the viewport with an aged-paper background.
- Camera transform `{ scale, offsetX, offsetY }` with tested
  `screenToWorld`/`worldToScreen`, cursor-centred wheel zoom, pan (pan tool,
  left-drag on empty canvas, middle-drag, or Space-drag), and fit-to-map.
- Document geometry is stored in world coordinates; camera changes never rewrite
  geometry.
- Current render order: paper, visible terrain features ordered by layer and
  feature z-index, draft/freehand preview, selection overlay. Hidden layers are
  omitted from rendering.
- Area fills support solid, hatch-left, hatch-right, and dot patterns generated
  as cached canvas tiles; path styles control colour, width, opacity, dash, and
  line cap.
- Tool state, the draw mode (freehand or vertices), and draft points live in
  `editorStore`; committed objects live in `terrainStore`. Selection stores
  feature IDs.
- Area and path tools draw freehand by default. Freehand strokes are sampled,
  simplified with Ramer–Douglas–Peucker, then committed as one edit. Switching
  the draw mode to vertices instead places points that finish with Enter or
  double-click; point symbols and labels place immediately.
- Hit testing and mutation guards respect layer visibility and lock state.
- Konva `Transformer` provides resize/rotate handles; transforms are flattened
  back to world geometry on commit.
- Selection handles and guides live outside exported layers.

## 6. Persistence and file formats (planned)

Three Dexie tables (terrain maps, army rosters, battle scenarios) plus optional
viewport preferences. Autosave uses debounced writes and a saved/unsaved
indicator. `localStorage` is not used for complete projects.

Versioned JSON formats:

- `*.terrain.json` — `TerrainMap` (`schemaVersion: 1`)
- `*.army.json` — `ArmyRoster` (`schemaVersion: 1`)
- `*.battle.json` — `BattleScenario` (`schemaVersion: 1`)

Import pipeline:

1. Parse JSON safely.
2. Validate with Zod against the schema version.
3. Migrate known older versions or reject unsupported versions clearly.
4. Check references and phase invariants (schema refinements plus explicit
   cross-checks).
5. Offer open/replace only after validation; failures leave current work intact.

PNG export renders the active phase only, at configurable resolution, excluding
editor UI and selection handles.

## 7. Testing strategy

- Vitest: schema acceptance/rejection, hierarchy cycles, phase isolation, deep
  copy behavior, camera math, history atomicity, round-trip equivalence, bad
  imports.
- Playwright: workspace switching and terrain draw/undo/redo/zoom, drag, resize,
  and rotate flows; phase-switch flows from M6 onward.
- Stress smoke tests with hundreds of terrain objects and 100–300 formations;
  optimize only after measurement.

M0 covers model validation and seed/phase isolation. M1 adds Vitest coverage for
camera math, layer ordering/interactivity, terrain history, and feature factories,
plus Playwright flows for drawing, undo/redo, zoom, dragging, resizing, and
rotating. M2 adds factory coverage for every area/path/symbol kind, freehand
simplification tests, store tests for delete/duplicate/z-order/layer guards, and
Playwright flows for each tool, style editing, layer hiding/locking, and
freehand drawing.

## 8. Conventions

- Strict TypeScript; no `any` in application code.
- Keep Konva nodes and screen-space values out of persisted documents.
- Prefer small components/features over a monolithic `App.tsx`.
- Domain behavior must be testable without mounting React or a canvas.
- UI controls must be functional; no decorative buttons that do nothing.
- Do not implement future milestones opportunistically; stop at the agreed gate.
