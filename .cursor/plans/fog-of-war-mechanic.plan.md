---
name: Fog-of-war mechanic
overview: Add fog-of-war so only the area near the rover is visible; visibility distance is a rover stat driven by the radar slot. Optionally persist "explored" tiles so previously seen area stays visible but dimmed.
todos:
  - id: fog-stats-config
    content: Add visibilityRadius to RoverStats and gameConfig; base value in tiles or pixels
    status: pending
  - id: fog-visibility-logic
    content: "Visibility: each frame compute which actors/tiles are within visibilityRadius of rover"
    status: pending
  - id: fog-rendering
    content: Hide or dim tiles and hazard actors outside visible range; optional explored layer
    status: pending
  - id: fog-explored
    content: "Optional: track explored set (tile keys); show explored tiles dimmed when out of range"
    status: pending
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
- **Hidden (fog)**: Anything beyond that radius is either not drawn or drawn with a strong darken/mask so the player cannot see hazards or resources there.
- **Optional – explored**: Once a tile has been within visibility range, it can be marked "explored". When the rover moves away, explored tiles can be shown **dimmed** (e.g. dark overlay) so the player sees "I’ve been there" but not live detail (e.g. moving hazards). Explored state is per-run only (reset on new mission) unless you later add persistent exploration.

---

## 2. Rover stat and config

- **RoverStats** ([src/upgrades/RoverStats.ts](src/upgrades/RoverStats.ts)): Add `visibilityRadius: number`.
- **gameConfig** ([src/config/gameConfig.ts](src/config/gameConfig.ts)): Add e.g. `ROVER_BASE_VISIBILITY_RADIUS` (in tiles or pixels). Prefer **tiles** so logic is grid-aligned (e.g. base = 5 tiles).
- **Rover**: Read `visibilityRadius` from `roverStats`; no need to store it on the rover if stats are already passed in.
- **Radar equipment** (from rover configuration plan): Radar slot items increase `visibilityRadius` (e.g. +1 or +2 tiles per level). Stats computation in that plan should include this effect.

---

## 3. Visibility logic

- **Distance**: For each tile/actor, compute distance from rover (e.g. `rover.pos` to tile center). Use tile-based distance (e.g. Chebyshev or Euclidean in tile space) so radius is in tiles: e.g. `visibilityRadius = 5` → all tiles with `max(|dx|,|dy|) <= 5` in tile coords are visible.
- **Which entities to drive**:  
  - **Tiles**: [PlanetGenerator](src/world/PlanetGenerator.ts) adds [Tile](src/world/Tile.ts) actors to the scene. Each tile has a known grid position, so you can compute tile-rover distance.  
  - **Other actors**: Base, resource nodes/deposits, lava, rocks, wind, lightning. Either store grid position on each or use world `pos` and convert to tile coords (divide by `TILE_SIZE`).
- **Update point**: In [PlanetScene](src/scenes/PlanetScene.ts) `onPreUpdate` (or post physics), each frame: get rover position and `rover.roverStats.visibilityRadius`, then set visibility (or opacity) for each tile and relevant actor. Prefer a single "visibility system" helper that takes rover position, radius, and list of entities and sets `graphics.visible` (and optionally opacity for explored).

---

## 4. Rendering options

- **Option A – Toggle visibility**: Set `actor.graphics.visible = inRange` (and optionally `inRange || explored` with dimmed graphics when only explored). Simple; no extra draw calls for hidden actors.
- **Option B – Fog overlay**: Draw the whole map; overlay a mask (e.g. dark shape or tile-based overlay) that hides or darkens areas outside the visible circle. Requires an overlay actor or post-process; more work but can look nicer (soft edges, etc.).
- **Option C – Hybrid**: Tiles/actors outside radius are hidden; a separate "fog" layer (e.g. a grid of small dark quads) covers the non-visible area so the map doesn’t look like holes. Recommened starting with **Option A**; add overlay later if desired.

---

## 5. Explored (optional)

- **Data**: Per run, maintain a `Set<string>` of explored tile keys, e.g. `"gx,gy"`. When a tile enters the visible radius, add its key to the set. Reset the set in `resetRunTracking` or when starting a new mission.
- **Rendering**: For tiles (and optionally other actors):
  - In range → visible, full opacity.
  - Out of range but explored → visible, dimmed (e.g. opacity 0.4 or darker color).
  - Out of range and not explored → not visible (or full fog).
- **Hazards/resources**: Either treat them like tiles (hide when out of range, dim when explored) or always hide when out of range (no explored state for entities) to avoid revealing hazard positions. Recommend: only tiles use "explored"; hazards and resources are strictly visibility-radius based so the player must re-approach to see current state.

---

## 6. Files to touch


| Area           | Files                                                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config / stats | [gameConfig.ts](src/config/gameConfig.ts) (base visibility radius), [RoverStats.ts](src/upgrades/RoverStats.ts) (visibilityRadius in interface and BASE_STATS), [Rover.ts](src/entities/Rover.ts) (no change if stats already used) |
| Visibility     | New helper e.g. `src/world/FogOfWar.ts` or logic in PlanetScene: distance checks, set `graphics.visible` (and opacity) on tiles and scene actors                                                                                    |
| Scene / run    | [PlanetScene.ts](src/scenes/PlanetScene.ts) (call visibility update each frame; pass rover and radius; optionally init/clear explored set on run start/end)                                                                         |
| Tiles / actors | [Tile.ts](src/world/Tile.ts) (ensure tiles have stable grid coords or store them; optional opacity), hazard/entity actors need a way to get grid or world position for distance                                                     |


---

## 7. Integration with Rover Configuration plan

- **Radar slot**: When implementing the Configure Rover feature, radar equipment defs should apply an effect like `{ kind: "visibilityRadius", value: 1 }` (or similar). Add `visibilityRadius` to the effect kind union and to `computeEffectiveRoverStats` so that equipping radar increases how far the player can see.
- **Base value**: New games with no radar equipped use `ROVER_BASE_VISIBILITY_RADIUS` from config (e.g. 4–6 tiles so the base area and a small neighbourhood are visible at start).

---

## 8. Implementation order

1. Add `visibilityRadius` to config and RoverStats; ensure rover has access to it in PlanetScene.
2. Implement visibility logic: distance from rover (in tiles), toggle `graphics.visible` for tiles and key actors each frame in PlanetScene.
3. Test with a small base radius; tune base value for feel.
4. (Optional) Add explored set and dimmed rendering for explored tiles.
5. When adding radar equipment (rover config plan), add the effect and wire it into stats so radar upgrades increase visibility radius.

