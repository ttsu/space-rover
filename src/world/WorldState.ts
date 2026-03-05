import { TILE_SIZE } from "../config/gameConfig";
import type { ResourceId } from "../resources/ResourceTypes";
import type { WorldStateSave } from "../state/Saves";

export interface DepositState {
  resourceId: "iron" | "crystal";
  hp: number;
}

export interface WorldState {
  clearedTileKeys: Set<string>;
  depositState: Map<string, DepositState>;
}

let activeWorldState: WorldState | null = null;

export function createEmptyWorldState(): WorldState {
  return {
    clearedTileKeys: new Set<string>(),
    depositState: new Map<string, DepositState>(),
  };
}

export function worldStateFromSave(save?: WorldStateSave): WorldState {
  if (!save) return createEmptyWorldState();
  const out = createEmptyWorldState();
  for (const key of save.clearedTileKeys ?? []) {
    out.clearedTileKeys.add(key);
  }
  const deposit = save.depositState ?? {};
  for (const [key, value] of Object.entries(deposit)) {
    if (!value) continue;
    const hp = Math.max(0, Math.floor(value.hp ?? 0));
    if (hp <= 0) continue;
    if (value.resourceId !== "iron" && value.resourceId !== "crystal") continue;
    out.depositState.set(key, {
      resourceId: value.resourceId,
      hp,
    });
  }
  return out;
}

export function worldStateToSave(state: WorldState): WorldStateSave {
  const depositState: WorldStateSave["depositState"] = {};
  for (const [key, value] of state.depositState.entries()) {
    depositState[key] = { resourceId: value.resourceId, hp: value.hp };
  }
  return {
    clearedTileKeys: [...state.clearedTileKeys],
    depositState,
  };
}

export function setActiveWorldState(state: WorldState | null): void {
  activeWorldState = state;
}

export function worldToTile(x: number, y: number): { gx: number; gy: number } {
  return {
    gx: Math.floor(x / TILE_SIZE),
    gy: Math.floor(y / TILE_SIZE),
  };
}

export function tileKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

export function markTileCleared(
  state: WorldState,
  gx: number,
  gy: number
): void {
  const key = tileKey(gx, gy);
  state.clearedTileKeys.add(key);
  state.depositState.delete(key);
}

export function setDepositAtTile(
  state: WorldState,
  gx: number,
  gy: number,
  resourceId: "iron" | "crystal",
  hp: number
): void {
  const key = tileKey(gx, gy);
  if (state.clearedTileKeys.has(key)) return;
  state.depositState.set(key, {
    resourceId,
    hp: Math.max(1, Math.floor(hp)),
  });
}

export function getDepositAtTile(
  state: WorldState,
  gx: number,
  gy: number
): DepositState | undefined {
  return state.depositState.get(tileKey(gx, gy));
}

export function onResourceCollectedAtWorldPos(x: number, y: number): void {
  if (!activeWorldState) return;
  const { gx, gy } = worldToTile(x, y);
  markTileCleared(activeWorldState, gx, gy);
}

export function onDepositDamagedAtWorldPos(
  x: number,
  y: number,
  resourceId: ResourceId,
  hp: number
): void {
  if (!activeWorldState) return;
  if (hp <= 0) return;
  if (resourceId !== "iron" && resourceId !== "crystal") return;
  const { gx, gy } = worldToTile(x, y);
  setDepositAtTile(activeWorldState, gx, gy, resourceId, hp);
}

export function onDepositDestroyedAtWorldPos(x: number, y: number): void {
  if (!activeWorldState) return;
  const { gx, gy } = worldToTile(x, y);
  markTileCleared(activeWorldState, gx, gy);
}
