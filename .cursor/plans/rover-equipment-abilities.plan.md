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
    content: Optional: add 7th slot "utility" in roverConfig and default equipped; update ConfigureRoverScene
    status: pending
isProject: true
---

# Rover equipment upgrades and abilities — implementation plan

This plan extends the existing equipment system ([UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts), [RoverStats.ts](src/upgrades/RoverStats.ts), [roverConfig.ts](src/types/roverConfig.ts)) with new effect kinds, new equipment defs, and optionally key-triggered abilities or a 7th slot. Each phase can be done incrementally.

---

## 1. New effect kinds and RoverStats

**File: [src/upgrades/RoverStats.ts](src/upgrades/RoverStats.ts)**

- Add to `RoverStats` interface (and `BASE_STATS`):
  - `reverseSpeedMultiplier?: number` — e.g. 1 = default (half of forward), 1.5 = 75% of forward.
  - `burstSpeedBonus?: number` and `burstCooldownMs?: number` — temporary speed boost on key, then cooldown (optional; can be ability-only).
  - `stunResist?: number` — 0–1; reduces duration of stun/disable from aliens (for future alien plan).
  - `alienAggroRadiusModifier?: number` — multiplier on alien aggro range (e.g. 0.8 = 80%; jammer).
  - `threatPingIntervalMs?: number` — 0 = off; if &gt; 0, radar “pings” hostile positions every N ms (for fog/alien plan).
  - `resourceHighlight?: number` — 0 = off, 1 = highlight uncollected resources in visibility (optional).
- Add to `UpgradeEffectKind` in [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts): `"reverseSpeedMultiplier"`, `"burstSpeedBonus"`, `"burstCooldownMs"`, `"stunResist"`, `"alienAggroRadiusModifier"`, `"threatPingIntervalMs"`, `"resourceHighlight"` (only the ones you implement).
- In `applyEffect`, add a `case` for each new kind that sets the corresponding stat (additive where it makes sense; `blasterBehavior`-style override for single-value things like `reverseSpeedMultiplier`).

**File: [src/config/gameConfig.ts](src/config/gameConfig.ts)**

- Add any base constants if needed (e.g. `ROVER_BASE_REVERSE_MULTIPLIER = 0.5`). Otherwise base values can live in `BASE_STATS` as 0 or a default.

**Implementation order:** Add one effect at a time (e.g. first `reverseSpeedMultiplier` and one equipment def that uses it), then add more.

---

## 2. Rover behavior that uses new stats

**File: [src/entities/Rover.ts](src/entities/Rover.ts)**

- **Reverse speed:** Currently `maxReverseSpeed = -s.maxSpeed * 0.5`. Change to use `roverStats.reverseSpeedMultiplier` if present (e.g. `maxReverseSpeed = -s.maxSpeed * (s.reverseSpeedMultiplier ?? 0.5)`).
- **Burst speed (optional ability):** If you add `burstSpeedBonus` and `burstCooldownMs`:
  - Add private state: `private burstActiveUntil = 0`, `private burstCooldownUntil = 0`.
  - In `onPreUpdate`, if a “burst” key is held and `burstCooldownUntil <= now` and `burstActiveUntil <= now`, set `burstActiveUntil = now + BURST_DURATION_MS` and `burstCooldownUntil = now + roverStats.burstCooldownMs`.
  - When computing effective max speed for movement, if `now < burstActiveUntil`, add `roverStats.burstSpeedBonus` to the cap. Optionally increase battery drain during burst.
- **Stun (for aliens):** When aliens are added, they may set a “stunned until” time on the rover. In `onPreUpdate`, if stunned, skip movement and apply `stunResist` to reduce the stun duration (e.g. `stunRemaining *= (1 - roverStats.stunResist)`). Stun can be a simple `rover.stunnedUntil = engine.clock.now() + duration`.

No changes to blaster firing here; that stays in Rover and uses existing `blasterDamage`, `blasterFireRate`, `blasterRange`, `blasterBehavior`.

---

## 3. Seeking blaster (blasterBehavior === 2)

**Current:** [BlasterProjectile](src/entities/BlasterProjectile.ts) moves in a fixed direction. [Rover](src/entities/Rover.ts) passes `roverStats.blasterDamage`, `blasterFireRate`, `blasterRange` to `onFireBlaster`; projectile is created with angle from rover facing.

**Change:**

- **Option A (simple):** Add a second projectile class `SeekingBlasterProjectile` that in `onPreUpdate` adjusts `this.direction` toward the nearest actor implementing `IBlasterTarget` (or a dedicated “enemy” tag) within a small FOV. PlanetScene checks `rover.roverStats.blasterBehavior === 2` and spawns `SeekingBlasterProjectile` instead of `BlasterProjectile`.
- **Option B:** Single `BlasterProjectile` class that accepts an optional `target: Actor | null`. When `target` is set and not killed, each frame nudge direction toward target; when target is null, behave as now. PlanetScene passes `null` for default blaster and the nearest valid target when behavior is seeking.

