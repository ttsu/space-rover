---
name: Rover equipment and abilities
overview: Add new equipment upgrades and optional abilities (burst speed, emergency battery, threat ping, seeking blaster, etc.) by extending UpgradeEffectKind, RoverStats, UpgradeDefs, and optionally a utility slot or key-triggered abilities.
todos:
  - id: rover-eff-kinds
    content: Add new UpgradeEffectKind and RoverStats fields; implement applyEffect cases in RoverStats.ts
    status: pending
  - id: rover-equipment-defs
    content: Add new UpgradeDef entries (cost, effect, slotType) in UpgradeDefs.ts for each new item
    status: pending
  - id: rover-ability-input
    content: Wire key-triggered abilities (burst, emergency battery, flare) in Rover.ts and PlanetScene if adding active abilities
    status: pending
  - id: rover-utility-slot
    content: "Optional: add 7th slot \"utility\" in roverConfig and default equipped; update ConfigureRoverScene"
    status: pending
isProject: true
---

# Rover equipment upgrades and abilities — implementation plan

This plan extends the existing equipment system ([UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts), [RoverStats.ts](src/upgrades/RoverStats.ts), [roverConfig.ts](src/types/roverConfig.ts)) with new effect kinds, new equipment defs, and optionally key-triggered abilities or a 7th slot. Each phase can be done incrementally.

---

## 1. Rover stats and effect kinds — single reference table

Use this table as the single source of truth when adding, removing, or changing a stat or effect. Each row is one **RoverStats** field and its corresponding **UpgradeEffectKind**. When you add a row here, add the same to the code (see §1.1 below); when you remove a row, remove from all three places (kind, interface+BASE_STATS, applyEffect).


| Stat (RoverStats)        | Effect kind (UpgradeEffectKind) | Status   | Base / default | Apply    | Notes                                                      |
| ------------------------ | ------------------------------- | -------- | -------------- | -------- | ---------------------------------------------------------- |
| maxHealth                | maxHealth                       | Existing | 5 (gameConfig) | Additive | Hull; base from ROVER_BASE_HEALTH                          |
| maxSpeed                 | maxSpeed                        | Existing | 50             | Additive | Base from ROVER_BASE_SPEED                                 |
| turnSpeed                | turnSpeed                       | Existing | π/2            | Additive | Base from ROVER_BASE_TURN_SPEED                            |
| acceleration             | acceleration                    | Existing | 100            | Additive | Base from ROVER_BASE_ACCELERATION                          |
| blasterDamage            | blasterDamage                   | Existing | 1              | Additive | Base from BLASTER_BASE_DAMAGE                              |
| blasterFireRate          | blasterFireRate                 | Existing | 2.5            | Additive | Shots/s; base from BLASTER_BASE_FIRE_RATE                  |
| blasterRange             | blasterRange                    | Existing | 150            | Additive | Base from BLASTER_BASE_RANGE                               |
| lavaDamageReduction      | lavaDamageReduction             | Existing | 0              | Additive | Flat reduction vs lava                                     |
| lavaSlowResist           | lavaSlowResist                  | Existing | 0              | Additive | 0–1; % less slow in lava                                   |
| windResist               | windResist                      | Existing | 0              | Additive | 0–1; % less push from wind                                 |
| flatDamageReduction      | flatDamageReduction             | Existing | 0              | Additive | Flat reduction vs all hazards                              |
| lightningWarningTime     | lightningWarningTime            | Existing | 0              | Additive | ms earlier warning                                         |
| lightningDamageReduction | lightningDamageReduction        | Proposed | 0              | Additive | Flat reduction vs lightning                                |
| visibilityRadius         | visibilityRadius                | Existing | 7              | Additive | Tiles; base from gameConfig                                |
| maxBattery               | maxBattery                      | Existing | 30             | Additive | Seconds; base from ROVER_BASE_BATTERY                      |
| batteryDrainPerSecond    | batteryDrainPerSecond           | Existing | 1              | Additive | Base from ROVER_BASE_BATTERY_DRAIN                         |
| blasterBehavior          | blasterBehavior                 | Existing | 0              | Override | 0=default, 1=AoE, 2=seeking, 3=spread 4=stream             |
| magnetism                | magnetism                       | Proposed | 0              | Additive | The distance at which resources are attracted to the rover |


**How to maintain:** Add/remove one row per stat. Keep **Stat** and **Effect kind** in sync (same camelCase name unless you have a reason to differ). **Apply** determines `applyEffect`: additive → `stats.x += value`; override → `stats.x = value`.

---

### 1.1 Implementation so developers can tweak easily

Use a **single registry** so adding/removing a stat is a one-place change plus a small, mechanical step:

1. **Add a registry in [RoverStats.ts](src/upgrades/RoverStats.ts)** (or a tiny `UpgradeEffectRegistry.ts`):
  - Define an array of effect descriptors, one object per stat, e.g.:

