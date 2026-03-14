import type { ResourceId } from "../resources/ResourceTypes";
import type { CargoCounts } from "../entities/Rover";
import type { RunStats } from "./GameState";
import type { HazardKind } from "./GameState";
import { BIOME_CONFIGS, type BiomePreset } from "../config/biomeConfig";

export type RunGoalKind =
  | { type: "collectResource"; resourceId: ResourceId; amount: number }
  | { type: "totalCargo"; amount: number }
  | { type: "fillCapacity" }
  | { type: "noHazardDamage"; hazard: HazardKind };

export interface RunGoal {
  kind: RunGoalKind;
  label: string;
  bonusResource: ResourceId;
  bonusAmount: number;
}

/** Live state during a run for real-time goal satisfaction. */
export interface GoalLiveState {
  cargo: CargoCounts;
  usedCapacity: number;
  maxCapacity: number;
  hazardHits: Record<HazardKind, number>;
}

function goalLabel(kind: RunGoalKind): string {
  switch (kind.type) {
    case "collectResource":
      return `Return with ${kind.amount} ${kind.resourceId}`;
    case "totalCargo":
      return `Collect ${kind.amount} total cargo`;
    case "fillCapacity":
      return "Fill cargo to max capacity";
    case "noHazardDamage":
      return `Take no ${hazardLabel(kind.hazard)} damage`;
  }
}

const BASE_GOAL_TEMPLATES: RunGoalKind[] = [
  { type: "collectResource", resourceId: "iron", amount: 3 },
  { type: "collectResource", resourceId: "crystal", amount: 2 },
  { type: "collectResource", resourceId: "gas", amount: 1 },
  { type: "totalCargo", amount: 6 },
  { type: "totalCargo", amount: 10 },
  { type: "fillCapacity" },
];

export interface GoalGenerationContext {
  biomePreset?: BiomePreset;
}

export function generateGoalChoices(
  count = 3,
  context?: GoalGenerationContext
): RunGoal[] {
  const hazardGoals = getHazardGoalTemplates(context?.biomePreset ?? "barren");
  const shuffled = [...BASE_GOAL_TEMPLATES, ...hazardGoals].sort(
    () => Math.random() - 0.5
  );
  return shuffled.slice(0, count).map((kind) => ({
    kind,
    label: goalLabel(kind),
    bonusResource: kind.type === "collectResource" ? kind.resourceId : "iron",
    bonusAmount:
      kind.type === "fillCapacity" || kind.type === "noHazardDamage" ? 2 : 1,
  }));
}

let currentGoals: RunGoal[] = [];
let goalResults: {
  goal: RunGoal;
  met: boolean;
  bonusResource: ResourceId;
  bonusAmount: number;
}[] = [];

export function setCurrentGoals(goals: RunGoal[]): void {
  currentGoals = [...goals];
  goalResults = [];
}

export function getCurrentGoals(): RunGoal[] {
  return currentGoals;
}

/** Check if a goal is currently satisfied (for real-time HUD). */
export function isGoalSatisfied(goal: RunGoal, state: GoalLiveState): boolean {
  const kind = goal.kind;
  switch (kind.type) {
    case "collectResource":
      return state.cargo[kind.resourceId] >= kind.amount;
    case "totalCargo":
      return state.usedCapacity >= kind.amount;
    case "fillCapacity":
      return state.usedCapacity >= state.maxCapacity;
    case "noHazardDamage":
      return state.hazardHits[kind.hazard] === 0;
  }
}

export interface GoalResult {
  goal: RunGoal;
  met: boolean;
  bonusResource: ResourceId;
  bonusAmount: number;
}

export function getGoalResults(): GoalResult[] {
  return goalResults;
}

/** Evaluate all current goals at end of run; call before applying bonuses. */
export function evaluateGoals(run: RunStats, survived: boolean): void {
  goalResults = currentGoals.map((goal) => {
    const kind = goal.kind;
    let met = false;
    if (survived) {
      switch (kind.type) {
        case "collectResource":
          met = run.cargo[kind.resourceId] >= kind.amount;
          break;
        case "totalCargo":
          met = run.usedCapacity >= kind.amount;
          break;
        case "fillCapacity":
          met = run.usedCapacity >= run.maxCapacity;
          break;
        case "noHazardDamage":
          met = run.hazardsHit[kind.hazard] === 0;
          break;
      }
    }
    return {
      goal,
      met,
      bonusResource: goal.bonusResource,
      bonusAmount: met ? goal.bonusAmount : 0,
    };
  });
}

function getHazardGoalTemplates(biomePreset: BiomePreset): RunGoalKind[] {
  if (biomePreset !== "mixed") {
    return BIOME_CONFIGS[biomePreset].goals.hazardFocus.map((hazard) => ({
      type: "noHazardDamage" as const,
      hazard,
    }));
  }
  return [
    { type: "noHazardDamage", hazard: "lava" },
    { type: "noHazardDamage", hazard: "lightning" },
    { type: "noHazardDamage", hazard: "wind" },
    { type: "noHazardDamage", hazard: "sandstorm" },
  ];
}

function hazardLabel(hazard: HazardKind): string {
  switch (hazard) {
    case "lava":
      return "lava";
    case "lightning":
      return "lightning";
    case "rock":
      return "rock impact";
    case "wind":
      return "wind";
    case "quake":
      return "quake";
    case "sandstorm":
      return "sandstorm";
  }
}
