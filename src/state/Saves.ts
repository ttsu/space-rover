import type { SlotId } from "../types/roverConfig";
import type { BiomePreset } from "../config/biomeConfig";
import {
  getDefaultEquipped,
  getDefaultCargoLayout,
  DEFAULT_CARGO_ROWS,
  CARGO_MAX_ROWS,
} from "../types/roverConfig";

export type Difficulty = "easy" | "normal" | "hard";

export interface CargoCountsSave {
  iron: number;
  crystal: number;
  gas: number;
}

export type CargoSlotContentSave = "iron" | "crystal" | "gas" | "empty";

export interface WorldStateDepositSave {
  resourceId: "iron" | "crystal";
  hp: number;
}

export interface WorldStateSave {
  clearedTileKeys: string[];
  depositState: Record<string, WorldStateDepositSave>;
}

export interface GameSave {
  id: string;
  seed: number;
  difficulty: Difficulty;
  biomePreset?: BiomePreset;
  bank: CargoCountsSave;
  totalResourcesCollected: CargoCountsSave;
  createdAt: number;
  /** Slot -> equipped item id or "base". */
  equipped?: Record<SlotId, string>;
  /** Item id -> level (stack count). */
  ownedItems?: Record<string, number>;
  /** Cargo grid slots (row-major): "iron"|"crystal"|"gas"|"empty". */
  cargoLayout?: CargoSlotContentSave[];
  /** Number of cargo rows (2..6). */
  cargoRows?: number;
  worldState?: WorldStateSave;
  /** Per-planet world state (cleared tiles, deposits). Key = planetId. */
  worldStateByPlanet?: Record<string, WorldStateSave>;
  /** One-time: ship repaired and Spaceship screen unlocked. */
  shipRepaired?: boolean;
  /** Future: hyperspace drive repaired for interstellar. */
  hyperspaceRepaired?: boolean;
  /** Current context: on planet surface or in orbit. */
  currentLocation?: "planet" | "orbit";
  /** Which planet the player is at / last landed on (solar system planet id). */
  currentPlanetId?: string;
  /** Which solar system (for multi-system later). */
  currentSolarSystemId?: string;
  /** Ship upgrade id -> level. */
  shipUpgrades?: Record<string, number>;
}

export interface SaveIndexEntry {
  id: string;
  difficulty: Difficulty;
  totalResourcesCollected: CargoCountsSave;
  createdAt: number;
}

const INDEX_KEY = "starship-saves-index";
const LAST_PLAYED_KEY = "starship-last-save-id";

function saveKey(id: string): string {
  return `starship-save-${id}`;
}

const emptyCargo: CargoCountsSave = { iron: 0, crystal: 0, gas: 0 };

function createEmptyWorldState(): WorldStateSave {
  return {
    clearedTileKeys: [],
    depositState: {},
  };
}

function getDefaultOwnedItems(): Record<string, number> {
  return Object.fromEntries(
    Object.values(getDefaultEquipped()).map((id) => [id, 1])
  );
}

let currentSave: GameSave | null = null;

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0]!;
  }
  return Math.floor(Date.now() * 0xffff);
}

function parseCargo(obj: unknown): CargoCountsSave {
  if (!obj || typeof obj !== "object") return { ...emptyCargo };
  const o = obj as Record<string, unknown>;
  return {
    iron: typeof o.iron === "number" ? o.iron : 0,
    crystal: typeof o.crystal === "number" ? o.crystal : 0,
    gas: typeof o.gas === "number" ? o.gas : 0,
  };
}

function parseCargoLayout(
  obj: unknown,
  totalSlots: number
): CargoSlotContentSave[] {
  if (!Array.isArray(obj))
    return getDefaultCargoLayout(DEFAULT_CARGO_ROWS) as CargoSlotContentSave[];
  const result: CargoSlotContentSave[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const v = obj[i];
    const safe: CargoSlotContentSave =
      typeof v === "string" &&
      (v === "iron" || v === "crystal" || v === "gas" || v === "empty")
        ? v
        : "empty";
    result.push(safe);
  }
  return result;
}

