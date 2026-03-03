---
name: Biomes and environmental hazards
overview: Introduce biome types (e.g. volcanic, ice, desert, toxic, storm) and biome-specific hazard sets; add new hazard classes (e.g. acid, ice, sandstorm) and wire them into PlanetGenerator and GameState.
todos:
  - id: biome-types-config
    content: Define BiomeId type and per-biome config (hazard densities, which hazards spawn); add to gameConfig or new biomeConfig
    status: pending
  - id: hazard-kinds-new
    content: Extend HazardKind and add new hazard classes (e.g. AcidPool, IcePatch, SandstormZone); implement in Hazards.ts
    status: pending
  - id: rover-resists-new
    content: Add rover resists for new damage types (acid, ice, etc.) in RoverStats and UpgradeDefs if desired
    status: pending
  - id: planet-gen-biome
    content: Pass biome (or default) into generatePlanet; spawn hazards and tiles according to biome config
    status: pending
  - id: tile-visual-biome
    content: Optional: tile color/kind per biome in Tile.ts and PlanetGenerator
    status: pending
isProject: true
---

# Biomes and environmental hazards — implementation plan

This plan adds biome-based planet generation and new environmental hazard types. Current code: single mixed layout in [PlanetGenerator.ts](src/world/PlanetGenerator.ts) (lava, rocks, wind+lightning), [Hazards.ts](src/hazards/Hazards.ts) (LavaPool, RockObstacle, WindZone, LightningZone), [GameState.ts](src/state/GameState.ts) (`HazardKind`), [Tile.ts](src/world/Tile.ts) (TileKind: ground, base, etc.).

---

## 1. Biome type and config

**New file: [src/config/biomeConfig.ts](src/config/biomeConfig.ts)** (or add to [gameConfig.ts](src/config/gameConfig.ts))

- **BiomeId type:** `export type BiomeId = "volcanic" | "ice" | "desert" | "toxic" | "storm" | "barren";`
- **Per-biome config interface:** For each biome, define:
  - `hazardDensities: Partial<Record<HazardKind, number>>` — fraction of tiles (like current LAVA_DENSITY). Omit or 0 = do not spawn.
  - Optional: `tileKind?: TileKind` for ground (e.g. ice biome uses "ice" tile), or keep single "ground" and use tile color override per biome.
  - Optional: `resourceDensityMultiplier: number` (default 1).

**Example:**

```ts
export interface BiomeConfig {
  hazardDensities: Partial<Record<HazardKind, number>>;
  resourceDensityMultiplier?: number;
  /** Optional tile appearance; if not set, use default ground. */
  groundTileKind?: TileKind;
}

export const BIOME_CONFIGS: Record<BiomeId, BiomeConfig> = {
  volcanic: {
    hazardDensities: { lava: 0.08, rock: 0.07, quake: 0.02 },
    resourceDensityMultiplier: 1,
  },
  ice: {
    hazardDensities: { ice: 0.06, wind: 0.05 },
    resourceDensityMultiplier: 1.1,
  },
  desert: {
    hazardDensities: { sandstorm: 0.05, quake: 0.01 },
    resourceDensityMultiplier: 0.9,
  },
  toxic: {
    hazardDensities: { acid: 0.07, wind: 0.03 },
    resourceDensityMultiplier: 1,
  },
  storm: {
    hazardDensities: { lightning: 0.06, wind: 0.08 },
    resourceDensityMultiplier: 1,
  },
  barren: {
    hazardDensities: { rock: 0.1, wind: 0.04 },
    resourceDensityMultiplier: 0.8,
  },
};
```

You will extend `HazardKind` to include `"ice"`, `"sandstorm"`, `"acid"` (and optionally others). For “storm” biome, lightning and wind are placed together today; you can keep a combined “storm zone” spawn or split into separate lightning/wind densities.

---

## 2. Extend HazardKind and GameState

**File: [src/state/GameState.ts](src/state/GameState.ts)**