```ts
   // Pseudo-structure — one place to list all effects
   const EFFECT_KINDS = [
     { kind: "maxHealth", default: ROVER_BASE_HEALTH, apply: "additive" as const },
     { kind: "maxSpeed", default: ROVER_BASE_SPEED, apply: "additive" as const },
     // ...
     { kind: "blasterBehavior", default: 0, apply: "override" as const },
     { kind: "lightningDamageReduction", default: 0, apply: "additive" as const },
     { kind: "magnetism", default: 0, apply: "additive" as const },
   ] as const;
```

- Derive `UpgradeEffectKind` from this list (e.g. `EFFECT_KINDS[number]["kind"]`) so the union type stays in sync.
- Keep `RoverStats` and `BASE_STATS` as explicit interfaces/objects (they’re the contract for the rest of the game), but when adding a stat: (1) add one entry to the registry, (2) add the field to `RoverStats` and `BASE_STATS`, (3) add one `case` in `applyEffect` (or implement applyEffect via a map keyed by kind using the registry’s `apply` field).

1. **Alternative (minimal change):** No registry; keep current code. Then the **plan table above** is the checklist: when adding a stat, (1) add a row to the table, (2) add to `UpgradeEffectKind`, (3) add to `RoverStats` and `BASE_STATS`, (4) add a `case` in `applyEffect`. Same for remove/update.

Recommendation: start with the **checklist approach** (table + four steps). If the number of effects grows, introduce the registry and optionally data-drive `applyEffect` from it so new stats require only a registry entry and a `RoverStats`/BASE_STATS field.

---

## 2. New effect kinds and RoverStats (detailed)

See the **table in §1** for the full list of existing and proposed stats; below is the detailed checklist for implementing the *proposed* ones.

**File: [src/upgrades/RoverStats.ts](src/upgrades/RoverStats.ts)**

- Add to `RoverStats` interface (and `BASE_STATS`) — for each *proposed* row in the table:
  - `lightningDamageReduction?: number` — flat reduction vs lightning damage (additive with `flatDamageReduction` when from lightning).
  - `magnetism?: number` — distance (pixels or tiles) at which resources are attracted to the rover.
- Add to `UpgradeEffectKind` in [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts): `"lightningDamageReduction"`, `"magnetism"`.
- In `applyEffect` (or `EFFECT_REGISTRY`), add an entry for each new kind; both are additive with default 0.

**File: [src/config/gameConfig.ts](src/config/gameConfig.ts)**

- Base values live in `BASE_STATS` as 0; no new constants needed unless you want named defaults.

---

## 3. Rover behavior that uses new stats

**File: [src/entities/Rover.ts](src/entities/Rover.ts)**

- **Lightning damage reduction:** In `takeDamage`, when damage is from lightning (add a damage type parameter - heat/lightning), apply `roverStats.lightningDamageReduction` before subtracting health (same pattern as `flatDamageReduction` and lava). LightningZone or the hazard that deals lightning damage must pass this flag.
- **Magnetism:** When `roverStats.magnetism > 0`, resources (ResourceNode) within that distance are attracted toward the rover each frame. Implement in PlanetScene `onPreUpdate` or in a system that iterates resource nodes: if distance to rover < magnetism, add velocity toward rover. Alternatively, ResourceNode checks distance to rover and moves itself when in range.

No changes to blaster firing here; that stays in Rover and uses existing `blasterDamage`, `blasterFireRate`, `blasterRange`, `blasterBehavior`.

---

## 4. Seeking blaster (blasterBehavior === 2)

**Current:** [BlasterProjectile](src/entities/BlasterProjectile.ts) moves in a fixed direction. [Rover](src/entities/Rover.ts) passes `roverStats.blasterDamage`, `blasterFireRate`, `blasterRange` to `onFireBlaster`; projectile is created with angle from rover facing.

**Change:**

- **Option A (simple):** Add a second projectile class `SeekingBlasterProjectile` that in `onPreUpdate` adjusts `this.direction` toward the nearest actor implementing `IBlasterTarget` (or a dedicated “enemy” tag) within a small FOV. PlanetScene checks `rover.roverStats.blasterBehavior === 2` and spawns `SeekingBlasterProjectile` instead of `BlasterProjectile`.
- **Option B:** Single `BlasterProjectile` class that accepts an optional `target: Actor | null`. When `target` is set and not killed, each frame nudge direction toward target; when target is null, behave as now. PlanetScene passes `null` for default blaster and the nearest valid target when behavior is seeking.

**Files:** [BlasterProjectile.ts](src/entities/BlasterProjectile.ts) (or new seeking variant), [PlanetScene.ts](src/scenes/PlanetScene.ts) (spawn logic based on `blasterBehavior`). Seeking should lock onto enemies or resources (IBlasterTarget that are not the rover); ResourceDeposit can remain valid target for mining.

---

## 5. New equipment defs in UpgradeDefs.ts

**File: [src/upgrades/UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts)**

Add defs for the proposed stats (tune costs and values to balance):

