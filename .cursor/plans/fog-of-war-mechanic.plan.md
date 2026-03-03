---
name: Fog-of-war mechanic
overview: Add fog-of-war using Excalibur Systems (FogAffectedComponent, FogVisibilitySystem, FogOverlaySystem) so only the area near the rover is visible; visibility distance is a rover stat driven by the radar slot. Optionally persist "explored" tiles so previously seen area stays dimmed.
todos:
  - id: fog-stats-config
    content: Add visibilityRadius to RoverStats and gameConfig; base value in tiles or pixels
    status: completed
  - id: fog-component
    content: Add FogAffectedComponent; attach to tiles, base, hazards, resources in PlanetGenerator
    status: completed
  - id: fog-visibility-system
    content: Implement FogVisibilitySystem (SystemType.Update); query FogAffected, set graphics.isVisible/opacity
    status: completed
  - id: fog-overlay-system
    content: Implement FogOverlaySystem (SystemType.Draw) for soft-edged fog layer (Option C)
    status: completed
  - id: fog-explored
    content: "Optional: explored set in GameState; FogVisibilitySystem updates it and dims explored tiles"
    status: completed
  - id: fog-radar-equipment
    content: Radar equipment in Configure Rover plan increases visibilityRadius
    status: pending
isProject: false
---

# Fog-of-war game mechanic

This plan adds a fog-of-war mechanic to the planet run: only the area around the rover is visible. Visibility distance is controlled by a new rover stat and (in the rover configuration feature) by the **radar** equipment slot.

---

## 1. Behaviour

- **Visible**: Tiles and actors (hazards, resources, base) within **visibility radius** of the rover are drawn normally.
  - Fog hides visuals only; hazards still affect the rover. Rover blaster effects should still affect actors (eg. hit deposits) outside the visibility range, if the blaster range exceeds the visibility.
- **Hidden (fog)**: Anything beyond that radius is either not drawn or drawn with a strong darken/mask so the player cannot see hazards or resources there.
- **Explored**: Once a tile has been within visibility range, it can be marked "explored". When the rover moves away, explored tiles can be shown **dimmed** (e.g. dark overlay) so the player sees "I’ve been there" but not live detail (e.g. moving hazards). Explored state is per-run only (reset on new mission) unless you later add persistent exploration.
- Base should be always visible
- Tile must expose grid position (store gridX, gridY on Tile).

---

## 2. Rover stat and config

- **RoverStats** ([src/upgrades/RoverStats.ts](src/upgrades/RoverStats.ts)): Add `visibilityRadius: number`.
- **gameConfig** ([src/config/gameConfig.ts](src/config/gameConfig.ts)): Add e.g. `ROVER_BASE_VISIBILITY_RADIUS` (in tiles or pixels). Prefer **tiles** so logic is grid-aligned (e.g. base = 5 tiles).
- **Rover**: Read `visibilityRadius` from `roverStats`; no need to store it on the rover if stats are already passed in.
- **Radar equipment** (from rover configuration plan): Radar slot items increase `visibilityRadius` (e.g. +1 or +2 tiles per level). Stats computation in that plan should include this effect.

---

## 3. Fog as Excalibur Systems

Implement fog using Excalibur’s ECS: a **component** marks which entities are affected, and two **systems** run each frame—one to update visibility (Update phase), one to draw the fog overlay (Draw phase). This keeps fog logic out of [PlanetScene](src/scenes/PlanetScene.ts) and uses the engine lifecycle and priority.

### 3.1 FogAffectedComponent

- **New file or location**: e.g. [src/world/FogOfWar.ts](src/world/FogOfWar.ts) or `src/systems/FogOfWar.ts`.
- **Component**: Extend Excalibur `Component` with a unique type (e.g. `type = 'ex.fogAffected'`). Hold:
  - `**gridX?: number`**, `**gridY?: number`** — For tiles only; used for tile-key explored set and bounding-box culling. Omit for hazards/resources/base (derive from entity `pos` and `TILE_SIZE`).
  - `**alwaysVisible?: boolean**` — If `true`, entity is never hidden (use for base). Default `false`.