- Extend `HazardKind`: e.g. `"lava" | "lightning" | "rock" | "wind" | "quake" | "ice" | "sandstorm" | "acid"`.
- Update `emptyHazards` so every `HazardKind` has a key with value 0.
- No change to `finishRun` or `recordHazardHit`; they already use `Record<HazardKind, number>`.

---

## 3. New hazard classes in Hazards.ts

**File: [src/hazards/Hazards.ts](src/hazards/Hazards.ts)**

Follow the pattern of `HazardBase`: constructor takes `(x, y, width, height, color, rover, kind)`, `onInitialize` sets collision type and collisionstart/collisionend for rover, `onPreUpdate` applies effect and calls `this.hit(amount)` when appropriate.

**AcidPool:** Same pattern as LavaPool: Passive collision, rover-in-zone flag, tick timer. Every N ms (e.g. 500) call `this.hit(1)` (or 2 for harder feel). Optionally call `rover.applySlow(0.3)`. Use a different color (e.g. green) and particle emitter. Add `fromAcid?: boolean` to `takeDamage` in Rover if you want separate resist (see RoverStats); else use `fromLava: false` and use `flatDamageReduction` or new `acidDamageReduction`.

**IcePatch:** Passive collision; when rover is in zone, apply strong slow (e.g. `applySlow(0.7)`) and optionally low friction so rover slides. No DoT unless you want “freezing” DoT. Use `HazardKind` `"ice"`. If you add `iceSlowResist` to RoverStats, use it in `applySlow` like lava.

**SandstormZone:** Similar to WindZone: direction, rover-in-zone, apply velocity push each frame; optionally reduce visibility (e.g. set a “sandstormActive” flag on rover that Hud uses to dim screen). Use `HazardKind` `"sandstorm"`. Can reuse or extend wind resist for “sandstorm resist” or a separate stat.

**Quake (placed):** Currently “quake” exists in GameState but is driven by a timer in PlanetScene (screen shake). Optionally add a **QuakeZone** actor: when rover is inside, trigger screen shake and `this.hit(1)` once per quake “phase”, then kill or reset. Or keep quake as global timer and only use `HazardKind` for stats; then no QuakeZone actor needed for volcanic.

Implement only the hazards you need for the biomes you ship (e.g. start with volcanic + ice: add IcePatch and keep lava/rock; then add acid for toxic, sandstorm for desert).

---

## 4. Rover resists for new damage types (optional)

**File: [src/upgrades/RoverStats.ts](src/upgrades/RoverStats.ts)**

- Add e.g. `acidDamageReduction: number`, `iceSlowResist: number` (0–1). In `HazardBase.hit` you pass a flag; in Rover `takeDamage(amount, fromLava, fromAcid)` apply `acidDamageReduction` when `fromAcid`. For ice, in IcePatch use `applySlow(factor * (1 - rover.roverStats.iceSlowResist))`.

**File: [src/entities/Rover.ts](src/entities/Rover.ts)**

- Extend `takeDamage(amount: number, fromLava = false, fromAcid = false)` and apply `flatDamageReduction` and `acidDamageReduction` (and lava reduction when `fromLava`) before subtracting health.

**File: [src/upgrades/UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts)**

- Add effect kinds `acidDamageReduction`, `iceSlowResist` and corresponding defs (e.g. “Acid Plating”, “Ice Treads”).

---

## 5. PlanetGenerator: accept biome and use config

**File: [src/world/PlanetGenerator.ts](src/world/PlanetGenerator.ts)**

