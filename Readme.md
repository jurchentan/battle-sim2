BATTLE MAP EDITOR — ENGINEERING SPECIFICATION
Document purpose: Implementation specification for an AI coding agent. Build a local-first, desktop-oriented, manually drawn 2D historical-style battle map editor. This is an editor and battle-state visualizer, not a combat simulator. 0. Instructions to the AI coding agent
You are the lead engineer. Implement the application incrementally according to this specification, maintaining running, testable software after every milestone. Do not build all milestones in one giant response/commit. Inspect the existing repository before editing, implement only the next agreed milestone, run the checks, and report (a) files changed, (b) completed functionality, (c) tests run/results, (d) known limitations, and (e) next milestone. Prefer simple, typed, maintainable architecture over premature abstraction. Do not replace working features while implementing new ones. Avoid massive monolithic components.

Non-negotiable scope:

- No Google Maps, Mapbox, GIS requirement, satellite imagery, map tiles, external map API, or real-world map import. Terrain is created manually with built-in drawing tools.
- Saved terrain maps must be independently reusable and loadable for multiple fictional or historical battle scenarios.
- The look should resemble illustrated military battle maps: muted fields/forests, winding rivers/roads, contour lines, red/blue (configurable) brigade frontages, commander labels, defensive lines, and arrows.
- Not Civil War-specific. Army structure is configurable, with a default hierarchy of army > corps > division > brigade. Brigades are the primary deployable units; larger formation symbols may be supported.
- Users explicitly position units and define battle phases. No automatic combat resolution, pathfinding, AI-generated outcomes, or simulation physics.
- Work offline after installation. No accounts, server, cloud database, or collaboration required in v1.

1. Definition of done
   A user can (1) draw an editable terrain map from a blank canvas; (2) save the terrain to a local library and reopen it; (3) define two or more armies with commanders, strengths, brigades, and chain of command; (4) save/reopen reusable army rosters; (5) create a battle scenario by selecting a saved terrain map and rosters; (6) deploy, drag, rotate, resize, and label unit symbols; (7) duplicate a phase and alter positions, strengths, statuses, commanders, and phase-specific movement arrows without changing previous phases; (8) toggle layers and phases; (9) save/reopen/export/import an entire scenario; and (10) export a polished map image of any phase.
2. Tech stack

- Vite + React + TypeScript, strict type checking.
- React Konva / Konva for canvas rendering, hit testing, editable shapes, drag/transform, layers, and PNG export.
- Zustand for normalized project state, UI state, and editor actions. Keep business entities independent from Konva nodes.
- Dexie (IndexedDB) for local libraries and autosave. Never rely on browser localStorage for complete projects.
- Zod for runtime validation of imported/saved documents and version migration.
- Tailwind CSS for UI styling.
- Vitest for model/state/geometry/file round-trip tests; Playwright for key end-to-end editor interactions.
- Optional later: JSZip only if embedded assets warrant an archive; begin with human-readable, versioned JSON-based file formats.
  The application runs with npm install / npm run dev, and builds with npm run build. Provide npm run test and npm run test:e2e scripts. No backend.

3. Information architecture and interface
   Primary workspaces:
1. Terrain Editor: draw and manage reusable terrain. Military units and timeline are not editable here.
1. Army Roster Editor: create factions, units, hierarchy, naming, and unit default characteristics.
1. Scenario Editor: combine a snapshot of a terrain map and army roster(s), deploy units, create phases and annotations, and export maps.
   Desktop layout:

- Top menu: New / Open / Save / Duplicate / Import / Export / Undo / Redo / Settings.
- Left toolbar: selection, pan, terrain polygon, forest, field, river, road, contour, structure, text, unit place, formation, arrows, defense line; tools shown based on workspace.
- Left secondary panel: map layers in terrain mode; hierarchical Order of Battle in scenario/army mode.
- Center: infinite-feeling pan/zoom viewport over a finite map document with visible page bounds.
- Right properties inspector: contextual fields for selected terrain object, unit, annotation, or phase.
- Bottom (scenario mode): ordered phase timeline with add, duplicate, rename, delete, and reorder controls.
- Clear active mode indication so terrain cannot accidentally be edited while dragging a unit.
  Useful keyboard shortcuts: V select, H pan (or drag empty canvas), Delete delete selected, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S save current document, Escape cancel tool operation. Shortcuts should not fire while typing into inputs.

