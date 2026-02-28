export type Difficulty = "easy" | "normal" | "hard";

export interface CargoCountsSave {
  iron: number;
  crystal: number;
  gas: number;
}

export interface GameSave {
  id: string;
  seed: number;
  difficulty: Difficulty;
  bank: CargoCountsSave;
  appliedUpgrades: string[];
  totalResourcesCollected: CargoCountsSave;
  createdAt: number;
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

function parseSave(raw: string | null): GameSave | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const obj = data as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    const seed = typeof obj.seed === "number" ? obj.seed : generateSeed();
    const difficulty =
      obj.difficulty === "easy" || obj.difficulty === "normal" || obj.difficulty === "hard"
        ? obj.difficulty
        : "normal";
    const bank = parseCargo(obj.bank);
    const appliedUpgrades = Array.isArray(obj.appliedUpgrades)
      ? (obj.appliedUpgrades as string[])
      : [];
    const totalResourcesCollected = parseCargo(obj.totalResourcesCollected);
    const createdAt = typeof obj.createdAt === "number" ? obj.createdAt : Date.now();
    return {
      id,
      seed,
      difficulty,
      bank: { ...bank },
      appliedUpgrades: [...appliedUpgrades],
      totalResourcesCollected: { ...totalResourcesCollected },
      createdAt,
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
          o.difficulty === "easy" || o.difficulty === "normal" || o.difficulty === "hard"
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
  const save: GameSave = {
    id,
    seed,
    difficulty,
    bank: { ...emptyCargo },
    appliedUpgrades: [],
    totalResourcesCollected: { ...emptyCargo },
    createdAt: now,
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
  return { ...save, bank: { ...save.bank }, totalResourcesCollected: { ...save.totalResourcesCollected } };
}

export function deleteSave(id: string): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(saveKey(id));
    if (currentSave?.id === id) currentSave = null;
    if (storage.getItem(LAST_PLAYED_KEY) === id) storage.removeItem(LAST_PLAYED_KEY);
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