function parseCargoRows(obj: unknown): number {
  if (typeof obj !== "number") return DEFAULT_CARGO_ROWS;
  const n = Math.floor(obj);
  if (n < DEFAULT_CARGO_ROWS) return DEFAULT_CARGO_ROWS;
  if (n > CARGO_MAX_ROWS) return CARGO_MAX_ROWS;
  return n;
}

function parseWorldState(obj: unknown): WorldStateSave {
  if (!obj || typeof obj !== "object") return createEmptyWorldState();
  const o = obj as Record<string, unknown>;
  const cleared = Array.isArray(o.clearedTileKeys)
    ? o.clearedTileKeys.filter((k): k is string => typeof k === "string")
    : [];
  const depositOut: Record<string, WorldStateDepositSave> = {};
  const rawDeposit =
    o.depositState && typeof o.depositState === "object"
      ? (o.depositState as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(rawDeposit)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const resourceId = v.resourceId;
    const hp = typeof v.hp === "number" ? Math.floor(v.hp) : 0;
    if ((resourceId !== "iron" && resourceId !== "crystal") || hp <= 0)
      continue;
    depositOut[key] = {
      resourceId,
      hp,
    };
  }
  return {
    clearedTileKeys: cleared,
    depositState: depositOut,
  };
}

function parseSave(raw: string | null): GameSave | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const obj = data as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    const seed = typeof obj.seed === "number" ? obj.seed : generateSeed();
    const difficulty =
      obj.difficulty === "easy" ||
      obj.difficulty === "normal" ||
      obj.difficulty === "hard"
        ? obj.difficulty
        : "normal";
    const biomePreset =
      obj.biomePreset === "mixed" ||
      obj.biomePreset === "volcanic" ||
      obj.biomePreset === "ice" ||
      obj.biomePreset === "desert" ||
      obj.biomePreset === "toxic" ||
      obj.biomePreset === "storm" ||
      obj.biomePreset === "barren"
        ? obj.biomePreset
        : "mixed";
    const bank = parseCargo(obj.bank);
    const totalResourcesCollected = parseCargo(obj.totalResourcesCollected);
    const createdAt =
      typeof obj.createdAt === "number" ? obj.createdAt : Date.now();
    const cargoRows = parseCargoRows(obj.cargoRows);
    const totalSlots = 4 * cargoRows;
    const equipped =
      (obj.equipped as Record<SlotId, string> | undefined) ??
      getDefaultEquipped();
    const ownedItems =
      (obj.ownedItems as Record<string, number> | undefined) ??
      getDefaultOwnedItems();
    let cargoLayout = parseCargoLayout(obj.cargoLayout, totalSlots);
    const worldState = parseWorldState(obj.worldState);
    const shipRepaired = obj.shipRepaired === true;
    const hyperspaceRepaired = obj.hyperspaceRepaired === true;
    const currentLocation =
      obj.currentLocation === "planet" || obj.currentLocation === "orbit"
        ? obj.currentLocation
        : undefined;
    const currentPlanetId =
      typeof obj.currentPlanetId === "string" ? obj.currentPlanetId : undefined;
    const currentSolarSystemId =
      typeof obj.currentSolarSystemId === "string"
        ? obj.currentSolarSystemId
        : undefined;
    const rawShipUpgrades = obj.shipUpgrades;
    const shipUpgrades: Record<string, number> = {};
    if (rawShipUpgrades && typeof rawShipUpgrades === "object") {
      for (const [k, v] of Object.entries(rawShipUpgrades)) {
        if (typeof v === "number" && v >= 0) shipUpgrades[k] = Math.floor(v);
      }
    }
    const rawWorldStateByPlanet = obj.worldStateByPlanet;
    const worldStateByPlanet: Record<string, WorldStateSave> = {};
    if (rawWorldStateByPlanet && typeof rawWorldStateByPlanet === "object") {
      for (const [planetId, ws] of Object.entries(rawWorldStateByPlanet)) {
        if (typeof planetId === "string" && ws)
          worldStateByPlanet[planetId] = parseWorldState(ws);
      }
    }

    if (cargoLayout.length !== totalSlots) {
      cargoLayout = getDefaultCargoLayout(cargoRows) as CargoSlotContentSave[];
    }

    return {
      id,
      seed,
      difficulty,
      biomePreset,
      bank: { ...bank },
      totalResourcesCollected: { ...totalResourcesCollected },
      createdAt,
      equipped: { ...equipped },
      ownedItems: { ...ownedItems },
      cargoLayout: [...cargoLayout],
      cargoRows,
      worldState,
      worldStateByPlanet: Object.keys(worldStateByPlanet).length
        ? worldStateByPlanet
        : undefined,
      shipRepaired: shipRepaired || undefined,
      hyperspaceRepaired: hyperspaceRepaired || undefined,
      currentLocation,
      currentPlanetId,
      currentSolarSystemId,
      shipUpgrades: Object.keys(shipUpgrades).length ? shipUpgrades : undefined,
    };
  } catch {
    return null;
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function readIndex(): SaveIndexEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((item: unknown) => {
      const o = item as Record<string, unknown>;
      return {
        id: typeof o.id === "string" ? o.id : "",
        difficulty:
          o.difficulty === "easy" ||
          o.difficulty === "normal" ||
          o.difficulty === "hard"
            ? o.difficulty
            : "normal",
        totalResourcesCollected: parseCargo(o.totalResourcesCollected),
        createdAt: typeof o.createdAt === "number" ? o.createdAt : 0,
      };
    });
  } catch {
    return [];
  }
}