4. Core domain model
   Keep reusable documents separate. IDs are UUIDs (or equivalent stable IDs); never use array indices as identities.
   4.1 TerrainMap
   TerrainMap {
   schemaVersion, id, name, description?,
   width, height, backgroundStyle,
   layers: TerrainLayer[],
   features: TerrainFeature[],
   createdAt, updatedAt
   }
   TerrainLayer { id, name, visible, locked, zIndex }
   TerrainFeature {
   id, layerId, kind,
   geometry, style, name?, metadata?, zIndex
   }
   kind in v1: forest | field | river | road | contour | lake | swamp | building | bridge | fortification | label | customPath. Geometries must be discriminated unions, e.g. point, polyline, polygon, or text anchor, with typed styles. Do not store Konva objects in documents. Positions are document coordinates, never zoom-adjusted screen pixels. Preserve exact points when saving/loading.
   4.2 Armies and order of battle
   Faction { id, name, color, labelColor?, namingModes: { army?, corps?, division?, brigade?, regiment?, other?: 'numeric-universal'|'numeric-local'|'commander' }, defaultStrengths: { infantry, cavalry, artillery }, notes? }
   UnitDefinition {
   id, factionId, customName?,
   echelon: 'army'|'corps'|'division'|'brigade'|'regiment'|'other',
   unitType: 'infantry'|'cavalry'|'artillery'|'other',
   parentUnitId: string|null,
   commander?: string,
   initialStrength: number|null,
   defaultSymbolStyle, notes?
   }
   ArmyRoster { schemaVersion, id, name, factions, units, createdAt, updatedAt }
   No assumptions about real-world armies or command structures; allow custom names and other echelons. Unit display names are generated per faction and echelon: universal numbering counts every peer in the faction (`1st Brigade`, `2nd Brigade`), local numbering restarts inside each parent formation so every division has its own `1st Brigade`, `2nd Brigade`, and so on, and commander style uses the free-text commander (`Johnsons Brigade`). Each echelon can choose its own style, so a faction can use commander-style divisions and numbered brigades at the same time. A non-empty `customName` overrides the generated name, and custom-named units do not consume numbers. Commander style falls back to universal numbering when no commander is set. Factions also carry per-echelon default strengths for infantry, cavalry, and artillery; these fill the initial strength of new units at or below the roster's smallest deployable echelon and are editable in the faction form. Parent and child must belong to same faction by default, and a subordinate must sit strictly below its parent (corps under army, division under corps, and so on), so higher formations cannot be nested under lower ones. Block cycles in parentUnitId (including indirect cycles). Validate duplicate IDs, dangling parent references, and negative strength. Brigade is default deployable echelon, but the renderer should not forbid representing divisions or other units.
   4.3 Scenario and timeline
   BattleScenario {
   schemaVersion, id, name, description?,
   terrainSnapshot: TerrainMap,
   rosterSnapshot: ArmyRoster,
   phases: BattlePhase[],
   activePhaseId, createdAt, updatedAt
   }
   BattlePhase {
   id, name, order, timeLabel?, notes?,
   unitStates: Record<unitId, UnitPhaseState>,
   annotations: BattleAnnotation[]
   }
   UnitPhaseState {
   x, y, rotationDegrees,
   frontageLength,
   shapePoints?: Point[],
   visible, effectiveStrength: number|null,
   status: 'reserve'|'moving'|'engaged'|'holding'|'retreating'|'routed'|'other',
   labelOverride?: string,
   notes?: string
   }
   BattleAnnotation {
   id, kind: 'movementArrow'|'attackArrow'|'defenseLine'|'highlight'|'text',
   geometry, style, label?, linkedUnitId?
   }
   Very important behavior:

- A UnitDefinition is shared identity/organization across phases; UnitPhaseState is the complete snapshot of changeable attributes for one phase.
- Creating a phase duplicates the previous phase's state deeply. The new phase must share no mutable arrays/objects with the old one.
- Changing x/y, orientation, frontage, effective strength, status, label override, or temporary commander in Phase 3 must NOT change Phases 1 or 2.
- Renaming a unit in the roster updates its base name globally; phase-specific naming uses explicit overrides.
- A unit may be absent/hidden in some phases; newly added units must have defined behavior in earlier phases (e.g. invisible until introduced).
- Movement arrows are manually created, independent of unit positions, and belong to a single phase; arrows do not move units automatically.
- Terrain and roster are snapshotted when a scenario is created. Edits to master library maps/rosters do not silently change existing scenarios. Later explicit 'replace/update from library' can be a separate feature, not v1.
- All UI state (selected tool, zoom, selected object) is transient and separate from persistent document data, except optional saved viewport preferences.

5. Canvas, coordinates and interaction engine
   Use one consistent document coordinate space (e.g. 2000x1400 units by default). Maintain camera transform {scale, offsetX, offsetY}; implement robust screenToWorld and worldToScreen. Zoom around cursor; support panning and fit-to-map. Do not mutate saved geometry when camera changes. Clamp min/max zoom to sensible values. Display an unobtrusive canvas/grid optional overlay (not exported by default).

Keep rendering layers distinct and ordered:

1. Paper/background
2. Area terrain (fields, forests, swamps, lakes)
3. Terrain detail and topographic contours
4. Rivers and roads
5. Buildings/landmarks and geographic labels
6. Phase tactical overlays / defensive lines
7. Formations and brigade labels
8. Movement arrows and annotations
9. Selection handles, guidelines, hover UI (never exported)
   For interaction: tool controller/state machine handling pointer down/move/up, cancel, and selection. Hit testing must respect locked/hidden layers and editor mode. Use object IDs to bind selection to state. Normalize drawn shapes into document coords on pointer up. For multi-point paths, allow point placement and finishing with Enter/double-click; Esc cancels. Later support vertex editing and smoothing. Debounce/limit history pushes: a single drag is one undo action, not 200 mousemove events.
10. Drawing system and cartographic style
    Terrain v1 tools:

- Polygon: forest, field, marsh, lake; select vertices, close polygon, fill/outline and opacity.
- Polyline/curved path: river, road, stream, contour, fence; thickness, color, dash, cap, and control points.
- Freehand drawing with sampled/simplified points for irregular terrain boundaries.
- Building/bridge/landmark: small editable vector symbols.
- Text labels: editable text, font, size, color, rotation.
- Object selection, drag, resize, rotate (where applicable), duplicate, delete, reorder, lock/hide layer.
  Art direction: warm cream/yellow fields, muted green woodland shapes, thin gray/tan roads, pale blue water, subtle contour curves, black/dark geographic labels, bold faction-colored lines and labels. Define reusable presets (e.g. historical-light), but allow user customization. Use vector fills/patterns instead of large raster images. Avoid hardcoding Union/Confederate names or blue/red semantics: colors are faction settings.

Formation symbols: formations at or below the roster's smallest echelon render as filled faction-colored rectangles representing frontage, while higher echelons render as text labels with larger per-echelon default sizes. Display settings configure per-echelon font sizes, uppercase labels, name style, and dynamic frontage. Name styles are full formation name (`2nd Brigade`, `Smith Division`, `Stonewall Brigade`), shortened (`2nd`, `Smith`, `Stonewall`), commander surname (`Bob`, `Smith`, `Jackson`), or no name. Dynamic frontage scales rendered rectangle length linearly with formation strength, using the configured length as the size for a 3,000-strong formation. Color, thickness, dash, and label position remain customizable. Labels are measured to their actual text width so long names are never clipped, and their hit areas stay close to the visible name. Labels rotate with their formation and flip 180° when the formation is upside down so names stay legible. Clicking or dragging a name selects and moves its formation. User can drag the entire formation, rotate using the transformer handle, resize length without changing strength, and optionally edit multi-segment frontage line later. Frontage is a graphical size, not an automatic troop strength calculation. Show army hierarchy and formation name via inspector/labels. Movement arrows can have editable control points and arrowhead style.

Important: A geographic fortification is either terrain/static infrastructure; a newly occupied/constructed breastwork relevant only to a phase should be represented as a phase tactical annotation. Avoid conflating both concepts. 7. Persistence and file formats
Maintain three separate local libraries:

