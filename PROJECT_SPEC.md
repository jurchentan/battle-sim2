# Battle Map Editor — Project Specification

Status: M2 complete (hand-drawn terrain editor). Source of truth: `Readme.md`
(engineering specification) plus `Info.md` (product vision). If documents
disagree, `Readme.md` wins for implementation details. The terrain workspace now
supports area and path tools, symbols and labels, style editing, layer
visibility/locking/z-order, object stacking, delete/duplicate, and simplified
freehand drawing.

## 1. Product summary

A local-first, desktop-oriented editor for drawing reusable, historical-style
battle maps and illustrating how a battle unfolds over time. Terrain is drawn by
hand with built-in tools; armies are organized into configurable hierarchies; and
a battle scenario combines terrain, rosters, deployment, phases, and tactical
annotations.

The result is a sequence of clear, illustrated maps that can be revised and
reused without redrawing the battlefield.

## 2. Target users

- Military-history enthusiasts and researchers
- Educators and students
- Authors and content creators
- Wargame scenario designers

The tool is era-agnostic: Napoleonic, ancient, fictional, or other settings are
supported. Faction names, colors, echelons, and unit types are user-configurable;
nothing assumes a specific historical conflict.

## 3. Core concepts

Three reusable document types, stored independently:

1. **Terrain map** — geography only: forests, fields, water, rivers, roads,
   contours, structures, and labels. No military units or timeline.
2. **Army roster** — factions, commanders, and units with echelons, types,
   strengths, and parent relationships. Legal in isolation from terrain.
3. **Battle scenario** — a self-contained snapshot of one terrain map and one
   army roster, plus deployment states, ordered phases, and annotations.

Snapshots are intentional: later edits to library terrain or rosters must not
silently mutate existing scenarios.

## 4. Scope of v1

### Terrain map creation

- Blank finite canvas (default document space 2000 × 1400).
- Draw and edit polygons (forest, field, swamp, lake), paths (river, road,
  contour, custom path), point symbols (building, bridge, fortification), and
  text labels.
- Area and path tools draw freehand by default, with an alternate vertex-placement
  mode. Freehand samples are simplified before commit.
- Editable geometry and styles; layers with visibility, locking, and z-order.
- Object stacking, duplication, and deletion; style controls for fills, hatching,
  stroke width, opacity, dashes, caps, marker colours, and label typography.
- Illustrated cartographic look with reusable style presets.

### Terrain library

- Save, reopen, rename, duplicate, delete, import, and export terrain documents.
- Local IndexedDB persistence with autosave status.

### Army rosters

- Factions with configurable colors.
- Commanders and named units.
- Configurable hierarchy with default `army > corps > division > brigade`;
  additional echelons (`regiment`, `other`) are allowed.
- Brigade-level initial strength, unit type, notes, and default symbol style.
- Cycle and reference validation.
- Roster library with import/export.

### Scenario editing

- Create a scenario from copies of saved terrain and roster documents.
- Deploy brigade formations: move, rotate, resize frontage, label, hide.
- Multiple phases: add, duplicate, rename, reorder, delete, activate.
- Per-phase positions, orientation, frontage, effective strength, status,
  visibility, label overrides, and commander overrides.
- Per-phase movement arrows, attack arrows, defense lines, highlights, and text.
- Layer and phase visibility toggles.

### Persistence and export

- Three local libraries: terrain, rosters, scenarios.
- Versioned, human-readable JSON import/export.
- Zod validation and migration hooks for every import.
- High-resolution PNG export of the active phase without editor handles.

## 5. Explicit non-goals for v1

- Google Maps, Mapbox, GIS, satellite imagery, map tiles, external map APIs.
- Real-world map or geo-data import.
- 3D terrain, terrain generation, or physics.
- Accounts, servers, cloud sync, or multiplayer.
- Automatic combat resolution, casualties, pathfinding, collision avoidance, or
  AI-generated battle outcomes.
- Historical data scraping.
- Animated playback (possible later).
- Real-world order-of-battle requirements.

## 6. Definition of done

A user can:

1. Draw an editable terrain map from a blank canvas.
2. Save terrain to a local library and reopen it.
3. Define two or more armies with commanders, strengths, brigades, and chains of
   command.
4. Save and reopen reusable army rosters.
5. Create a battle scenario from a saved terrain map and roster.
6. Deploy, drag, rotate, resize, and label unit symbols.
7. Duplicate a phase and alter positions, strengths, statuses, commanders, and
   phase-specific arrows without changing earlier phases.
8. Toggle layers and phases.
9. Save, reopen, export, and import an entire scenario.
10. Export a polished map image of any phase.

Success looks like: create a battlefield from scratch, reuse it, organize dozens
of formations, illustrate several phases, and produce professional-looking maps
— with the ease of building a slide deck, while preserving military organization
and narrative.

## 7. Quality and behavioral invariants

- World/document coordinates are authoritative; camera changes never mutate data.
- A unit definition is shared identity; per-phase state is the only mutable
  deployment data.
- Phase duplication is a deep copy: no shared mutable objects between phases.
- One drag is one undo step; history is scoped to the current document.
- Locked or hidden terrain cannot be selected or modified.
- Invalid references, hierarchy cycles, negative strengths, and duplicate IDs are
  rejected by schema validation.
- Failed imports never replace the active document.
- Save/load round-trips preserve geometry, styles, hierarchy, phase data, arrows,
  and colors.
- Export contains no selection handles or editor chrome and renders the correct
  phase and map bounds.

## 8. Technology

- Vite + React + TypeScript (strict)
- React Konva / Konva for canvas rendering and export
- Zustand for document and UI state
- Dexie (IndexedDB) for local libraries
- Zod for schemas, validation, and version migration
- Tailwind CSS for UI
- Vitest for unit/integration tests; Playwright for end-to-end flows

## 9. Delivery contract

`TASKS.md` tracks milestones and acceptance gates. Each milestone is implemented
and verified independently; the agent stops after the agreed milestone and reports
files changed, functionality, test results, limitations, and the next milestone.
