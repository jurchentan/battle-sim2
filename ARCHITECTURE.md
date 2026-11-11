# Architecture

Status: M5 complete (scenario editor, deployment, and bulk formation selection).
Terrain editing supports area, path, symbol, and label tools, style controls,
layer visibility/locking/z-order, object stacking and duplication, and
simplified freehand drawing. The army workspace manages factions and hierarchical units
with safe reparenting, generated or custom unit names, free-text commanders, a
configurable smallest echelon, per-echelon default strengths, derived formation
strength, and editable unit characteristics. Terrain and roster documents
persist in IndexedDB with autosave, document management, and versioned JSON
import/export. The scenario workspace composes snapshot battles, deploys
formations, and edits active-phase deployment state; scenario persistence and
phases arrive in M6-M7.

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
  features/army/       roster editor, hierarchy helpers, library dialog, file format
  features/files/      versioned JSON import/export and downloads
  features/library/    shared Dexie library, naming helpers, terrain library dialog
  features/scenario/   scenario snapshots, deployment canvas, order of battle, inspector
  features/terrain/    toolbar, tool rail, layers, inspector, shortcuts, factories
  models/              TypeScript types, Zod schemas, seed documents, id helper
  state/               Zustand stores (workspace, camera, editor, terrain, roster, scenario, libraries)
  styles/              global Tailwind entry and theme tokens
```

Planned additions follow the original spec:

```text
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

- `factions` and `units` in one reusable document.
- `smallestUnitEchelon` (default `brigade`) defines the strength-bearing tier.
  Units at or below it carry their own `initialStrength`; formations above it
  expose a derived total of their subordinate units. Legacy rosters without the
  field infer the deepest regular echelon on load so previously saved regiments
  keep working.
- Factions have per-echelon `namingModes`. `numeric-universal` generates names
  such as `1st Brigade`, scoped by faction and echelon; `numeric-local` restarts
  the sequence within each parent formation, so every division has its own 1st,
  2nd, and so on; `commander` generates names such as `Johnsons Brigade` from the
  unit's free-text commander and falls back to universal numbering when no
  commander is set. Each echelon can use a different mode, so a faction can have
  commander-style divisions and numbered brigades. Custom-named units do not
  consume numbers in either numeric mode.
- Units carry `factionId`, optional `customName`, optional free-text
  `commander`, `parentUnitId`, `echelon`, `unitType`, initial strength, and a
  default symbol style. A non-empty `customName` overrides generated naming.
- The hierarchy is strictly ordered: a subordinate must sit below its parent
  (`corps` under `army`, `division` under `corps`, and so on). Equal or inverted
  pairings are rejected by both the schema and the store, so an army can never
  be added under a corps and a division can never be added under a brigade.
  `other` is a leaf that can only appear below a regular formation.
- Factions own their `defaultStrengths` table for infantry, cavalry, and
  artillery at every echelon, editable in the faction form. `defaultUnitStrength`
  reads the unit's faction, and new units receive the value only at or below the
  smallest echelon; `other` has no default.
- `armyRosterSchema` preprocesses legacy rosters: an old unit `name` becomes
  `customName`, `commanderId` resolves against the old `commanders` array into a
  free-text `commander`, an old faction-level `namingMode` is copied onto every
  echelon, missing naming modes and strength tables receive built-in defaults,
  and the old `commanders` array is dropped.
- Validation rejects duplicate IDs, unknown factions, dangling parents,
  cross-faction parents, negative strength, equal or inverted echelon pairings,
  and direct or indirect hierarchy cycles.
- The roster UI groups units by faction in an order-of-battle tree and edits the
  selected formation in place. Parent candidates exclude the unit, its
  descendants, other factions, and units at or below the smallest echelon; the
  store re-checks every reparenting attempt before committing. The default
  hierarchy is army > corps > division > brigade, with regiment and other
  echelons available.
- Every non-leaf formation offers an inline add-subordinate action. Creation
  opens with that parent and the next echelon preselected, default strengths
  prefilled, and a live preview of the generated or custom name.
- Faction deletion is blocked while units still belong to it.

### BattleScenario

- Embeds deep `terrainSnapshot` and `rosterSnapshot`; no live references to the
  libraries.
- Ordered `phases`, each with `unitStates` keyed by unit ID and an annotation
  list.
- Unit state is the complete set of phase-varying data: position, rotation,
  frontage, optional shape points, visibility, effective strength, status, label
  override, and notes.
