import type Konva from 'konva';
import { useEffect, useMemo, useRef } from 'react';
import { Transformer } from 'react-konva';
import type { BattleScenario, Faction, UnitDefinition, UnitPhaseState } from '../../models';
import { useScenarioEditorStore } from '../../state/scenarioEditorStore';
import { useScenarioStore } from '../../state/scenarioStore';
import { descendantUnitIds } from '../army/rosterDocuments';
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
  formationNodes: ReadonlyMap<string, Konva.Node>;
  labelNodes: ReadonlyMap<string, Konva.Node>;
  registerNode: (unitId: string, node: Konva.Node | null) => void;
  registerLabelNode: (unitId: string, node: Konva.Node | null) => void;
}

interface DragSession {
  unitIds: string[];
  startPositions: Map<string, { x: number; y: number }>;
}

function roundPosition(value: number): number {
  return Math.round(value * 100) / 100;
}

export function UnitFormationLayer({
  scenario,
  hiddenFactionIds,
  formationFontSizes,
  formationLabelFormats,
  uppercaseLabels,
  dynamicFrontage,
  interactive,
  formationNodes,
  labelNodes,
  registerNode,
  registerLabelNode,
}: UnitFormationLayerProps) {
  const updateUnitStates = useScenarioStore((state) => state.updateUnitStates);
  const selectUnit = useScenarioEditorStore((state) => state.selectUnit);
  const selectUnits = useScenarioEditorStore((state) => state.selectUnits);
  const toggleUnitSelection = useScenarioEditorStore((state) => state.toggleUnitSelection);
  const ensureUnitSelected = useScenarioEditorStore((state) => state.ensureUnitSelected);
  const dragSessionRef = useRef<DragSession | null>(null);
  const pendingTransformRef = useRef<Map<string, Partial<UnitPhaseState>> | null>(null);
  const transformFlushScheduledRef = useRef(false);

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

  const handleSelect = (unitId: string, additive: boolean): void => {
    if (additive) {
      toggleUnitSelection(unitId);
    } else {
      selectUnit(unitId);
    }
  };

  const handleSelectHierarchy = (unitId: string): void => {
    const availableUnitIds = new Set(entries.map((entry) => entry.unit.id));
    if (!availableUnitIds.has(unitId)) return;

    const subordinateIds = descendantUnitIds(scenario.rosterSnapshot, unitId);
    const selection = [unitId, ...subordinateIds].filter((id) => availableUnitIds.has(id));
    selectUnits(selection);
  };

  const handleDragStart = (unitId: string, additive: boolean, _node: Konva.Node): void => {
    ensureUnitSelected(unitId, additive);

    const state = useScenarioStore.getState();
    const activePhase = activeScenarioPhase(state.document);
    if (!activePhase) return;

    const selected = useScenarioEditorStore.getState().selectedUnitIds;
    const startPositions = new Map<string, { x: number; y: number }>();
    for (const selectedId of selected) {
      const unitState = activePhase.unitStates[selectedId];
      if (unitState) startPositions.set(selectedId, { x: unitState.x, y: unitState.y });
    }

    dragSessionRef.current = {
      unitIds: selected.filter((id) => startPositions.has(id)),
      startPositions,
    };
  };

  const handleDragMove = (unitId: string, node: Konva.Node): void => {
    const session = dragSessionRef.current;
    if (!session || session.unitIds.length <= 1) return;

    const leaderStart = session.startPositions.get(unitId);
    if (!leaderStart) return;

    const dx = node.x() - leaderStart.x;
    const dy = node.y() - leaderStart.y;

    for (const selectedId of session.unitIds) {
      if (selectedId === unitId) continue;
      const start = session.startPositions.get(selectedId);
      if (!start) continue;
      formationNodes.get(selectedId)?.position({ x: start.x + dx, y: start.y + dy });
      labelNodes.get(selectedId)?.position({ x: start.x + dx, y: start.y + dy });
    }

    node.getLayer()?.batchDraw();
  };

  const handleDragEnd = (unitId: string, node: Konva.Node): void => {
    const session = dragSessionRef.current;
    dragSessionRef.current = null;
    if (!session) return;

    const leaderStart = session.startPositions.get(unitId);
    if (!leaderStart) return;

    const dx = node.x() - leaderStart.x;
    const dy = node.y() - leaderStart.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

    const patches: Record<string, Partial<UnitPhaseState>> = {};
    for (const selectedId of session.unitIds) {
      const start = session.startPositions.get(selectedId);
      if (!start) continue;
      patches[selectedId] = {
        x: roundPosition(start.x + dx),
        y: roundPosition(start.y + dy),
      };
    }

    updateUnitStates(patches);
  };

  const handleTransformEnd = (unitId: string, patch: Partial<UnitPhaseState>): void => {
    const pending = pendingTransformRef.current ?? new Map<string, Partial<UnitPhaseState>>();
    const current = pending.get(unitId) ?? {};
    pending.set(unitId, { ...current, ...patch });
    pendingTransformRef.current = pending;

    if (transformFlushScheduledRef.current) return;
    transformFlushScheduledRef.current = true;

    queueMicrotask(() => {
      transformFlushScheduledRef.current = false;
      const patches = pendingTransformRef.current;
      pendingTransformRef.current = null;
      if (!patches || patches.size === 0) return;

      updateUnitStates(Object.fromEntries(patches));
    });
  };

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
          onSelect={handleSelect}
          onSelectHierarchy={handleSelectHierarchy}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
          registerNode={registerNode}
          registerLabelNode={registerLabelNode}
        />
      ))}
    </>
  );
}

interface UnitFormationTransformerProps {
  nodeMap: Map<string, Konva.Node>;
  nodeVersion: number;
  selectedUnitIds: readonly string[];
  enabled: boolean;
  resizable: boolean;
}

/**
 * Rendered outside the camera-transformed group so anchors keep a constant
 * screen size at every zoom level. Multiple selected formations share one
 * bounding box and rotate together.
 */
export function UnitFormationTransformer({
  nodeMap,
  nodeVersion,
  selectedUnitIds,
  enabled,
  resizable,
}: UnitFormationTransformerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const nodes = enabled
      ? selectedUnitIds.flatMap((unitId) => {
          const node = nodeMap.get(unitId);
          return node ? [node] : [];
        })
      : [];
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [enabled, nodeMap, nodeVersion, selectedUnitIds]);

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
