# Handoff — M5 bulk formation selection (complete)

Date: 2026-11-11
Branch: `main`
Milestone: M5 scenario deployment, bulk-selection follow-up.

## Status

All remaining work from the previous handoff is complete. M5 is ready to close;
the next scheduled milestone is M6 (battle phases).

## Feature summary

- `scenarioEditorStore` holds `selectedUnitIds: string[]` with `selectUnits`,
  `toggleUnitSelection`, and `ensureUnitSelected` in addition to
  `selectUnit(id | null)`.
- Marquee selection on empty canvas in Units mode, additive with Shift.
- Shift-click toggles formations on the map and in the order of battle.
- Double-click a parent to select its visible deployed descendants.
- Dragging any selected member moves the whole group and commits one
  `updateUnitStates` history entry.
- The shared transformer handle rotates the group around its centre; all
  per-node `transformend` patches are flushed in one microtask and committed as
  one history entry. Resize anchors require exactly one rectangle formation.
- The inspector shows a multi-selection summary, bulk rotation, and bulk removal.
- Delete/Backspace removes the selection through `undeployUnits`, also as one
  undo entry.
- Hiding a faction removes its formations from the active selection.

## Verification (all passing)

```bash
npm run typecheck
npm run lint
npm run test              # 18 files, 170 tests
npx prettier --check .
npm run build
npx playwright test       # 30 tests
```

The full Playwright suite includes the new
`rotates the group with the transformer handle and keeps bulk edits atomic`
test, which covers the items previously listed for manual QA:

- additive Shift-drag marquee selection;
- faction-hide cleanup of a multi-selection;
- group rotation through the real multi-node transformer handle;
- one-step undo and redo after group rotation;
- group drag initiated from a rotated rectangle label;
- label re-selection after the committed drag;
- Delete on a multi-selection followed by a single undo;
- the existing single-formation drag/rotate/label flows and all earlier
  milestones.

## Documentation updated

- `TASKS.md` — M5 bulk-selection checklist entries.
- `PROJECT_SPEC.md` — scenario editing bullets and M5 implementation note.
- `ARCHITECTURE.md` — selection store shape, marquee, group drag/transform,
  one-history-entry bulk store actions, and test coverage.
- `Readme.md` — formation interaction paragraph.

## Remaining work

None for M5. M6 adds phase management and phase-specific annotations; scenario
persistence and export remain in M7.