- Scenario validation rejects duplicate phase IDs, missing active phase, states
  for unknown units, unknown annotation-linked units, and kind/geometry
  mismatches.
- Scenario snapshots are created by copying; they are not linked to library
  documents.

### Identity rules

- Shared identity and organization: unit definitions and factions.
- Phase-local state: positions, strength, status, overrides, annotations.
- Editing a unit's `customName` or `commander` changes its global display name;
  phase naming is explicit via label overrides.

## 4. State and undo strategy

- Document and transient UI state are separate Zustand stores
  (`terrainStore`, `editorStore`, `cameraStore`, `rosterStore`, `scenarioStore`)
  plus `libraryStore` and `rosterLibraryStore` for the active saved documents and
  persistence status. `scenarioEditorStore` holds the mode, the
  `selectedUnitIds` array, the selected terrain feature, placement, display
  preferences, and visibility filters.
- Documents are normalized by ID; selection stores IDs, never object references.
  `selectUnit(id | null)` replaces or clears the formation selection,
  `selectUnits(ids)` replaces it with a deduplicated set,
  `toggleUnitSelection(id)` adds or removes one formation, and
  `ensureUnitSelected(id, additive)` keeps an already-selected formation
  selected when a drag starts.
- Every document edit goes through explicit named actions (`addFeature`,
  `updateFeature`, `deleteFeature`, `duplicateFeature`, `moveFeature`,
  `setLayerVisible`, `setLayerLocked`, `moveLayer`, `renameDocument`,
  `expandCanvas`, `setSmallestUnitEchelon`, `addFaction`, `updateFaction`,
  `deleteFaction`, `addUnit`, `updateUnit`, `reparentUnit`, `deleteUnit`,
  `placeUnit`, `updateUnitState`, `updateUnitStates`, `undeployUnit`,
  `undeployUnits`, later phase actions). The two bulk scenario actions validate
  and commit the whole patch set as one history entry, so a group drag, group
  rotation, or multi-removal is a single undo step and is rejected atomically if
  any formation state is invalid.
- Undo/redo is a snapshot history around committed document edits, capped at 100
  entries in `terrainStore`, `rosterStore`, and `scenarioStore`. Every roster and
  scenario mutation is validated against its Zod schema before entering history,
  so invalid cycles, references, or deployment values never reach the document.
- Pointer gestures buffer a preview, then commit once on pointer-up: dragging,
  transforming, and drawing each produce one history entry.
- Name, color, and numeric edits commit on blur; style selects commit
  immediately. Camera navigation, tool choice, and selection are not undoable
  document edits.
- Locked or hidden layers reject document mutations, including add, update,
  delete, duplicate, and z-order changes.
- History is scoped to the open document and reset deliberately on open/create.
- Terrain and roster store subscriptions schedule 700 ms debounced IndexedDB
  writes after each committed edit. Save status moves through `unsaved`,
  `saving`, and `saved` (or `error`); loading a document suppresses autosave so
  hydration is not mistaken for an edit. Opening, creating, importing, or
  deleting a document flushes pending edits first.

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
- The scenario editor has two explicit modes. Terrain mode renders the snapshot
  read-only for inspection plus transient layer visibility; units mode deploys
  and edits formations. Selecting a formation or feature switches to the
  corresponding mode. Faction and layer visibility filters are transient view
  state and never mutate the scenario document.
- Scenario formation selection is additive and group-aware. An empty left-drag
  in Units mode draws a screen-space marquee and selects every visible formation
  whose shape or label bounds intersect it; Shift-drag unions the hits with the
  existing selection, while an empty drag in Terrain mode still pans. Shift-click
  toggles one formation on the map or in the order of battle, and double-clicking
  a parent on either surface selects the parent plus its visible deployed
  descendants. Screen-space marquee math lives in `features/scenario/marquee.ts`
  and is unit-tested without mounting React.
- Dragging any selected formation moves the whole selection with it. The drag
  session records each member's start position, sibling Konva nodes and their
  separate label nodes are moved during the gesture, and only drag end commits
  one `updateUnitStates` entry. A short click guard after drag end prevents the
  trailing click from collapsing the group back to one formation.
- The multi-selection transformer shows one shared bounding box and rotate
  handle. Rotating it fires `transformend` on every selected node; the layer
  aggregates those patches in a microtask and commits one `updateUnitStates`
  entry. Resize anchors are only enabled for a single rectangle formation.
  The inspector offers a bulk rotation field and bulk removal, and
  Delete/Backspace undeploys the selection through `undeployUnits`.