**Files:** [BlasterProjectile.ts](src/entities/BlasterProjectile.ts) (or new seeking variant), [PlanetScene.ts](src/scenes/PlanetScene.ts) (spawn logic based on `blasterBehavior`). Seeking should only lock onto enemies (or IBlasterTarget that are not the rover); ResourceDeposit can remain valid target for mining. So: either tag “enemy” and seek only enemies, or pass explicit target from scene.

---

## 4. New equipment defs in UpgradeDefs.ts

**File: [src/upgrades/UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts)**

Add defs for the chosen abilities (example set; tune costs and values to balance):

- **Engine:** Reverse Thrust — `reverseSpeedMultiplier`, value 0.25 (e.g. 2 levels: 0.5 → 0.75). Cost e.g. iron + gas.
- **Engine:** Afterburner — `burstSpeedBonus` 40, `burstCooldownMs` 5000; two defs or one def with two effects. If one effect per def, add a second effect kind (e.g. `burstDurationMs`) or handle “ability” in code and only add cooldown as stat.
- **Shielding:** Ablative Plating — requires new mechanic “first hit per zone does 0 damage” (state on rover or per-hazard; could be a simple “ignore next 1 damage” once per 30s). Alternatively implement as `flatDamageReduction` that only applies once per encounter (more complex). Skip if out of scope; otherwise add effect kind like `ablativeCharges` and consume in `takeDamage`.
- **Radar:** Threat Ping — `threatPingIntervalMs` 3000 (pings every 3s). Only works when fog/aliens exist.
- **Radar:** Resource Scanner — `resourceHighlight` 1. Rendering: in PlanetScene or Hud, when `roverStats.resourceHighlight > 0`, draw a subtle outline or icon on resource actors within visibility (same list used for fog).
- **Blaster:** Seeking Lens — `blasterBehavior` 2. One level; replaces current blaster behavior when equipped.

Add each to the appropriate array (`IRON_UPGRADES`, `CRYSTAL_UPGRADES`, `GAS_UPGRADES`) and ensure `ALL_UPGRADES` includes them. No change to catalog or level-up flow; they appear like existing defs.

---

## 5. Emergency battery / one-off ability (optional)

If you want “once per run” abilities (e.g. emergency battery, flare):

- **Data:** Add to run state (e.g. in PlanetScene or a small RunAbilities module) a record of consumed one-offs: `emergencyBatteryUsed: boolean`, `flareUsed: boolean`. Reset in `onActivate` when starting a mission.
- **Rover:** Expose a method e.g. `useEmergencyBattery()` that, if not used this run and battery &gt; 0, sets `battery = roverStats.maxBattery * 0.2` and marks used. Call from PlanetScene when a key is pressed and rover has the relevant equipment (e.g. check equipped battery slot for a def with id `emergency-battery` or an effect flag).
- **UI:** Hud or info label: “Press [Key] for emergency battery (once per run).”

This does not require a new slot if you tie the ability to an existing battery def (e.g. “Emergency Reserve” as an alternative battery that has the same slot but a one-off effect).

---

## 6. Optional 7th slot: Utility

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

## 7. Files to touch (summary)

| Area | Files |
|------|--------|
| Effect kinds and stats | [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) (UpgradeEffectKind), [RoverStats.ts](src/upgrades/RoverStats.ts) (interface, BASE_STATS, applyEffect) |
| Config | [gameConfig.ts](src/config/gameConfig.ts) (optional base constants) |
| Rover behavior | [Rover.ts](src/entities/Rover.ts) (reverse speed, optional burst/stun state and logic) |
| Blaster seeking | [BlasterProjectile.ts](src/entities/BlasterProjectile.ts) or new class, [PlanetScene.ts](src/scenes/PlanetScene.ts) (spawn by blasterBehavior) |
| New equipment | [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) (new defs in IRON/CRYSTAL/GAS arrays) |
| Optional utility slot | [roverConfig.ts](src/types/roverConfig.ts), [Progress.ts](src/state/Progress.ts), [Saves.ts](src/state/Saves.ts), [ConfigureRoverScene.ts](src/scenes/ConfigureRoverScene.ts), [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts) |
| Optional one-off abilities | PlanetScene or new RunAbilities module, Hud or labels |

---

## 8. Suggested implementation order

1. Add one new effect (e.g. `reverseSpeedMultiplier`) + RoverStats + one UpgradeDef; wire reverse speed in Rover.
2. Add seeking blaster: effect kind already exists (`blasterBehavior` 2); implement seeking in projectile and spawn logic in PlanetScene.
3. Add radar/utility defs (threat ping, resource highlight) and any config/rendering needed when fog or aliens exist.
4. If desired, add 7th slot and utility defs; then add one-off abilities (emergency battery, flare) with run-state and key handling.
