# Handoff — M5.5 scenario-owned orders of battle (complete)

Date: 2026-11-25
Branch: `main`
Milestone: M5.5 scenario-owned orders of battle.

## Status

M5.5 is complete and ready to close. The next scheduled milestone is M6 (battle
phases).

## Feature summary

- `BattleScenario` now owns an `orderOfBattle: ArmyRoster` instead of a
  `rosterSnapshot`. Legacy scenarios preprocess `rosterSnapshot` into
  `orderOfBattle` during validation.
- Scenario creation is map-only. A new scenario receives a deep terrain snapshot
  and an empty OOB named “{Scenario name} order of battle”; rosters are never
  loaded automatically.
- The scenario builder has an editable order-of-battle panel with add faction,
  add unit, add subordinate, generate army, deploy/remove, and delete actions.
  Rows support selection, Shift-click, and hierarchy double-click like the map.
- Scenario faction and unit dialogs reuse the shared faction form and support
  safe reparenting, generated or custom names, commanders, notes, symbol style,
  and brigade strength. Higher formations explain that strength rolls up.
- Deleting a formation is blocked while it has subordinates. Deployed deletion
  removes its state from every phase and clears annotation links in one undo
  entry.
- Supported echelons are now `army | corps | division | brigade` only, with
  brigade always the smallest unit. `smallestUnitEchelon` is forced to
  `brigade`; the setting is gone from the UI. `unitType: 'other'` remains valid.
- Legacy `regiment` and `other` echelons migrate to brigades. Migrated units
  that would sit at or above their parent are lifted to the nearest valid
  ancestor or made roots. Unsupported naming-mode and strength keys are dropped.
  Migrated roster library documents persist automatically and show a notice.
- The semi-procedural army generator (`features/army/armyGenerator.ts`) supports
  independent brigades, divisions, corps, and a single army; per-arm brigade
  counts; rough-average or exact-total strengths; homogeneous formations;
  remainder handling; zero-count arms; existing or new factions; and preview
  totals. It appends one army as a single undo entry and does not auto-deploy.
- Shared roster mutations live in `features/army/rosterMutations.ts` and serve
  both the roster and scenario stores.
- The Army Roster workspace remains an optional reusable template library, with
  unsupported echelon and smallest-unit controls removed.
- The seed demo scenario keeps its populated two-phase order of battle.

## Verification (all passing)

```bash
npm run typecheck
npm run lint               # one non-fatal Fast Refresh warning in FactionForm.tsx
npm run test               # 19 files, 189 tests
npx prettier --check .
npm run build              # Vite chunk-size warning only
npx playwright test        # 31 tests
```

New coverage includes:

- `armyGenerator.test.ts` — independent brigades, divisions with remainders,
  corps, army roots, average/exact strengths, zero arms, invalid plans, existing
  and new factions, immutability.
- `scenarioStore.test.ts` — map-only creation, OOB add/update/reparent/delete,
  cross-phase deletion cascade, annotation cleanup, undo/redo, atomic generator
  commit, and rejection without document changes.
- `scenarioDocuments.test.ts` and `schemas.test.ts` — empty OOB creation, legacy
  `rosterSnapshot` migration, and legacy echelon normalization.
- `scenario-m5.spec.ts` — map-only scenario creation, generating two armies,
  deploying 20 generated brigades, and the existing deployment, multi-selection,
  label, faction-filter, and undo flows against builder-owned OOBs.
- `army-roster-tools.spec.ts` — subordinate creation from a supported parent and
  brigade strength roll-up, with the smallest-unit control confirmed absent.

## Documentation updated

- `M5.5_PLAN.md` — marked implemented.
- `TASKS.md` — M5.5 checklist and gate; corrected M4/M5 entries.
- `ARCHITECTURE.md` — scenario-owned OOB, four-echelon model and migration,
  builder/generator behavior, store actions, persistence note, and test coverage.
- `PROJECT_SPEC.md` — map-only creation, OOB ownership/editing, generator,
  four-echelon model, and definition-of-done item.
- `Readme.md` — domain model (`orderOfBattle`, four echelons), formation
  rendering, scenario behavior, and milestone list.
- `HANDOFF.md` — this file.

## Known limitations

- Scenarios remain in memory until M7; reloading returns to the seeded demo.
- The terrain map cannot be replaced after scenario creation.
- Generated armies are not auto-deployed.
- The Fast Refresh lint warning is pre-existing style guidance for
  `FactionForm.tsx` exporting `nextFactionColor`; it does not affect behavior.

## Remaining work

None for M5.5. M6 adds phase management and phase-specific annotations; scenario
persistence and export remain in M7.
