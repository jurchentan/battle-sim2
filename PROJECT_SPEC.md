# Battle Map Editor — Project Specification

Status: M5.5 complete (scenario-owned orders of battle). Source of truth:
`Readme.md` (engineering specification) plus `Info.md` (product vision). If
documents disagree, `Readme.md` wins for implementation details. The terrain
workspace supports area and path tools, symbols and labels, style editing, layer
visibility/locking/z-order, object stacking, delete/duplicate, simplified
freehand drawing, and a local IndexedDB library with autosave plus versioned
JSON import/export. The army workspace manages factions and hierarchical units
with safe reparenting, generated or custom unit names, free-text commanders, a
fixed army/corps/division/brigade hierarchy with brigade as the smallest unit,
per-echelon default strengths, derived strength roll-up, and its own IndexedDB
library with autosave and versioned JSON import/export. The scenario workspace
creates map-only snapshot battles, owns an editable order of battle built or
generated directly in the scenario builder, deploys formations with
drag/rotate/frontage/label editing, renders brigades as rectangles and higher
echelons as configurable text labels, filters factions, removes formations
directly with undo, and keeps terrain inspection separate from unit deployment.
Scenario persistence, phase management, annotations, and exports remain scheduled
for M6-M7.

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
2. **Army roster** — an optional reusable template of factions and units with
   echelons, types, strengths, parent relationships, and free-text commanders.
   Legal in isolation from terrain.
3. **Battle scenario** — a self-contained snapshot of one terrain map plus a
   scenario-owned order of battle, deployment states, ordered phases, and
   annotations.

Snapshots are intentional: later edits to library terrain or rosters must not
silently mutate existing scenarios. Scenarios never load rosters automatically;
the order of battle is built or generated in the scenario builder.

## 4. Scope of v1

### Terrain map creation

- Blank finite canvas (default document space 2000 × 1400, maximum
  10000 × 10000).
- Canvas expansion on any side; existing features keep their world coordinates
  while the document origin moves with the top/left margins.
- Expanded maps can show, grey out, or hide areas outside the original canvas,
  and the canvas can be reverted to its recorded original size without deleting
  features.
- New-map flow offers a name plus preset or custom starting dimensions. Space is
  reserved in the dialog for future faction and campaign / war folder selectors.
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

- Factions with configurable colors and a naming style per echelon: universal
  numbers (continuous `1st Brigade`, `2nd Brigade` across the faction), local
  numbers (each parent formation restarts at `1st Brigade`), or commander-style
  (`Johnsons Brigade`). A faction can mix styles, for example commander-style
  divisions and numbered brigades.
- Free-text commanders and custom unit names. A non-empty custom name overrides
  the generated name.
- Fixed four-echelon hierarchy: `army > corps > division > brigade`. `other`
  remains a unit type, not an echelon. Subordinates must sit strictly below their
  parent, so higher formations cannot be nested under lower ones.
- Brigade is always the smallest unit. Brigades carry their own strength; higher
  formations display the summed strength of their subordinates.
- Per-faction, per-echelon default strengths for infantry, cavalry, and
  artillery, editable in the faction form and applied when a new brigade is
  created.
- Unit type, notes, and default symbol style.
- Inline subordinate creation from any formation above brigade.
- Cycle and reference validation.
- Roster library with import/export, including normalization of earlier rosters
  that stored a unit name and a separate commander record. Legacy `regiment` and
  `other` echelons migrate to brigades with their hierarchy repaired, and
  migrated library documents save automatically with a visible notice.
- Rosters remain an optional reusable template library; scenarios do not import
  them automatically.

### Scenario editing

- Create a scenario by choosing one saved terrain map. The scenario receives a
  deep map snapshot and starts with an empty order of battle named
  “{Scenario name} order of battle”. The map cannot be changed after creation.
- Build the order of battle directly in the scenario builder: add and edit
  factions and units, create subordinates, reparent safely, and delete
  formations. Deleting a formation is blocked while it has subordinates and
  removes its state from every phase plus any annotation links in one undoable
  edit.
- Generate an army semi-procedurally: choose an existing or new faction, a
  command structure (independent brigades, divisions, corps, or a single army),
  per-arm brigade counts, and either a rough average per brigade or an exact arm
  total. Formations are homogeneous by arm, remainders form smaller formations,
  and the whole army appends as one undoable edit without auto-deploying.
- Deploy formations: move, rotate, resize frontage, label, hide. Deploying a
  parent also places and selects its undeployed subordinates. The auto-layout is
  hierarchy-relative: children sit side by side in front of their own parent,
  and each higher formation is centered behind its own children.
- New formations deploy at 180° so their label sits below the rectangle with the
  blank edge facing up; label text still flips upright automatically.
- Brigades render as rectangular symbols; higher formations render as text labels
  with per-echelon font sizes, name styles (full, shortened, commander surname,
  or none), an uppercase display setting, and optional dynamic frontage scaled
  linearly from a 3,000-strong baseline.
- Per-echelon default frontage is configurable in the editor and applied when a
  formation is first deployed. Existing deployments keep their own frontage.
- Labels are measured to avoid clipping and rotate with formations, flipping
  upright when upside down. Clicking or dragging a name selects and moves its
  formation, including when names are hidden.
- Select several formations: drag a marquee on empty canvas, Shift-click to add
  or remove one, or double-click a parent to select its deployed command.
  Dragging any member moves the whole group, and the shared transformer handle
  rotates the group around its center.
- Bulk rotation and removal in the inspector, plus Delete/Backspace on a
  multi-selection, each commit as one undoable edit.
- Remove formations directly from the inspector or order of battle; removals are
  immediate and undoable.
- Multiple phases: add, duplicate, rename, reorder, delete, activate.
- Per-phase positions, orientation, frontage, effective strength, status,
  visibility, and label overrides.
- Per-phase movement arrows, attack arrows, defense lines, highlights, and text.
- Layer and phase visibility toggles.

Milestone M5 implemented active-phase deployment including parent/subordinate
formation blocks, rectangle and text formation rendering, per-echelon font and
name display settings, dynamic frontage, label-based selection and dragging,
formation editing, faction filtering, direct removal, multi-selection by
marquee/Shift-click/hierarchy double-click, group drag and group rotation,
configurable per-echelon default frontage, parent-deployment bulk selection,
hierarchy-relative auto-layout, a 180° default deployment orientation, and
separate terrain/unit modes.
Milestone M5.5 replaced roster-snapshot creation with map-only scenario creation
and a scenario-owned editable order of battle, reduced the model to four
echelons with brigade always smallest, added safe legacy migration, and added the
semi-procedural army generator. Phase management and annotations follow in M6;
scenario persistence and export follow in M7.

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

### Possible later work (unscheduled)

- A temporary per-phase battle-line tool for directions, attacks, retreats, and
  other tactical marks.
- Phase-to-phase animation that plays the battle as a continuous sequence.
- Branching timelines for exploring alternate versions of the same battle.
- AI-assisted battlefield creation from sketches, drawings, or reference images.

## 6. Definition of done

A user can:

1. Draw an editable terrain map from a blank canvas.
2. Save terrain to a local library and reopen it.
3. Define two or more armies with commanders, strengths, brigades, and chains of
   command.
4. Save and reopen reusable army rosters.
5. Create a battle scenario from a saved terrain map, then build or generate its
   order of battle in the scenario builder.
6. Deploy, drag, rotate, resize, and label unit symbols.
7. Duplicate a phase and alter positions, strengths, statuses, labels, and
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
