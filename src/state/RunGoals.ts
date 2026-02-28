import type { ResourceId } from "../resources/ResourceTypes";
import type { CargoCounts } from "../entities/Rover";
import type { RunStats } from "./GameState";

export type RunGoalKind =
  | { type: "collectResource"; resourceId: ResourceId; amount: number }
  | { type: "totalCargo"; amount: number }
  | { type: "fillCapacity" }
  | { type: "noLavaDamage" };

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
  lavaHits: number;
}

function goalLabel(kind: RunGoalKind): string {
  switch (kind.type) {
    case "collectResource":
      return `Return with ${kind.amount} ${kind.resourceId}`;
    case "totalCargo":
      return `Collect ${kind.amount} total cargo`;
    case "fillCapacity":
      return "Fill cargo to max capacity";
    case "noLavaDamage":
      return "Take no lava damage";
  }
}

const GOAL_TEMPLATES: RunGoalKind[] = [
  { type: "collectResource", resourceId: "iron", amount: 3 },
  { type: "collectResource", resourceId: "crystal", amount: 2 },
  { type: "collectResource", resourceId: "gas", amount: 1 },
  { type: "totalCargo", amount: 6 },
  { type: "totalCargo", amount: 10 },
  { type: "fillCapacity" },
  { type: "noLavaDamage" },
];

export function generateGoalChoices(count = 3): RunGoal[] {
  const shuffled = [...GOAL_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((kind) => ({
    kind,
    label: goalLabel(kind),
    bonusResource: kind.type === "collectResource" ? kind.resourceId : "iron",
    bonusAmount:
      kind.type === "fillCapacity" || kind.type === "noLavaDamage" ? 2 : 1,
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
    case "noLavaDamage":
      return state.lavaHits === 0;
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
export function evaluateGoals(
  run: RunStats,
  survived: boolean,
  lavaHits: number
): void {
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
        case "noLavaDamage":
          met = lavaHits === 0;
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
