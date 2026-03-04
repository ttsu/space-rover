---
name: Hostile aliens
overview: Add hostile alien actors that move, deal damage (contact or projectile), and can be damaged by the blaster; extend HazardKind for run stats, add aggro and behavior patterns, and spawn aliens in PlanetGenerator (optionally per biome).
todos:
  - id: alien-hazard-kind
    content: Add alien HazardKind(s) to GameState and record hits when rover takes damage from aliens
    status: pending
  - id: alien-base-actor
    content: Create Alien base actor (HP, takeBlasterDamage, collision); optional projectile for ranged type
    status: pending
  - id: alien-behaviors
    content: Implement at least one behavior (contact-only; then aggro-on-proximity chase or ranged)
    status: pending
  - id: alien-spawn-gen
    content: Spawn aliens in PlanetGenerator (density, avoid base); optional per-biome alien set
    status: pending
  - id: alien-blaster-integration
    content: Ensure BlasterProjectile hits aliens (IBlasterTarget); handle AoE if applicable
    status: pending
isProject: true
---

# Hostile aliens — implementation plan

This plan adds hostile alien entities to the planet run: they are actors that can move, deal damage to the rover (on contact or via projectiles), and be destroyed by the blaster. Current code: [BlasterProjectile](src/entities/BlasterProjectile.ts) uses `IBlasterTarget.takeBlasterDamage`; [ResourceDeposit](src/entities/ResourceDeposit.ts) implements it. [Rover](src/entities/Rover.ts) has `takeDamage(amount, fromLava)`, `onDamaged` callback, and collision. [PlanetGenerator](src/world/PlanetGenerator.ts) places hazards with `placeHazard`; [GameState](src/state/GameState.ts) has `HazardKind` and `recordHazardHit`.

---

## 1. HazardKind and run stats for aliens

**File: [src/state/GameState.ts](src/state/GameState.ts)**

- Extend `HazardKind` with one or more alien types, e.g. `"alienDrone"` or a generic `"alien"`. If you want per-type stats later, add `"alienDrone" | "alienSpitter" | ...`.
- Add the new kind(s) to `emptyHazards` with value 0.
- When the rover takes damage from an alien (contact or projectile), call `recordHazardHit("alien")` (or the specific kind). So: the code path that applies damage to the rover (in the alien’s collision handler or in a projectile’s hit handler) must call `recordHazardHit` in addition to `rover.takeDamage(...)`.

No change to `RunStats` or `finishRun`; they already use `Record<HazardKind, number>`.

---

## 2. Alien base actor and IBlasterTarget

**New file: [src/entities/Aliens.ts](src/entities/Aliens.ts)** (or under `src/aliens/`)

- **Base class (e.g. `AlienBase`):** Extends Excalibur `Actor`, implements `IBlasterTarget`.
  - **Props:** `x, y, width, height, hp, contactDamage, rover, hazardKind: HazardKind`. Store `rover` and `hazardKind` for damage and stats.
  - **Collision:** `CollisionType.Active` so it collides with rover and projectiles. In `on("collisionstart")`, if `evt.other.owner === rover`, call `rover.takeDamage(contactDamage)` and `recordHazardHit(hazardKind)`.
  - **takeBlasterDamage(amount: number):** Subtract from HP; if HP <= 0, call `this.kill()` and optionally spawn death particles or drop. No need to call `recordHazardHit` for “alien was hit”; only call it when the rover is hit by the alien.
  - **Body:** Use a simple shape (e.g. box) and ensure collision group allows contact with rover and with blaster projectiles (default Excalibur should allow both).
- **Ranged alien (optional):** A subclass or separate class that, in addition to contact damage, periodically spawns a **projectile** aimed at the rover. The projectile is an Actor that moves each frame toward last-known rover position (or predicted); on collision with rover, call `rover.takeDamage(projectileDamage)` and `recordHazardHit(hazardKind)`, then kill projectile. Projectile should not be an `IBlasterTarget` (or it would be hit by blaster); use a different tag or name so blaster ignores it, or let blaster destroy enemy projectiles if you want.

---

## 3. Movement and aggro behavior

**Aggro:** Store “aggro radius” (pixels or tiles). Each frame in `onPreUpdate`:

- If rover is not in aggro radius: idle or patrol (e.g. move along a short path or stand still).
- If rover is inside aggro radius: set “target” to rover position and move toward it (or aim and shoot for ranged).

**Movement:** Use `this.pos = this.pos.add(velocity)` or `this.vel = ...` and let the engine integrate, or move manually. Chase: `direction = rover.pos.clone().sub(this.pos).normalize()`, then add `direction.scale(speed * dt)` to position. Clamp to map bounds if needed.

**Optional: radar/jammer:** If [RoverStats](src/upgrades/RoverStats.ts) has `alienAggroRadiusModifier`, multiply the alien’s aggro radius by that value when checking distance (so “jammer” reduces how close the rover must be to aggro).

**Optional: fog:** If fog of war is on, only update alien AI (and optionally only set `graphics.visible`) when the alien is in visible range; when out of range, aliens can be paused or still run AI but stay hidden.

---

## 4. At least one concrete alien type

**Drone (contact-only):**

- Low HP (e.g. 2), contact damage 1, slow move speed. Aggro radius e.g. 150 px. When in aggro, chase rover; on contact, rover takes damage and record hazard. Simple state: `idle | chasing`; in chasing, move toward `rover.pos` each frame.