- **Shielding:** Lightning Rod — `lightningDamageReduction`, value 1 (flat reduction vs lightning). Cost e.g. crystal + gas.
- **Radar (or new slot):** Resource Magnet — `magnetism`, value e.g. 50 (pixels) or 2 (tiles). Attracts resources within that distance. Cost e.g. iron + crystal.

**Existing effect kinds** (from table): Seeking Lens uses `blasterBehavior` 2; add when implementing seeking blaster (§4).

Add each to the appropriate array (`IRON_UPGRADES`, `CRYSTAL_UPGRADES`, `GAS_UPGRADES`) and ensure `ALL_UPGRADES` includes them. No change to catalog or level-up flow; they appear like existing defs.

---

## 6. Emergency battery / one-off ability (optional)

If you want “once per run” abilities (e.g. emergency battery, flare):

- **Data:** Add to run state (e.g. in PlanetScene or a small RunAbilities module) a record of consumed one-offs: `emergencyBatteryUsed: boolean`, `flareUsed: boolean`. Reset in `onActivate` when starting a mission.
- **Rover:** Expose a method e.g. `useEmergencyBattery()` that, if not used this run and battery > 0, sets `battery = roverStats.maxBattery * 0.2` and marks used. Call from PlanetScene when a key is pressed and rover has the relevant equipment (e.g. check equipped battery slot for a def with id `emergency-battery` or an effect flag).
- **UI:** Hud or info label: “Press [Key] for emergency battery (once per run).”

This does not require a new slot if you tie the ability to an existing battery def (e.g. “Emergency Reserve” as an alternative battery that has the same slot but a one-off effect).

---

## 7. Optional 7th slot: Utility

**File: [src/types/roverConfig.ts](src/types/roverConfig.ts)**

- Add `"utility"` to `SlotId` and `ALL_SLOT_IDS`.
- Add `utility: "base-utility"` (or similar) to `DEFAULT_EQUIPPED_IDS`.
- In [Progress](src/state/Progress.ts) and [Saves](src/state/Saves.ts), ensure default save and migration set `equipped.utility` and that `getEquipped()` / `setEquipped()` include utility.

**File: [src/upgrades/UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts)**

- Add base def for utility, e.g. `base-utility` with no effect or a placeholder effect; `isBase: true`.
- Add utility equipment defs: e.g. Flare (breaks lock-on / distracts missiles), Repair Kit (once per run restore 1 health), Resource Scanner (if not on radar). Each has `slotType: "utility"`.

**File: [src/scenes/ConfigureRoverScene.ts](src/scenes/ConfigureRoverScene.ts)**

- Ensure equipment section and drag-drop include the utility slot (same loop over `ALL_SLOT_IDS` already does if slot is in the type).
- Add `SLOT_COLORS` and `SLOT_LABELS` for `utility`.

**File: [src/upgrades/RoverStats.ts](src/upgrades/RoverStats.ts)**

- `ALL_SLOT_IDS` is imported from roverConfig; no change here. New effects that are “utility-only” (e.g. `flareCharges`) need a new effect kind and handling in Rover or scene.

---

## 8. Files to touch (summary)


| Area                       | Files                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effect kinds and stats     | [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) (UpgradeEffectKind), [RoverStats.ts](src/upgrades/RoverStats.ts) (interface, BASE_STATS, applyEffect)                                                                          |
| Config                     | [gameConfig.ts](src/config/gameConfig.ts) (optional base constants)                                                                                                                                                          |
| Rover behavior             | [Rover.ts](src/entities/Rover.ts) (lightning damage reduction in takeDamage), PlanetScene or ResourceNode (magnetism)                                                                                                        |
| Blaster seeking            | [BlasterProjectile.ts](src/entities/BlasterProjectile.ts) or new class, [PlanetScene.ts](src/scenes/PlanetScene.ts) (spawn by blasterBehavior)                                                                               |
| New equipment              | [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) (new defs in IRON/CRYSTAL/GAS arrays)                                                                                                                                          |
| Optional utility slot      | [roverConfig.ts](src/types/roverConfig.ts), [Progress.ts](src/state/Progress.ts), [Saves.ts](src/state/Saves.ts), [ConfigureRoverScene.ts](src/scenes/ConfigureRoverScene.ts), [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) |
| Optional one-off abilities | PlanetScene or new RunAbilities module, Hud or labels                                                                                                                                                                        |


---

## 9. Suggested implementation order

1. Add `lightningDamageReduction` and `magnetism` to RoverStats, UpgradeEffectKind, and applyEffect; wire lightning reduction in Rover `takeDamage` (with `damageType` flag from LightningZone) and magnetism in PlanetScene or ResourceNode.
2. Add equipment defs (Lightning Rod, Resource Magnet) to UpgradeDefs.
3. Add seeking blaster: effect kind already exists (`blasterBehavior` 2); implement seeking in projectile and spawn logic in PlanetScene.
4. If desired, add 7th slot and utility defs; then add one-off abilities (emergency battery, flare) with run-state and key handling.

