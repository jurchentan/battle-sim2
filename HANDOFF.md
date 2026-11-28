# Handoff — M5.6 battle line deployment tool (complete)

Date: 2026-11-28
Branch: `main`
Milestone: M5.6 battle line deployment tool, plus cascade deletion and consolidated
inspector bulk actions.

## Status

M5.6 is complete and ready to close. The next scheduled milestone is M6 (battle
phases).

## Feature summary

- A new pure module, `features/scenario/battleLine.ts`, owns battle-line
  resolution and math. `resolveBattleLineSelection` expands selected formations
  to their visible descendant brigades, groups them by nearest division ancestor,
  and orders groups and brigades by depth-first order of battle.
- `computeBattleLineLayout` distributes the polyline's arc length proportionally
  to rendered frontage, places each brigade centre at its slot midpoint, and
  aligns it to the local tangent. Long lines leave gaps; short lines overlap
  instead of being rejected.
- Existing brigade states keep frontage, strength, status, label override,
  visibility, and notes while position and rotation change. Undeployed brigades
  are seeded from `defaultUnitPhaseState` with the current default frontage.
- Command labels whose whole brigade group is included, or which were
  explicitly selected, sit behind their own brigade group at fixed
  division/corps/army offsets of 120/240/360 world units and rotate to the group
  average tangent. Commands inside the selected formation tree deploy when
  needed; unrelated undeployed ancestors are never added.
- The inspector shows one shared **Bulk actions** section for every formation
  selection. It contains **Flip 180°**, **Remove selected from map**, **Draw
  battle line** (or **Cancel battle line** while armed), and **Place on map**.
  The former toolbar Bulk actions menu and the separate contextual Draw shortcut
  are gone.
- Flip and Remove act on every deployed selected formation. Remove no longer
  clears the selection, so the same formation can be placed again immediately.
- Place on map is enabled only for a single undeployed formation; it is disabled
  with an explanatory tooltip for multi-selections and already-deployed
  formations.
- Draw is available whenever the selection resolves to at least one brigade and
  stays enabled while armed so it can cancel.
- Deleting a formation now deletes its whole descendant subtree after an
  explicit confirmation that names the subordinate count. Scenario deletion
  removes every deleted unit's state from all phases and clears linked
  annotations in the same single undo entry. The roster editor uses the same
  cascade behavior with its existing confirmation.
- `ScenarioCanvas` captures the freehand stroke with a screen-space sampling
  threshold, simplifies it with `simplifyPoints`, and previews the line plus
  faction-coloured ticks at planned centres. Formation, terrain, marquee, and
  single-placement interactions are locked while armed. Escape cancels the armed
  tool or an in-progress stroke without touching the document.
- Applying a line upserts brigade and command states through
  `applyDeploymentStates` as one history entry, stores transient `lastBattleLine`
  metadata, selects the placed formations, and leaves the tool.
- **Flip 180°** calls `flipUnitStates`, adding 180° in place to every deployed
  selected formation as one undo entry. Positions and order do not change.
- The multi-selection inspector also offers **Frontage (all selected)** through
  `updateUnitStates`; bulk frontage changes stored width only and does not
  re-space the line.
- The line is transient metadata in `scenarioEditorStore`, not a document field
  or annotation. It is cleared by a new line, toolbar or keyboard undo/redo, and
  scenario reset.
- No schema changes or migrations were needed.

## Verification (all passing)

```bash
npm run typecheck
npm run lint               # one non-fatal Fast Refresh warning in FactionForm.tsx
npm run test               # 20 files, 225 tests
npx prettier --check .
npm run build              # Vite chunk-size warning only
npx playwright test        # 37 tests
```

New coverage includes:

- `battleLine.test.ts` — division/corps/army resolution, cross-division grouping,
  deduplication, order-of-battle ordering, hidden-faction filtering, straight
  and curved proportional layout, long-line gaps, short-line overlap, dynamic
  frontage, existing-state preservation, default deployment states, selected
  command deployment, command recentring, partial-group guards, nested offsets,
  and flip normalization.
- `rosterStore.test.ts` and `scenarioStore.test.ts` — cascade subtree deletion,
  phase-state and annotation-link cleanup, single-entry undo/redo, bulk
  deployment upserts, in-place flips, bulk frontage, and no-op guards.
- `scenarioEditorStore.test.ts` — arming/cancelling the line, last-line storage
  and clearing, placement hand-off, and scenario reset.
- `scenario-m5.6.spec.ts` — division line drawing with command recentring,
  selected-corps command deployment without an undeployed army,
  arbitrary cross-division brigades on a deliberately short overlapping line,
  the shared inspector Bulk actions section, Place on map for a single
  undeployed formation, cascading parent deletion with confirmation and
  one-step undo, bulk frontage and Flip 180°, Escape cancellation, and reset
  clearing.
- `army-roster-tools.spec.ts` — roster-side cascade deletion confirmation and
  one-step undo, alongside the existing hierarchy and strength flows.

## Documentation updated

- `M5.6_PLAN.md` — marked implemented, with the consolidated inspector Bulk
  actions section and cascade-deletion follow-up.
- `TASKS.md` — M5.6 checklist and gate, including cascade deletion and the
  consolidated inspector actions.
- `ARCHITECTURE.md` — battle-line module, layout and command rules, stroke
  capture, transient editor state, store actions, bulk actions, cascade
  deletion, and test coverage.
- `PROJECT_SPEC.md` — scenario feature bullets, milestone summary, later-work
  wording, and definition-of-done item.
- `Readme.md` — formation behavior, deletion cascade, and the M5.6 milestone.
- `M5.5_PLAN.md` — deletion behavior updated to the current cascade rules.
- `HANDOFF.md` — this file.

## Known limitations

- The battle line is a transient deployment guide; it is not saved as an
  annotation or document field (M6).
- Undo/redo and scenario reset clear the `lastBattleLine` metadata. It remains
  only as transient selection/debug state; the user-facing Flip 180° works from
  the current selection.
- Bulk frontage changes the stored width only; redraw the line to change spacing.
- Command labels recenter only when the whole brigade group is included or the
  command was explicitly selected. Unrelated undeployed ancestors stay off the
  map.
- Mid-stroke panning/zooming is not supported.
- Scenarios remain in memory until M7; reloading returns to the seeded demo.
- The Fast Refresh lint warning is pre-existing style guidance for
  `FactionForm.tsx` exporting `nextFactionColor`; it does not affect behavior.

## Remaining work

None for M5.6. M6 adds phase management and phase-specific annotations; scenario
persistence and export remain in M7.
