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

## M1 — Canvas foundation (complete)

- [x] Center document canvas and paper background
- [x] World/screen transforms, cursor-centred zoom, pan, fit-to-map
- [x] Selection, drag, resize, rotate basics
- [x] Left tool rail, right inspector shell, layer list
- [x] Undo/redo with one gesture per history entry
- [x] Basic polygon, polyline, and text objects

Gate: draw/select/move/resize/rotate; undo/redo; zoom/pan; exact world coordinates
restored after navigation.

## M2 — Complete hand-drawn terrain editor (complete)

- [x] Forest/field/water polygons; road/river/contour paths
- [x] Buildings, bridges, labels, style controls
- [x] Layer locking, hiding, z-order, delete/duplicate
- [x] Freehand drawing with point simplification

Gate: recreate a stylized map with wooded regions, two streams, roads, contours,
and a village; every object remains individually editable.

## M3 — Terrain library (complete)

- [x] Dexie store for terrain documents
- [x] New, save, reopen, duplicate, rename, delete
- [x] Versioned JSON import/export with Zod validation and migration hook
- [x] Autosave and saved/unsaved indicator
- [x] New-map dialog with name and preset/custom starting size
- [x] Canvas expansion in all directions with origin-preserving world coordinates
- [x] Outside-canvas view toggle: show all, grey out, or hide expanded regions
- [x] Revert an expanded canvas to its recorded original size (undoable)

Gate: reload browser and recover every shape/style; exported map reimports with
equivalent semantic data.

### Terrain creation follow-ups

- [ ] Add a faction selector to the New map dialog (placeholder area reserved)
- [ ] Add a campaign / war folder selector to the New map dialog (placeholder
      area reserved)
- [ ] Group and filter the terrain library by campaign / war folder
- [ ] Link new terrain maps to a scenario from the creation dialog

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

## Future ideas (unscheduled / far-future improvements)

These are exploratory directions, not part of the v1 milestone sequence. Do not
implement them until they are explicitly scheduled and given acceptance gates.

- **Temporary battle-line tool** — draw arrows, attack/retreat lines, and other
  direction marks that exist only in the active phase. Switching phases hides
  them; the marks remain saved with that phase. Builds on the M6 phase
  annotations with a dedicated temporary drawing tool.
- **Phase-transition animation** — interpolate unit positions and tactical
  annotations between phases to play a complete battle animation. Far-future
  stretch goal.
- **Battle timelines and variations** — branch a scenario into alternate
  timelines so different what-if versions of the same battle can be explored
  side by side.
- **AI-assisted battlefield creation** — turn a sketch, drawing, or reference
  image into an editable terrain map and initial deployment.
