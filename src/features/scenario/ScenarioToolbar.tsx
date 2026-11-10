import { useState } from 'react';
import type { BattleScenario } from '../../models';
import { useCameraStore } from '../../canvas/cameraStore';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import { ECHELON_LABELS, ECHELON_ORDER } from '../army/rosterDocuments';
import { sectionHeadingClass } from '../army/ui';
import { NumberField, SelectField } from '../terrain/fields';
import { currentCanvasBounds } from '../terrain/canvasBounds';
import { NewScenarioDialog } from './NewScenarioDialog';
import { FORMATION_LABEL_FORMAT_OPTIONS, activeScenarioPhase } from './scenarioDocuments';

const buttonClass =
  'rounded-md border border-[#c9bda3] bg-[#f8f2e5] px-2.5 py-1.5 text-xs font-semibold text-[#4a4438] transition-colors hover:border-[#a99a79] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40';

export function ScenarioToolbar({ scenario }: { scenario: BattleScenario }) {
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  const mode = useScenarioEditorStore((state) => state.mode);
  const setMode = useScenarioEditorStore((state) => state.setMode);
  const formationFontSizes = useScenarioEditorStore((state) => state.formationFontSizes);
  const formationLabelFormats = useScenarioEditorStore((state) => state.formationLabelFormats);
  const uppercaseFormationLabels = useScenarioEditorStore(
    (state) => state.uppercaseFormationLabels,
  );
  const dynamicFrontage = useScenarioEditorStore((state) => state.dynamicFrontage);
  const setFormationFontSize = useScenarioEditorStore((state) => state.setFormationFontSize);
  const setFormationLabelFormat = useScenarioEditorStore((state) => state.setFormationLabelFormat);
  const setUppercaseFormationLabels = useScenarioEditorStore(
    (state) => state.setUppercaseFormationLabels,
  );
  const setDynamicFrontage = useScenarioEditorStore((state) => state.setDynamicFrontage);
  const resetFormationDisplay = useScenarioEditorStore((state) => state.resetFormationDisplay);
  const canUndo = useScenarioStore((state) => state.past.length > 0);
  const canRedo = useScenarioStore((state) => state.future.length > 0);
  const undo = useScenarioStore((state) => state.undo);
  const redo = useScenarioStore((state) => state.redo);
  const scale = useCameraStore((state) => state.camera.scale);
  const zoomByStep = useCameraStore((state) => state.zoomByStep);
  const fit = useCameraStore((state) => state.fit);

  const phase = activeScenarioPhase(scenario);
  const deployedCount = phase ? Object.keys(phase.unitStates).length : 0;
  const terrainFeatures = scenario.terrainSnapshot.features.length;

  return (
    <div className="border-b border-[#d8cdb5] bg-[#f6efe0]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[#2f2b23]">
            Scenario Editor
          </h2>
          <p className="truncate text-xs text-[#7c715c]">
            <span data-testid="scenario-name" className="font-semibold text-[#4a4438]">
              {scenario.name}
            </span>
            <span data-testid="scenario-summary">
              {' '}
              · {deployedCount} deployed · {terrainFeatures} terrain features
            </span>
            <span data-testid="scenario-sources" className="hidden md:inline">
              {' '}
              · {scenario.terrainSnapshot.name} / {scenario.rosterSnapshot.name}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="scenario-mode-indicator"
            aria-live="polite"
            className={[
              'inline-flex w-28 items-center justify-center rounded-md border px-2 py-1 text-[0.65rem] font-semibold tracking-wide',
              mode === 'terrain'
                ? 'border-[#c9bda3] bg-[#f3ecdd] text-[#6b5d42]'
                : 'border-[#a9bc99] bg-[#e8efde] text-[#4f6344]',
            ].join(' ')}
          >
            {mode === 'terrain' ? 'Terrain mode' : 'Units mode'}
          </span>

          <div
            role="group"
            aria-label="Scenario editing mode"
            className="inline-flex overflow-hidden rounded-md border border-[#c9bda3]"
          >
            <button
              type="button"
              aria-label="Terrain mode"
              aria-pressed={mode === 'terrain'}
              className={[
                'px-2 py-1.5 text-[0.65rem] font-semibold transition-colors',
                mode === 'terrain'
                  ? 'bg-[#dfe7d4] text-[#3d5236]'
                  : 'bg-[#f8f2e5] text-[#6b5d42] hover:bg-[#efe5d2]',
              ].join(' ')}
              onClick={() => setMode('terrain')}
            >
              Terrain
            </button>
            <button
              type="button"
              aria-label="Units mode"
              aria-pressed={mode === 'units'}
              className={[
                'border-l border-[#d8cdb5] px-2 py-1.5 text-[0.65rem] font-semibold transition-colors',
                mode === 'units'
                  ? 'bg-[#dfe7d4] text-[#3d5236]'
                  : 'bg-[#f8f2e5] text-[#6b5d42] hover:bg-[#efe5d2]',
              ].join(' ')}
              onClick={() => setMode('units')}
            >
              Units
            </button>
          </div>

          <button
            type="button"
            className={buttonClass}
            aria-expanded={displayOpen}
            aria-controls="scenario-display-settings"
            onClick={() => setDisplayOpen((open) => !open)}
          >
            Display
          </button>

          <button type="button" className={buttonClass} onClick={() => setNewScenarioOpen(true)}>
            New scenario
          </button>

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#d8cdb5]" />

          <button
            type="button"
            className={buttonClass}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
          >
            Redo
          </button>

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#d8cdb5]" />

          <button
            type="button"
            className={buttonClass}
            onClick={() => zoomByStep(1 / 1.2)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <span
            data-testid="scenario-zoom-level"
            className="w-14 rounded-md border border-[#e0d6c1] bg-[#fbf7ed] px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-[#4a4438]"
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className={buttonClass}
            onClick={() => zoomByStep(1.2)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              const bounds = currentCanvasBounds(scenario.terrainSnapshot);
              fit(bounds.width, bounds.height, bounds.originX, bounds.originY);
            }}
            title="Fit map to viewport"
          >
            Fit
          </button>
        </div>
      </div>

      {displayOpen ? (
        <div
          id="scenario-display-settings"
          data-testid="scenario-display-settings"
          className="border-t border-[#e0d6c1] bg-[#fbf7ed] px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-md">
              <h3 className={sectionHeadingClass}>Formation display</h3>
              <p className="mt-1 text-[0.68rem] leading-4 text-[#7c715c]">
                Formations at or below the roster&apos;s smallest echelon render as rectangles.
                Higher formations render as text, with larger default sizes for higher echelons.
                Names can show the full formation name, a shortened form, the commander&apos;s
                surname, or none at all.
              </p>
              <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-[#4a4438]">
                <input
                  type="checkbox"
                  checked={uppercaseFormationLabels}
                  aria-label="Uppercase formation labels"
                  onChange={(event) => setUppercaseFormationLabels(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[#5f7352]"
                />
                Uppercase formation labels
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-[#4a4438]">
                <input
                  type="checkbox"
                  checked={dynamicFrontage}
                  aria-label="Dynamic frontage by unit size"
                  onChange={(event) => setDynamicFrontage(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[#5f7352]"
                />
                Dynamic frontage (current length = 3,000 strong)
              </label>
              <button
                type="button"
                className="mt-2 block text-[0.68rem] font-semibold text-[#6b5d42] underline decoration-[#b9a986] underline-offset-2 transition-colors hover:text-[#3d5236]"
                onClick={resetFormationDisplay}
              >
                Reset display
              </button>
            </div>

            <div data-testid="formation-display-grid" className="flex max-w-3xl flex-col gap-3">
              <div>
                <h4 className="text-[0.62rem] font-semibold uppercase tracking-wide text-[#7c715c]">
                  Font sizes
                </h4>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {ECHELON_ORDER.map((echelon) => (
                    <NumberField
                      key={echelon}
                      label={`${ECHELON_LABELS[echelon]} font size`}
                      value={formationFontSizes[echelon]}
                      min={8}
                      max={200}
                      step={1}
                      onCommit={(value) => setFormationFontSize(echelon, value)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[0.62rem] font-semibold uppercase tracking-wide text-[#7c715c]">
                  Name style
                </h4>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ECHELON_ORDER.map((echelon) => (
                    <SelectField
                      key={echelon}
                      label={`${ECHELON_LABELS[echelon]} name`}
                      value={formationLabelFormats[echelon]}
                      options={FORMATION_LABEL_FORMAT_OPTIONS}
                      onChange={(format) => setFormationLabelFormat(echelon, format)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {newScenarioOpen ? <NewScenarioDialog onClose={() => setNewScenarioOpen(false)} /> : null}
    </div>
  );
}
