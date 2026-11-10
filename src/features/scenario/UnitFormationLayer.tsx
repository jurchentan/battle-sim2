import type Konva from 'konva';
import { useEffect, useMemo, useRef } from 'react';
import { Transformer } from 'react-konva';
import type { BattleScenario, Faction, UnitDefinition, UnitPhaseState } from '../../models';
import { useScenarioStore } from '../../state/scenarioStore';
import type { FormationFontSizes, FormationLabelFormats } from './scenarioDocuments';
import {
  activeScenarioPhase,
  isRectangleFormation,
  renderedFrontageLength,
  scenarioUnitLabel,
} from './scenarioDocuments';
import { UnitFormationShape } from './UnitFormationShape';

interface FormationEntry {
  unit: UnitDefinition;
  faction: Faction;
  state: UnitPhaseState;
}

interface UnitFormationLayerProps {
  scenario: BattleScenario;
  hiddenFactionIds: readonly string[];
  formationFontSizes: FormationFontSizes;
  formationLabelFormats: FormationLabelFormats;
  uppercaseLabels: boolean;
  dynamicFrontage: boolean;
  interactive: boolean;
  onSelectUnit: (unitId: string) => void;
  registerNode: (unitId: string, node: Konva.Node | null) => void;
}

export function UnitFormationLayer({
  scenario,
  hiddenFactionIds,
  formationFontSizes,
  formationLabelFormats,
  uppercaseLabels,
  dynamicFrontage,
  interactive,
  onSelectUnit,
  registerNode,
}: UnitFormationLayerProps) {
  const updateUnitState = useScenarioStore((state) => state.updateUnitState);

  const phase = activeScenarioPhase(scenario);
  const entries = useMemo<FormationEntry[]>(() => {
    if (!phase) return [];
    const unitsById = new Map(
      scenario.rosterSnapshot.units.map((unit) => [unit.id, unit] as const),
    );
    const factionsById = new Map(
      scenario.rosterSnapshot.factions.map((faction) => [faction.id, faction] as const),
    );
    const hidden = new Set(hiddenFactionIds);

    return Object.entries(phase.unitStates)
      .map(([unitId, state]): FormationEntry | null => {
        const unit = unitsById.get(unitId);
        const faction = unit ? factionsById.get(unit.factionId) : undefined;
        return unit && faction ? { unit, faction, state } : null;
      })
      .filter(
        (entry): entry is FormationEntry =>
          entry !== null && entry.state.visible && !hidden.has(entry.faction.id),
      )
      .sort((a, b) => a.unit.id.localeCompare(b.unit.id));
  }, [hiddenFactionIds, phase, scenario.rosterSnapshot.factions, scenario.rosterSnapshot.units]);

  return (
    <>
      {entries.map(({ unit, faction, state }) => (
        <UnitFormationShape
          key={unit.id}
          unit={unit}
          faction={faction}
          state={state}
          displayName={scenarioUnitLabel(
            scenario,
            unit,
            state,
            formationLabelFormats[unit.echelon],
          )}
          renderAsRectangle={isRectangleFormation(
            unit.echelon,
            scenario.rosterSnapshot.smallestUnitEchelon,
          )}
          renderFrontageLength={renderedFrontageLength(
            state.frontageLength,
            state.effectiveStrength ?? unit.initialStrength,
            dynamicFrontage,
          )}
          labelFontSize={formationFontSizes[unit.echelon]}
          uppercaseLabel={uppercaseLabels}
          interactive={interactive}
          onSelect={onSelectUnit}
          onChange={(patch) => {
            updateUnitState(unit.id, patch);
          }}
          registerNode={registerNode}
        />
      ))}
    </>
  );
}

interface UnitFormationTransformerProps {
  nodeMap: Map<string, Konva.Node>;
  nodeVersion: number;
  selectedUnitId: string | null;
  enabled: boolean;
  resizable: boolean;
}

/**
 * Rendered outside the camera-transformed group so anchors keep a constant
 * screen size at every zoom level.
 */
export function UnitFormationTransformer({
  nodeMap,
  nodeVersion,
  selectedUnitId,
  enabled,
  resizable,
}: UnitFormationTransformerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const node = enabled && selectedUnitId ? nodeMap.get(selectedUnitId) : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [enabled, nodeMap, nodeVersion, selectedUnitId]);

  return (
    <Transformer
      ref={transformerRef}
      enabledAnchors={resizable ? ['middle-left', 'middle-right'] : []}
      rotateEnabled={enabled}
      rotateAnchorOffset={26}
      borderStroke="#3d4b3f"
      borderDash={[5, 4]}
      borderStrokeWidth={1.5}
      anchorStroke="#3d4b3f"
      anchorFill="#f7f2e6"
      anchorSize={8}
      anchorCornerRadius={2}
      padding={6}
      flipEnabled={false}
      ignoreStroke
      boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 ? oldBox : newBox)}
    />
  );
}