- Terrain Maps: user-authored editable terrain documents.
- Army Rosters: reusable factions, commanders, organization, and units.
- Battle Scenarios: self-contained terrain and roster snapshots plus phase states.
  Persist locally in IndexedDB via Dexie. Autosave with an understandable 'Saved/Unsaved' indicator; never replace current work with a failed import. Provide Duplicate, Rename, Delete (confirm), Open, and Export/Import per library. Implement explicit versioned JSON formats initially, with extensions .terrain.json, .army.json, .battle.json or a documented custom extension. File content, not extension alone, determines validation. Custom format ZIP with embedded assets can come later if needed; avoid unnecessary complexity for vector-only v1.

Every import:

1. Parse JSON safely.
2. Validate with Zod against schemaVersion.
3. Migrate supported older versions or show a clear unsupported-version error.
4. Check all references and phase-state invariants.
5. Preview/confirm replacement or opening; leave active document untouched on failure.
   Round-trip must preserve metadata, point geometry, layer ordering, unit hierarchy, all phase positions, arrows, and colors. Export a clean PNG per selected phase at selectable high resolution; ensure editor handles are not included. Later implement SVG/PDF and all-phase batch export.
6. State, commands and undo/redo
   Implement well-defined editor actions, not arbitrary direct Konva node edits, e.g.:

- addTerrainFeature, updateTerrainFeature, deleteTerrainFeature
- addUnit, updateUnitDefinition, reparentUnit, deleteUnit
- placeUnit, updateUnitPhaseState, setUnitVisibility
- addPhase, duplicatePhase, renamePhase, reorderPhase, deletePhase, switchPhase
- addAnnotation, updateAnnotation, removeAnnotation
- saveMap, loadMap, createScenarioFromLibrary, exportScenario
  Use an action/command boundary suitable for undo/redo. Undo/redo applies to user document edits; phase switching and camera navigation usually do not create undo entries. Keep history scoped to the current document, clear/reset deliberately when opening another document. Save data only after a successful committed edit (autosave can be debounced).

9. Suggested project structure
   src/
   app/ # root, routing/workspace switch, layout
   models/ # TypeScript types, Zod schemas, version migrations
   state/ # Zustand stores, actions, history
   canvas/ # document camera, layers, transforms, hit testing
   features/terrain/ # terrain tools and terrain renderers
   features/armies/ # roster editor, hierarchy, commanders
   features/units/ # formation renderer, placement, property editor
   features/phases/ # phase timeline, snapshot logic, annotations
   features/library/ # local library browser, create/open/duplicate
   features/files/ # import/export, validation, PNG capture
   components/ # reusable UI, dialogs, inspector fields
   styles/ # map styling presets
   tests/ # model, state, geometry, import/export tests
   No giant App.tsx. Domain logic should be testable without mounting React or initializing a canvas. Drawing tools should be registered through a consistent tool interface rather than ad-hoc handlers everywhere.
10. Implementation milestones and acceptance gates
    M0 — Scaffold and model foundation

- Vite React TypeScript app, formatting/linting, tests, strict type checks.
- Data types, Zod schemas, seeded demo documents and predictable IDs.
- App shell/workspace switch with no fake buttons.
  Pass: npm run build, npm run test, and type checks succeed; schemas reject invalid hierarchy and broken phase references.
  M1 — Canvas foundation
- Center document canvas, world/screen transforms, panning, cursor-centered zoom, selection and shape transforms.
- Left tools, right inspector, layer list; undo/redo.
- Basic polygon, line and text objects.
  Pass: draw/select/move/resize/rotate, undo/redo, zoom/pan, restore exact world coordinates after navigation.
  M2 — Complete hand-drawn terrain editor
- Forest/field/water polygons; road/river/contour paths; buildings, labels; styles.
- Layer locks, hidden state, z-order, property controls, delete/duplicate.
- No geographic imports or external map dependencies.
  Pass: recreate a simple stylized map containing wooded regions, two streams, roads, contours, and a village; all remain individually editable.
  M3 — Terrain library
- New, save, reopen, duplicate, rename, delete terrain documents via IndexedDB.
- JSON import/export, schema validation, autosave state.
  Pass: close/reload browser, reopen map and recover every shape/style; exported map reimports with equivalent semantic document data.
  M4 — Army roster editor
