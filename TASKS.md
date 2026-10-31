# Tasks and Milestones

Each milestone must leave the app buildable and testable. Implement one milestone,
run the checks, report, then stop.

## M0 — Scaffold and model foundation (complete)

- [x] Initialize repository layout and tooling configuration
- [x] Vite + React + TypeScript with strict checks
- [x] Oxlint and Prettier configuration
- [x] Vitest setup plus Playwright smoke scaffold
- [x] Domain types via Zod schemas: `TerrainMap`, `ArmyRoster`, `BattleScenario`
- [x] Terrain geometry/style discriminated unions with kind compatibility checks
- [x] Roster validation: duplicate IDs, dangling refs, cross-faction parents,
      negative strength, direct/indirect hierarchy cycles
- [x] Scenario validation: active phase, phase/unit references, commander
      overrides, annotation links, duplicate phases
- [x] Deterministic seeded demo terrain, roster, and two-phase scenario
- [x] App shell with functional workspace switch (Terrain / Army / Scenario)
- [x] Workspace summaries of the seeded documents; no fake controls
- [x] Project documentation (`PROJECT_SPEC.md`, `ARCHITECTURE.md`, `TASKS.md`)

Acceptance gate: `npm run typecheck`, `npm run lint`, `npm run test`, and
`npm run build` succeed; invalid hierarchy and broken phase references are
rejected.

## M1 — Canvas foundation

- [ ] Center document canvas and paper background
- [ ] World/screen transforms, cursor-centred zoom, pan, fit-to-map
- [ ] Selection, drag, resize, rotate basics
- [ ] Left tool rail, right inspector shell, layer list
- [ ] Undo/redo with one gesture per history entry
- [ ] Basic polygon, polyline, and text objects

Gate: draw/select/move/resize/rotate; undo/redo; zoom/pan; exact world coordinates
restored after navigation.

## M2 — Complete hand-drawn terrain editor

- [ ] Forest/field/water polygons; road/river/contour paths
- [ ] Buildings, bridges, labels, style controls
- [ ] Layer locking, hiding, z-order, delete/duplicate
- [ ] Freehand drawing with point simplification

Gate: recreate a stylized map with wooded regions, two streams, roads, contours,
and a village; every object remains individually editable.

## M3 — Terrain library

- [ ] Dexie store for terrain documents
- [ ] New, save, reopen, duplicate, rename, delete
- [ ] Versioned JSON import/export with Zod validation and migration hook
- [ ] Autosave and saved/unsaved indicator

Gate: reload browser and recover every shape/style; exported map reimports with
equivalent semantic data.

## M4 — Army roster editor

- [ ] Faction and commander management
- [ ] Unit creation, editing, and safe reparenting
- [ ] Default army/corps/division/brigade hierarchy plus custom echelons
- [ ] Brigade strength, type, notes, symbol style
- [ ] Roster library and import/export

Gate: create two armies with corps/division/three brigades; reject cycles; persist
and reopen.

## M5 — Scenario editor and deployment

- [ ] Create scenario from snapshots of saved terrain and roster
- [ ] Place brigade formations
- [ ] Select, drag, rotate, resize frontage, edit labels
- [ ] Faction visibility filters
- [ ] Separate terrain and unit editing modes

Gate: deploy at least 20 brigades without changing terrain; edits to library
sources do not mutate the scenario.

## M6 — Battle phases

- [ ] Add, duplicate, rename, reorder, delete phases; timeline
- [ ] Deep-isolated per-phase unit states
- [ ] Phase annotations: movement/attack arrows, defense lines, highlights, text
- [ ] Inspector edits for strength, status, commander override, visibility

Gate: duplicate Phase 1 into Phases 2/3, reposition units, change strengths, draw
arrows; returning to Phase 1 restores it exactly.

## M7 — Persistence, exports, UX hardening

- [ ] Save/open/import/export complete scenarios
- [ ] PNG export for active phase with configurable resolution
- [ ] Keyboard shortcuts, dirty-state handling, recovery and error states
- [ ] Playwright end-to-end coverage

Gate: cold-start scenario round-trip in a clean browser profile; exported PNG
matches the phase without editor UI; E2E tests pass.

## M8 — Visual polish

- [ ] Terrain textures and contour refinement
- [ ] Optional curved formation lines
- [ ] Arrow control point editing
- [ ] Legend/layout templates and export presets
- [ ] Optional scale bar when a scale is defined

Gate: polished historical-style output resembling reference maps while remaining
fully editable.