function writeIndex(entries: SaveIndexEntry[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function listSaves(): SaveIndexEntry[] {
  return readIndex();
}

/** Returns the live in-memory current save. Mutations affect the same object that saveCurrentSave() persists. */
export function getCurrentSave(): GameSave | null {
  return currentSave;
}

export function setCurrentSave(save: GameSave | null): void {
  currentSave = save;
}

export function loadSave(id: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const raw = storage.getItem(saveKey(id));
  const save = parseSave(raw);
  if (!save) return false;
  currentSave = save;
  storage.setItem(LAST_PLAYED_KEY, id);
  return true;
}

export function createSave(difficulty: Difficulty): GameSave {
  const id = generateId();
  const seed = generateSeed();
  const now = Date.now();
  const cargoRows = DEFAULT_CARGO_ROWS;
  const cargoLayout = getDefaultCargoLayout(
    cargoRows
  ) as CargoSlotContentSave[];
  const save: GameSave = {
    id,
    seed,
    difficulty,
    biomePreset: "mixed",
    bank: { ...emptyCargo },
    totalResourcesCollected: { ...emptyCargo },
    createdAt: now,
    equipped: getDefaultEquipped(),
    ownedItems: getDefaultOwnedItems(),
    cargoLayout: [...cargoLayout],
    cargoRows,
    worldState: createEmptyWorldState(),
    shipRepaired: false,
    currentLocation: "planet",
    currentPlanetId: "home",
  };
  currentSave = save;
  const storage = getStorage();
  if (storage) {
    storage.setItem(saveKey(id), JSON.stringify(save));
    const index = readIndex();
    index.push({
      id,
      difficulty,
      totalResourcesCollected: { ...emptyCargo },
      createdAt: now,
    });
    writeIndex(index);
    storage.setItem(LAST_PLAYED_KEY, id);
  }
  return {
    ...save,
    bank: { ...save.bank },
    totalResourcesCollected: { ...save.totalResourcesCollected },
  };
}

export function deleteSave(id: string): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(saveKey(id));
    if (currentSave?.id === id) currentSave = null;
    if (storage.getItem(LAST_PLAYED_KEY) === id)
      storage.removeItem(LAST_PLAYED_KEY);
    const index = readIndex().filter((e) => e.id !== id);
    writeIndex(index);
  }
}

export function saveCurrentSave(): void {
  if (!currentSave) return;
  const save = currentSave;
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(saveKey(save.id), JSON.stringify(save));
  const index = readIndex();
  const i = index.findIndex((e) => e.id === save.id);
  const entry: SaveIndexEntry = {
    id: save.id,
    difficulty: save.difficulty,
    totalResourcesCollected: { ...save.totalResourcesCollected },
    createdAt: save.createdAt,
  };
  if (i >= 0) index[i] = entry;
  else index.push(entry);
  writeIndex(index);
}

export function getLastPlayedSaveId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(LAST_PLAYED_KEY);
}