- **Who gets it**: In [PlanetGenerator](src/world/PlanetGenerator.ts), when creating each tile, base, hazard, and resource actor, call `actor.addComponent(new FogAffectedComponent({ gridX, gridY }))` (tiles and base get grid coords; base also gets `alwaysVisible: true`). Hazards and resources get the component without grid coords (system will use `pos` to derive tile position).

### 3.2 Tile grid position

- [Tile](src/world/Tile.ts) must **store** `gridX` and `gridY` on the instance (constructor already receives them; add `readonly gridX: number` and `readonly gridY: number`). When adding `FogAffectedComponent` to a tile, pass `tile.gridX`, `tile.gridY`.

### 3.3 FogVisibilitySystem (SystemType.Update)

- **Query**: `world.query([FogAffectedComponent, TransformComponent, GraphicsComponent])`.
- **Constructor / init**: Accept a reference to the **rover** entity (e.g. `constructor(world: World, rover: Entity)` or pass rover when registering the system). The system reads `rover.pos` and `rover.roverStats.visibilityRadius` (rover is an Actor with `roverStats`).
- **Priority**: Use `SystemPriority.Lower` (or similar) so visibility runs after movement.
- **update(delta)**: For each entity in the query, get `GraphicsComponent` via `entity.get(GraphicsComponent)` (and `TransformComponent` for position when needed). Then:
  - Skip if `FogAffectedComponent.alwaysVisible` is true → set `graphics.isVisible = true`, `graphics.opacity = 1`.
  - Else: compute entity’s tile position (from component `gridX`/`gridY` if present, else from `transform.pos` and `TILE_SIZE`). Compute rover tile from `rover.pos`. Use **Euclidean distance in tile space**; if distance ≤ `rover.roverStats.visibilityRadius`, entity is in range.
  - If in range: set `graphics.isVisible = true`, `graphics.opacity = 1`. If entity has grid coords, add tile key `"gx,gy"` to the explored set (in GameState).
  - If not in range: if explored (tile key in set) and entity has grid coords → visible but dimmed (`graphics.isVisible = true`, `graphics.opacity = 0.4`). Otherwise → `graphics.isVisible = false`.
- **Optimization**: For entities with grid coords, only process those in a tile-aligned bounding box around the rover (e.g. ±(R+1) in tile space) if the full list is large.

### 3.4 FogOverlaySystem (SystemType.Draw)

- **Purpose**: Implements Option C—draw a fog layer so the map doesn’t look like holes and the visible border has soft edges.
- **Query**: None (or not used). System has access to rover position, visibility radius, explored set, and map size (e.g. from GameState or config).
- **Draw**: In the draw phase, draw a full-screen or world-sized overlay (e.g. tile-aligned dark quads or a radial mask) that darkens/hides area outside the visible circle. Use Excalibur’s draw context; consider a slight blur or gradient at the visibility boundary for soft edges.

### 3.5 Rover reference and explored set

- **Rover**: When adding the system in [PlanetScene](src/scenes/PlanetScene.ts) `onInitialize` (after the rover is created), call e.g. `this.world.add(new FogVisibilitySystem(this.world, this.rover))`. Pass the rover Actor so the system can read position and stats.
- **Explored set**: Store in [GameState](src/state/GameState.ts) (e.g. `exploredTileKeys: Set<string>`). Clear it in `resetRunTracking()` so each new mission starts with an empty set. FogVisibilitySystem reads and updates this set.

### 3.6 Registering systems

- In [PlanetScene](src/scenes/PlanetScene.ts) `onInitialize`, after the rover and any other setup: `this.world.add(new FogVisibilitySystem(this.world, this.rover))` and `this.world.add(new FogOverlaySystem(this.world, this.rover))` (or equivalent; FogOverlaySystem may need map dimensions from config). Systems are added once per scene; they run every frame while the scene is active.