- **GeneratePlanetOptions:** Add `biome?: BiomeId`. Default to `"volcanic"` (or current behavior) if omitted.
- **Lookup config:** `const biomeConfig = BIOME_CONFIGS[options?.biome ?? "volcanic"];` and `const mult = DIFFICULTY_MULTIPLIERS[difficulty]`.
- **Resource count:** Use `RESOURCE_DENSITY * mult.resourceDensity * (biomeConfig.resourceDensityMultiplier ?? 1)`.
- **Hazard placement:** Instead of fixed `lavaCount`, `rockCount`, `stormCount`, iterate over `biomeConfig.hazardDensities`. For each key (e.g. `lava`, `ice`, `acid`, `wind`, `lightning`, `rock`, `sandstorm`, `quake`), compute count = `totalTiles * density * mult[appropriateDifficultyKey]`. Use existing `placeHazard` to avoid base vicinity and overlapping tiles.
- **Spawn logic per kind:**
  - `lava` → LavaPool (existing).
  - `rock` → RockObstacle (existing).
  - `wind` + `lightning` → if you keep “storm zone” as one unit, use a combined density or spawn wind and lightning on same tile when biome is storm; else spawn WindZone and LightningZone separately by their densities.
  - `ice` → new IcePatch.
  - `acid` → new AcidPool.
  - `sandstorm` → new SandstormZone (like WindZone with direction).
  - `quake` → optional QuakeZone or leave to global timer.

**Difficulty:** Extend [difficulty.ts](src/config/difficulty.ts) with multipliers for new hazard types (e.g. `iceDensity`, `acidDensity`, `sandstormDensity`) so each biome’s hazards scale with difficulty.

---

## 6. Tiles and visuals per biome (optional)

**File: [src/world/Tile.ts](src/world/Tile.ts)**

- `TileKind` already has `ground`, `base`, etc. Add kinds like `ice`, `sand`, `toxic` if you want tile art to change. In PlanetGenerator, when creating tiles, pass `biomeConfig.groundTileKind ?? "ground"` for non-base tiles (or derive from biomeId).
- Update `colorForKind` (or equivalent) so each kind has a color. Optionally store `biomeId` on Tile for debugging or for fog/explored rendering.

---

## 7. How mission selects biome

- **Option A:** Single planet type for now: always pass `biome: "volcanic"` from PlanetScene (no UI change). Later, mission select or difficulty can set `biome`.
- **Option B:** Planet run menu or difficulty screen lets player (or difficulty) choose biome; pass chosen `BiomeId` into `getCurrentSave()` or scene init and then into `generatePlanet(this, engine, rover, { difficulty, biome })`.
- **Option C:** Random biome per run: `const biome = BIOME_IDS[Math.floor(random() * BIOME_IDS.length)]` in PlanetScene before calling generatePlanet.

Implement Option A first; add Option B or C when you add UI for it.

---

## 8. Files to touch (summary)

| Area | Files |
|------|--------|
| Biome config | New [biomeConfig.ts](src/config/biomeConfig.ts) or [gameConfig.ts](src/config/gameConfig.ts); [difficulty.ts](src/config/difficulty.ts) for new density multipliers |
| Hazard kinds and state | [GameState.ts](src/state/GameState.ts) (HazardKind, emptyHazards) |
| New hazards | [Hazards.ts](src/hazards/Hazards.ts) (AcidPool, IcePatch, SandstormZone; optional QuakeZone) |
| Rover damage/resist | [Rover.ts](src/entities/Rover.ts) (takeDamage signature), [RoverStats.ts](src/upgrades/RoverStats.ts), [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) (optional) |
| Generation | [PlanetGenerator.ts](src/world/PlanetGenerator.ts) (options.biome, config-driven hazard counts and spawns) |
| Tiles | [Tile.ts](src/world/Tile.ts) (optional new TileKinds and colors) |
| Call site | [PlanetScene.ts](src/scenes/PlanetScene.ts) (pass biome in generatePlanet options when ready) |

---

## 9. Suggested implementation order

1. Add `BiomeId` and `BIOME_CONFIGS` for one biome (e.g. volcanic) with current hazards only; extend `GeneratePlanetOptions` and use config in PlanetGenerator without adding new hazard classes.
2. Add one new hazard (e.g. IcePatch) and `ice` to HazardKind; add ice biome config and spawn IcePatch in generator when biome is ice.
3. Add AcidPool and toxic biome; add SandstormZone and desert if desired.
4. Add rover resists and equipment defs for new hazards; then add biome selection to UI or random.
