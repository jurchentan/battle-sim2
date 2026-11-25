import { useEffect } from 'react';
import type { BattleScenario } from '../../models';
import { useScenarioStore } from '../../state/scenarioStore';
import { FactionForm } from '../army/FactionForm';

export function ScenarioFactionDialog({
  scenario,
  factionId,
  onClose,
}: {
  scenario: BattleScenario;
  factionId?: string;
  onClose: () => void;
}) {
  const addFaction = useScenarioStore((state) => state.addFaction);
  const updateFaction = useScenarioStore((state) => state.updateFaction);
  const faction = factionId
    ? scenario.orderOfBattle.factions.find((candidate) => candidate.id === factionId)
    : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2b23]/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-faction-heading"
        data-testid="scenario-faction-dialog"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            Scenario order of battle
          </p>
          <h2
            id="scenario-faction-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            {faction ? 'Edit faction' : 'Add a faction'}
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            Faction colors, naming rules, and default brigade strengths apply to every formation in
            this scenario.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <FactionForm
            roster={scenario.orderOfBattle}
            initial={faction}
            onSubmit={(values) => {
              const patch = {
                name: values.name,
                color: values.color,
                labelColor: values.labelColor,
                namingModes: values.namingModes,
                defaultStrengths: values.defaultStrengths,
                notes: values.notes,
              };
              const result = faction ? updateFaction(faction.id, patch) : addFaction(values);
              return result.ok ? { ok: true } : { ok: false, error: result.error };
            }}
            onDone={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
