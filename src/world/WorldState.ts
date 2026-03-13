import { TILE_SIZE } from "../config/gameConfig";
import type { ResourceId } from "../resources/ResourceTypes";
import type { WorldStateSave } from "../state/Saves";

export interface DepositState {
  resourceId: "iron" | "crystal";
  hp: number;
}

export interface CargoCountsMutable {
  iron: number;
  crystal: number;
  gas: number;
}

export interface DroppedCargoEntry {
  x: number;
  y: number;
  cargo: CargoCountsMutable;
}

export interface WorldState {
  clearedTileKeys: Set<string>;
  depositState: Map<string, DepositState>;
  droppedCargo: DroppedCargoEntry[];
}

const MAX_CLEARED_TILE_KEYS = 25000;
const MAX_DEPOSIT_STATE_KEYS = 10000;

let activeWorldState: WorldState | null = null;

export function createEmptyWorldState(): WorldState {
  return {
    clearedTileKeys: new Set<string>(),
    depositState: new Map<string, DepositState>(),
    droppedCargo: [],
  };
}

export function isCargoEmpty(cargo: CargoCountsMutable): boolean {
  return cargo.iron <= 0 && cargo.crystal <= 0 && cargo.gas <= 0;
}

export function addDroppedCargo(
  state: WorldState,
  x: number,
  y: number,
  cargo: CargoCountsMutable
): void {
  if (isCargoEmpty(cargo)) return;
  state.droppedCargo.push({
    x,
    y,
    cargo: { iron: cargo.iron, crystal: cargo.crystal, gas: cargo.gas },
  });
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
  for (const d of save.droppedCargo ?? []) {
    if (d.cargo.iron > 0 || d.cargo.crystal > 0 || d.cargo.gas > 0) {
      out.droppedCargo.push({
        x: d.x,
        y: d.y,
        cargo: {
          iron: Math.max(0, d.cargo.iron),
          crystal: Math.max(0, d.cargo.crystal),
          gas: Math.max(0, d.cargo.gas),
        },
      });
    }
  }
  return out;
}

export function worldStateToSave(state: WorldState): WorldStateSave {
  const depositState: WorldStateSave["depositState"] = {};
  const limitedDepositEntries = tailEntries(
    [...state.depositState.entries()],
    MAX_DEPOSIT_STATE_KEYS
  );
  for (const [key, value] of limitedDepositEntries) {
    depositState[key] = { resourceId: value.resourceId, hp: value.hp };
  }
  const droppedCargo = state.droppedCargo
    .filter((d) => !isCargoEmpty(d.cargo))
    .map((d) => ({
      x: d.x,
      y: d.y,
      cargo: {
        iron: d.cargo.iron,
        crystal: d.cargo.crystal,
        gas: d.cargo.gas,
      },
    }));

  return {
    clearedTileKeys: tailEntries(
      [...state.clearedTileKeys.values()],
      MAX_CLEARED_TILE_KEYS
    ),
    depositState,
    droppedCargo,
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

function tailEntries<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  return items.slice(items.length - maxCount);
}
