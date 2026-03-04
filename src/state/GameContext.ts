import type { CargoCounts } from "../entities/Rover";
import type { ResourceId } from "../resources/ResourceTypes";
import type { SlotId } from "../types/roverConfig";
import type { GameSave, CargoSlotContentSave } from "./Saves";
import type { PersistedProgress } from "./Progress";
import { getCurrentSave } from "./Saves";
import {
  getProgress,
  getEquipped,
  getOwnedItems,
  getCargoLayout,
  getMaxCargoFromLayout as getMaxCargoFromLayoutImpl,
} from "./Progress";
import {
  finishRun as finishRunImpl,
  resetRunTracking as resetRunTrackingImpl,
} from "./GameState";

/**
 * Facade over global game state (saves, progress, run tracking).
 * Production code uses getGameContext(); tests can inject a mock context.
 */
export interface GameContext {
  getCurrentSave(): GameSave | null;
  getProgress(): PersistedProgress;
  getEquipped(): Record<SlotId, string>;
  getOwnedItems(): Record<string, number>;
  getCargoLayout(): CargoSlotContentSave[];
  getMaxCargoFromLayout(
    layout: CargoSlotContentSave[]
  ): Record<ResourceId, number>;
  finishRun(
    cargo: CargoCounts,
    usedCapacity: number,
    maxCapacity: number,
    healthRemaining: number
  ): void;
  resetRunTracking(): void;
}

const defaultContext: GameContext = {
  getCurrentSave,
  getProgress,
  getEquipped,
  getOwnedItems,
  getCargoLayout,
  getMaxCargoFromLayout: getMaxCargoFromLayoutImpl,
  finishRun: finishRunImpl,
  resetRunTracking: resetRunTrackingImpl,
};

/** Returns the default game context. Tests can replace this or accept an injected context. */
export function getGameContext(): GameContext {
  return defaultContext;
}