**Spitter (ranged):** 

- Medium HP, no or low contact damage. Aggro radius 200. Every N ms (e.g. 1500), if rover in aggro, spawn a projectile from alien position toward rover; projectile moves in a straight line, deals 1 damage on rover hit. Projectile actor: small, Passive or Active collision, on collision with rover call `rover.takeDamage(1)` and `recordHazardHit("alienSpitter")`, then kill self.

Implement Drone first; add Spitter once Drone works.

---

## 5. Spawning aliens in PlanetGenerator

**File: [src/world/PlanetGenerator.ts](src/world/PlanetGenerator.ts)**

- **Density:** Add to biome config (or global config) an `alienDensity: number` (e.g. 0.02). Count = `totalTiles * alienDensity * difficultyMultiplier`. Use a single multiplier in [difficulty.ts](src/config/difficulty.ts) (e.g. `alienDensity: 1`) and scale for easy/hard.
- **Placement:** Reuse `placeHazard` (or a similar `placeAliens` that also avoids base vicinity and optionally avoids overlapping). For each placed tile, create one alien at tile center (pixel pos = grid * TILE_SIZE + TILE_SIZE/2).
- **Which alien:** Either always spawn Drone, or pass alien type from biome (e.g. `biomeConfig.alienTypes?: AlienTypeId[]` and pick random from list). Add the created alien to `actors` and `scene.add(alien)`.

**File: [src/config/gameConfig.ts](src/config/gameConfig.ts) or biome config**

- `ALIEN_DENSITY = 0.02` (or per-biome). Drone aggro radius, speed, HP, contact damage as constants or in alien def.

---

## 6. Blaster and AoE

**BlasterProjectile:** Already checks `other.owner` for `takeBlasterDamage`. Ensure alien actor is the **owner** of its body (default in Excalibur). So long as Alien implements `IBlasterTarget`, projectiles will call `takeBlasterDamage` on collision and the projectile will kill itself. No change to [BlasterProjectile.ts](src/entities/BlasterProjectile.ts) unless you need to exclude certain actors (e.g. rover); rover is not an IBlasterTarget, so no change.

**AoE blaster:** If `roverStats.blasterBehavior === 1`, existing AoE might spawn an explosion that damages only deposits. Extend the AoE effect so the same explosion damages actors implementing `IBlasterTarget` within radius (e.g. in the explosion handler, query scene for actors in radius and call `takeBlasterDamage` on each). That way aliens in the blast are hit.

---

## 7. PlanetScene and rover reference

**File: [src/scenes/PlanetScene.ts](src/scenes/PlanetScene.ts)**

- No change to scene init; aliens are created inside `generatePlanet` and added to the scene. Rover is already passed into `generatePlanet`, so each alien holds a reference to the same rover. When the scene is deactivated and actors are killed, aliens are in `worldActors` and get killed in `onActivate` when you clear world actors. Ensure alien list is part of `planet.actors` so they are tracked and killed on new run.

---

## 8. Optional: alien projectile and collision

If you add a “spitter” that shoots at the rover:

- **Class:** `AlienProjectile extends Actor` with position, velocity, damage, rover ref, hazardKind. In `onPreUpdate`, move by velocity; in `on("collisionstart")`, if other.owner === rover, call `rover.takeDamage(damage)`, `recordHazardHit(hazardKind)`, then `this.kill()`. Add to scene when spitter fires.
- **Collision:** Use Passive or Active; ensure it collides with rover. Don’t implement `IBlasterTarget` on it unless you want blaster to destroy enemy projectiles (then do implement it and in `takeBlasterDamage` just `this.kill()`).

---

## 9. Files to touch (summary)


| Area         | Files                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hazard kinds | [GameState.ts](src/state/GameState.ts) (HazardKind, emptyHazards)                                                                                                                                                      |
| Alien actors | New [Aliens.ts](src/entities/Aliens.ts) or [aliens/](src/aliens/) (AlienBase, Drone, optional Spitter and AlienProjectile)                                                                                             |
| Blaster      | [BlasterProjectile.ts](src/entities/BlasterProjectile.ts) (no change if alien is IBlasterTarget); AoE logic in PlanetScene or projectile if you extend AoE to damage aliens                                            |
| Generation   | [PlanetGenerator.ts](src/world/PlanetGenerator.ts) (alien density, placeAliens, create Drone/Spitter), [gameConfig.ts](src/config/gameConfig.ts) or [biomeConfig.ts](src/config/biomeConfig.ts) (alien density / type) |
| Difficulty   | [difficulty.ts](src/config/difficulty.ts) (alienDensity multiplier)                                                                                                                                                    |


---

## 10. Suggested implementation order

1. Add `"alien"` (or `"alienDrone"`) to HazardKind and emptyHazards.
2. Implement AlienBase and Drone in Aliens.ts: HP, takeBlasterDamage, contact damage, recordHazardHit when rover is hit. No movement yet.
3. Add Drone to PlanetGenerator with a fixed count (e.g. 5), place with placeHazard-style logic. Test: blaster kills drone, touching drone damages rover and records hazard.
4. Add chase AI: aggro radius, move toward rover each frame when in range.
5. Optional: add Spitter and AlienProjectile; add alien density to config and difficulty; optionally tie alien type to biome.