---

## 4. Rendering (Option C)

- **Visibility**: FogVisibilitySystem sets `graphics.isVisible` and `graphics.opacity` on all entities with FogAffectedComponent (see §3.3). Hidden actors are not drawn by the built-in GraphicsSystem.
- **Overlay**: FogOverlaySystem (SystemType.Draw) draws the fog layer with soft edges on the visibility boundary so the map doesn’t look like holes and the transition looks good.

---

## 5. Explored (optional)

- **Data**: In [GameState](src/state/GameState.ts), add `exploredTileKeys: Set<string>` (tile keys e.g. `"gx,gy"`). FogVisibilitySystem adds keys when a tile enters the visible radius. Clear the set in `resetRunTracking()` so each new mission starts fresh.
- **Rendering** (in FogVisibilitySystem): For entities with grid coords (tiles):
  - In range → visible, full opacity; add tile key to explored set.
  - Out of range but key in explored set → visible, dimmed (e.g. opacity 0.4).
  - Out of range and not explored → not visible.
- **Hazards/resources**: No explored state; strictly visibility-radius based. When out of range, `graphics.isVisible = false`. Player must re-approach to see current state.

---

## 6. Files to touch


| Area                    | Files                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Config / stats          | [gameConfig.ts](src/config/gameConfig.ts), [RoverStats.ts](src/upgrades/RoverStats.ts) (visibilityRadius; may already exist)                 |
| GameState               | [GameState.ts](src/state/GameState.ts) (exploredTileKeys; clear in resetRunTracking)                                                         |
| Fog component & systems | New [src/world/FogOfWar.ts](src/world/FogOfWar.ts) or `src/systems/FogOfWar.ts`: FogAffectedComponent, FogVisibilitySystem, FogOverlaySystem |
| Scene                   | [PlanetScene.ts](src/scenes/PlanetScene.ts) (register FogVisibilitySystem and FogOverlaySystem in onInitialize with rover ref)               |
| Tiles                   | [Tile.ts](src/world/Tile.ts) (store gridX, gridY on instance)                                                                                |
| Generation              | [PlanetGenerator.ts](src/world/PlanetGenerator.ts) (add FogAffectedComponent to every tile, base, hazard, resource when created)             |


---

## 7. Integration with Rover Configuration plan

- **Radar slot**: When implementing the Configure Rover feature, radar equipment defs should apply an effect like `{ kind: "visibilityRadius", value: 1 }` (or similar). Add `visibilityRadius` to the effect kind union and to `computeEffectiveRoverStats` so that equipping radar increases how far the player can see.
- **Base value**: New games with no radar equipped use `ROVER_BASE_VISIBILITY_RADIUS` from config (e.g. 4–6 tiles so the base area and a small neighbourhood are visible at start).

---

## 8. Implementation order

1. Add `visibilityRadius` to config and RoverStats if not already present; ensure rover exposes it via `roverStats`.
2. Add `gridX` and `gridY` to [Tile](src/world/Tile.ts) (store in constructor).
3. Define **FogAffectedComponent** and add it to every tile, base, hazard, and resource in [PlanetGenerator](src/world/PlanetGenerator.ts) (base with `alwaysVisible: true`).
4. Implement **FogVisibilitySystem** (query FogAffectedComponent + Transform + Graphics; rover ref; set `graphics.isVisible` and opacity). Register it in PlanetScene `onInitialize` with `this.rover`. Test with a small base radius; tune for feel.
5. Add **exploredTileKeys** to GameState and clear it in `resetRunTracking`. Extend FogVisibilitySystem to update the set and dim explored tiles when out of range.
6. Implement **FogOverlaySystem** (SystemType.Draw) to draw the soft-edged fog layer (Option C).
7. When adding radar equipment (rover config plan), add the effect and wire it into stats so radar upgrades increase visibility radius.