- Create faction(s), units, and editable hierarchy (army/corps/division/brigade default).
- Set per-echelon default strengths, type, commander text, custom or generated names, notes, and style; reparent safely.
- Army roster local library and import/export.
  Pass: create army > corps > division > 3 brigades for two sides; reject cyclic chain of command; persist and reopen.
  M5 — Scenario editor and deployment
- Create scenario from copies of saved terrain map and roster(s).
- Place formations (rectangles at or below the smallest echelon, text for higher formations); deploying a parent also places its undeployed subordinates in front, with smaller formations ahead of larger ones. Select, drag, rotate, resize frontage, edit labels, adjust per-echelon font and name styles plus dynamic frontage, filter faction visibility, and remove formations directly with undo.
- Keep units and terrain in distinct editing modes/layers.
  Pass: deploy at least 20 brigades; move formations without changing forest/roads; modifying source terrain map doesn't mutate existing scenario.
  M6 — Battle phases
- Add/duplicate/delete/reorder/rename phase; timeline toggle.
- Fully isolated per-phase unit states and phase-specific arrows/annotations.
- Inspector edits strength, status, label override, and visibility in active phase.
  Pass: duplicate Phase 1 into Phases 2/3, reposition units, modify strength, draw arrows; switching back restores original Phase 1 perfectly.
  M7 — Complete persistence, exports, UX hardening
- Save/open/import/export complete battle scenarios as self-contained versioned files.
- PNG export for active phase (configurable resolution), map labels and legend basics, optional grid/selection excluded.
- Recovery messages, keyboard shortcuts, no-op/dirty state, import errors, loading and empty states.
  Pass: full cold-start scenario round-trip in a clean browser profile; exported PNG looks like the current phase without editor UI; end-to-end tests pass.
  M8 — Visual polish (after functional MVP)
- Better terrain textures, optional curved formation lines, sophisticated contour styling, improved arrow control points, dynamic scale bar if and only if a user-defined scale exists, legend/layout templates, high-quality export presets.
  Pass: create a polished historical-style map resembling the supplied visual references while remaining fully editable.

11. Automated tests / invariants
    At minimum test:
1. Camera invariance: converting world -> screen -> world is accurate at multiple scales/offsets; zoom/pan do not mutate stored map data.
1. History atomicity: one drag = one undo step; undo/redo reliably restores geometry and metadata.
1. Layer lock: locked/hidden terrain cannot be accidentally selected or modified.
1. Hierarchy validity: reject self-parenting, indirect cycles, dangling parent IDs, and invalid commander/faction refs.
1. Phase isolation: mutations to Phase N never change previous/future phase snapshots.
1. Phase duplication: deep copy all nested unit states and annotations; no shared mutable arrays.
1. Derived UI: selecting a brigade shows metadata for that same unit ID even after reorder and phase changes.
1. Scenario snapshot independence: editing library terrain/roster later does not silently alter scenario copies.
1. Save/load round-trip: deep semantic equivalence after JSON export/import; no missing arrows, styling, phase data, or hierarchy.
1. Bad imports: corrupted/unsupported documents display errors without replacing current work.
1. Export correctness: correct phase, correct map bounds, no selection handles/panels, labels rendered.
1. Stress smoke test: hundreds of terrain objects and ~100-300 visible formations remain usable; optimize only after measuring.
1. Non-goals for first release
   No real map import, Google Maps, GIS terrain processing, 3D terrain, server accounts, multiplayer, AI battle outcomes, automatic casualties, historical data scraping, physical movement simulation, pathfinding, unit collision avoidance, or automatic tactical decision-making. No need for an interactive earth map. No requirement that fictional formations map onto an exact real historical order of battle.
1. AI coding workflow and delivery contract
   Start by generating PROJECT_SPEC.md, ARCHITECTURE.md, and TASKS.md in the repository summarizing this spec; put all deliverables under version control. Then implement M0 only. For each milestone:
1. Read specification and existing files.
1. State exactly which files/components will change.
1. Implement the milestone fully (no cosmetic buttons that do nothing).
1. Run type check, tests, and build; fix failures.
1. Provide short manual QA instructions.
1. Summarize changes, risks, and next work.
1. Stop; do not autonomously jump multiple milestones.
   First instruction to AI: “Read the attached Battle Map Editor engineering specification. Implement Milestone M0 only in this repository. Do not implement future milestones. After implementation, list changed files, commands run, test outcomes, and what M1 will require.”
