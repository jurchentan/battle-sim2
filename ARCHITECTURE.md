# Architecture

Status: M3 complete (terrain library). Terrain editing supports area, path,
symbol, and label tools, style controls, layer visibility/locking/z-order,
object stacking and duplication, and simplified freehand drawing. Terrain
documents persist in IndexedDB with autosave, document management, and versioned
JSON import/export.

## 1. Stack and tooling

| Concern     | Choice                                       |
| ----------- | -------------------------------------------- |
| Build/dev   | Vite 8, React 19, TypeScript 7 (strict)      |
| Canvas      | Konva / react-konva                          |
| State       | Zustand (workspace, camera, editor, terrain) |
| Validation  | Zod 4                                        |
| Persistence | Dexie / IndexedDB                            |
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
  features/files/      versioned JSON import/export and downloads
  features/library/    Dexie terrain library, document helpers, library dialog
  features/terrain/    toolbar, tool rail, layers, inspector, shortcuts, factories
  models/              TypeScript types, Zod schemas, seed documents, id helper
  state/               Zustand stores (workspace, camera, editor, terrain, library)
  styles/              global Tailwind entry and theme tokens
```

Planned additions follow the original spec:

```text
  features/armies/     roster editor and hierarchy (M4)
  features/units/      formation rendering and placement (M5)
  features/phases/     timeline, phase snapshots, annotations (M6)
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

- `width`/`height` define the finite canvas, with `originX`/`originY` as the
  world-coordinate position of its top-left corner. Older version-1 documents
  default both origins to zero during validation and library hydration.
- `originalCanvas` records the size and origin the map was created with so an
  expanded canvas can be reverted. It is optional for backward compatibility;
  legacy documents capture their current bounds on first expansion.
- Canvas dimensions are capped at 10000 document units per axis.
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
  (`terrainStore`, `editorStore`, `cameraStore`) plus `libraryStore` for the
  active saved document and persistence status.
- Documents are normalized by ID; selection stores IDs, never object references.
- Every document edit goes through explicit named actions (`addFeature`,
  `updateFeature`, `deleteFeature`, `duplicateFeature`, `moveFeature`,
  `setLayerVisible`, `setLayerLocked`, `moveLayer`, `renameDocument`,
  `expandCanvas`, later phase/roster actions).
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
- A terrain store subscription schedules a 700 ms debounced IndexedDB write after
  each committed edit. Save status moves through `unsaved`, `saving`, and `saved`
  (or `error`); loading a document suppresses autosave so hydration is not
  mistaken for an edit. Opening, creating, importing, or deleting a document
  flushes pending edits first.

## 5. Canvas and interaction

- Single document coordinate space (default 2000 × 1400), centered and fitted in
  the viewport with an aged-paper background.
- Canvas expansion adds margin space on any side and moves `originX`/`originY`
  for top/left additions. Existing features and camera-independent world
  coordinates never move; the paper rectangle renders at the document origin.
- The expansion dialog previews the result and can revert the canvas to the
  recorded `originalCanvas` bounds as one undoable edit. Features outside the
  original bounds are retained.
- An editor-only outside-canvas mode controls expanded regions without changing
  the document: `show` renders everything, `dim` darkens expansion strips, and
  `hide` clips features and paper to the original bounds. Fit uses the visible
  bounds for the active mode.
- Camera transform `{ scale, offsetX, offsetY }` with tested
  `screenToWorld`/`worldToScreen`, cursor-centred wheel zoom, pan (pan tool,
  left-drag on empty canvas, middle-drag, or Space-drag), and origin-aware
  fit-to-map.
- Document geometry is stored in world coordinates; camera changes never rewrite
  geometry.
- New maps are created from a dialog with a name, preset/custom starting size,
  and a reserved non-interactive area for future faction and campaign / war
  folder selectors.
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

## 6. Persistence and file formats

M3 adds the `terrainMaps` table to a Dexie database named `battle-map-editor`,
indexed by `id`, `name`, and `updatedAt`. Future milestones add roster and
scenario tables through Dexie schema versions. `localStorage` stores only the ID
of the last open terrain map (a UI preference), never document contents.

Autosave is debounced inside `libraryStore`; opening, creating, importing, or
deleting flushes pending edits first. A missing final flush is avoided by
writing the current in-memory document on every save, with the save status
visible in the toolbar. Failed saves leave the editor open and display the error.

Versioned JSON formats:

- `*.terrain.json` — `TerrainMap` (`schemaVersion: 1`)
- `*.army.json` — `ArmyRoster` (planned, M4)
- `*.battle.json` — `BattleScenario` (planned, M7)

Terrain import pipeline:

1. Parse JSON safely.
2. Require an integer `schemaVersion`; reject versions newer than this app.
3. Run the migration registry from the file version to the current version, or
   reject with a clear unsupported-version error.
4. Validate with `terrainMapSchema`, including layer references, geometry/style
   compatibility, and ID uniqueness.
5. Only after validation succeeds, add the map to the library and open it. If
   the incoming ID already exists, the import receives a new ID so it cannot
   overwrite existing work. Failures leave the active document untouched.

Downloads use the serialized document and a normalized `.terrain.json` filename.
PNG export remains a later milestone.

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
freehand drawing. M3 adds terrain document/import-export unit tests plus
Playwright coverage for autosave reload recovery, library create/copy/rename/
delete/open flows, export/import semantic round-tripping, custom-size creation,
canvas expansion with undo/redo and reload persistence, outside-canvas
show/grey/hide modes, reverting to recorded original bounds, and maximum-size
rejection.

## 8. Conventions

- Strict TypeScript; no `any` in application code.
- Keep Konva nodes and screen-space values out of persisted documents.
- Prefer small components/features over a monolithic `App.tsx`.
- Domain behavior must be testable without mounting React or a canvas.
- UI controls must be functional; no decorative buttons that do nothing.
- Do not implement future milestones opportunistically; stop at the agreed gate.