- Scenario formations commit a single deployment edit on drag/transform end.
  Formations at or below the roster's smallest echelon render as filled
  rectangles; higher echelons render as text labels centered on the deployment
  point. Labels live in rotated groups so they turn with the formation, and
  text flips 180° when the normalized formation rotation is between 90° and
  270° so names never read upside down. Label width is measured with the same
  font Konva renders, which prevents long names from clipping and keeps the
  transparent hit rectangle close to the visible text instead of spanning a
  fixed oversized block. Per-echelon font sizes, name formats (full, shortened,
  commander surname, or none), uppercase labels, and dynamic frontage are
  transient display preferences in `scenarioEditorStore`, not scenario document
  state. Dynamic frontage scales the rendered rectangle by
  `effectiveStrength / 3000`; the stored frontage remains the length for a
  3,000-strong formation and therefore the value the inspector edits. Rectangle
  labels use a separate invisible hit rectangle: clicking or dragging a name
  selects the formation and mirrors its position into the rectangle group during
  the drag, committing one deployment edit at the end. Hidden names keep a small
  hit target, so text-only and nameless formations remain selectable. Side
  transformer anchors change frontage length, the rotation handle changes
  orientation, and labels are offset from the rectangle according to the unit
  symbol style. The transformer sits outside the camera-scaled group so its
  anchors keep a constant screen size and hit area at every zoom level.
  Undo/redo covers deployment, movement, transform, label, removal, and direct
  removal from the inspector or order of battle.
- Deploying a parent formation also creates phase state for every undeployed
  descendant in the same history entry. Descendants are grouped into one
  centered row per echelon, ordered with the smallest formations at the front
  and larger formations behind, and the parent sits at the requested point
  behind those rows. Already-deployed subordinates keep their existing
  positions.
- Loading or creating a scenario resets the camera and transient editor state.
  Scenario snapshots are deep copies; library edits cannot reach them.

## 6. Persistence and file formats

The Dexie database `battle-map-editor` is at schema version 4. It holds the
`terrainMaps` and `armyRosters` tables, both indexed by `id`, `name`, and
`updatedAt`. Version 3 briefly added a `unitPresets` table; version 4 drops it.
Scenario documents live in memory in M5 and reset to the seeded demo on reload;
a scenario table is added in M7 through another Dexie schema version.
`localStorage` stores only the IDs of the last open terrain map and army roster
(UI preferences), never document contents.

Autosave is debounced inside `libraryStore` and `rosterLibraryStore`; opening,
creating, importing, or deleting flushes pending edits first. A missing final
flush is avoided by writing the current in-memory document on every save, with
the save status visible in the toolbar. Failed saves leave the editor open and
display the error.

Versioned JSON formats:

- `*.terrain.json` — `TerrainMap` (`schemaVersion: 1`)
- `*.army.json` — `ArmyRoster` (`schemaVersion: 1`)
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
The army pipeline mirrors it with `armyRosterSchema`, `.army.json` filenames, and
an independent migration registry; imported rosters with an existing ID receive
a new ID and failed imports leave the active roster untouched. Army schema
preprocessing also normalizes pre-naming-mode rosters in place, so exported,
library, and file-import paths all share the same legacy handling. PNG export
remains a later milestone.

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
rejection. M4 adds roster document/store/file tests for hierarchy construction,
safe reparenting, cycle and cross-faction rejection, faction deletion guards,
per-echelon default strengths, generated universal/local numeric and
commander-style names, custom-name precedence, free-text commander edits, legacy
roster normalization,
notes/style edits, undo/redo, and army file round-tripping plus Playwright
coverage for creating two armies with the default hierarchy, reload persistence,
cyclic import rejection, export/import round-tripping, roster library
duplicate/rename/delete flows, default-strength/naming behavior, smallest-unit
strength roll-up, and inline subordinate creation from the order of battle. M5
adds store tests for bulk state patches and atomic multi-removal, marquee
geometry tests, and Playwright flows for deployment, single and group drag,
single formation transforms, group rotation through the shared transformer
handle, marquee and Shift-click multi-selection, hierarchy double-click,
faction-filter cleanup, label dragging, and bulk removal with undo.

## 8. Conventions

- Strict TypeScript; no `any` in application code.
- Keep Konva nodes and screen-space values out of persisted documents.
- Prefer small components/features over a monolithic `App.tsx`.
- Domain behavior must be testable without mounting React or a canvas.
- UI controls must be functional; no decorative buttons that do nothing.
- Do not implement future milestones opportunistically; stop at the agreed gate.
