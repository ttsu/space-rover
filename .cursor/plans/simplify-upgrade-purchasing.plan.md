---
name: Simplify upgrade purchasing
overview: Change upgrade costs to multi-resource; remove "choose resource then 3 random" flow. Level-up (including base equipment) only in Configure Rover equipment section. Catalog shows only items not yet owned (level 0); purchasing gives first level.
todos:
  - id: cost-model
    content: "UpgradeDef: cost as Record<ResourceId, number>; migrate all defs; add base defs per slot; getUpgradeCost, canAffordCost, formatCost"
    status: completed
  - id: afford-helpers
    content: canAffordAnyEquipment(bank, ownedItems); catalog = defs where level === 0; level-up only in equipment UI
    status: completed
  - id: config-ui
    content: "Configure Rover: level-up per equipped item (including base); catalog list only level-0 items; remove resource pick + random 3"
    status: completed
  - id: progress-menu-cleanup
    content: Progress.ts check; PlanetRunMenuScene use canAffordAnyEquipment; remove UpgradeScene from main
    status: completed
isProject: false
---

# Simplify upgrade purchasing mechanic

## Current state

- **Cost**: Each upgrade has a single `resourceId` and `cost: number`. Pools are split by resource in [src/upgrades/UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts).
- **Flow**: In Configure Rover, player picks iron/crystal/gas → sees 3 random affordable options → buys one. [UpgradeScene](src/scenes/UpgradeScene.ts) uses the same flow; menu now goes to Configure Rover.
- **Purchase**: `purchaseEquipment(def)` uses `getUpgradeCost(def)` and `spendFromBank(cost)`; `addOwnedItem(def.id)` adds a level. `spendFromBank` already accepts `Partial<Record<ResourceId, number>>`.

## Target behaviour (revised)

1. **Costs**: Upgrades can have a cost over 1, 2, or 3 resource types. Tech-heavy items lean crystal, physical lean iron; “new ability” items cost more.
2. **No resource pick + random 3**: Remove choosing a resource type and the random subset.
3. **Level-up only in Configure Rover equipment section**: For each **equipped** item (including base), show current level and a “Level up” control with cost. Level is never increased via the catalog. Base equipment can be leveled the same way (see below).
4. **Catalog only for new items**: The catalog lists only items the player **does not yet own** (owned level === 0). All catalog entries represent “level 0 → buy to get level 1”. Once an item is owned (level ≥ 1), it no longer appears in the catalog; further levels are done only via “Level up” next to that item in the equipment section.
5. **Base equipment upgradeable**: Base (the default per-slot option) can also have levels. Level-up for base is done in the rover configuration screen (equipment section), not in the catalog.

---

## 1. Cost model and base equipment

- **UpgradeDef** in [src/upgrades/UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts):
  - Replace `resourceId` + `cost: number` with `**cost: Record<ResourceId, number>`** (only keys with value > 0).
- **Base equipment**: Introduce one upgrade def per slot for “base” (e.g. `base-battery`, `base-engine`, `base-control`, `base-shielding`, `base-radar`, `base-blaster`). Each has `slotType`, `cost` (for leveling), `effect` (can be no-op or small per-level bonus), `maxStack`. New game: `equipped[slot]` = that slot’s base id (e.g. `equipped.battery = "base-battery"`) and `ownedItems["base-battery"] = 1`, etc. So “Base” in the UI is actually “base-battery” at level 1; level-up in the equipment section purchases another level of that base def. Base defs are **excluded from the catalog** (player always “owns” them at level 1 by default), so they are only leveled via the equipment section.
- **getUpgradeCost(def)** returns `def.cost`. Add **formatCost(cost)** for UI.
- **Migrate** all existing defs to the new cost shape; remove resource-based pools for shop logic; use a single list (e.g. **getAllUpgradeDefs()**) and **canAffordCost(bank, cost)**.

---

## 2. Affordability and catalog vs level-up

- **canAffordCost(bank, cost)**: true iff for every resource, `bank[r] >= (cost[r] ?? 0)`.
- **Catalog**: Defs where **ownedItems[def.id] === 0** (or undefined) **and** def is not a base def (base defs never in catalog). So catalog = “new items only”; each row is “buy to get level 1”.
- **Level-up (equipment section only)**: For the **equipped** item in each slot (including base defs), show level and “Level up” if `level < maxStack` and `canAffordCost(bank, def.cost)`. One purchase = one level via existing `purchaseEquipment(def)`. Level is never upgraded from the catalog.
- **canAffordAnyEquipment(bank, ownedItems)**: True if any def that is either (a) in catalog (level 0, not base) and affordable, or (b) equipped and level < maxStack and affordable. Use in [PlanetRunMenuScene](src/scenes/PlanetRunMenuScene.ts) for Configure button highlight.

---

## 3. Configure Rover UI

- **Remove**: Resource-type buttons, `shopChosenResource`, `shopOptions`, “pick one of 3 random” subview. Remove `get3RandomAffordableByOwned` and `canAffordAnyUpgradeByOwned` from this scene.
- **Equipment section (level-up here only)**:
  - For each slot, show equipped item (base def name as “Base” or the def’s name), **current level** (from `ownedItems[equipped[slotId]]`), and if `level < maxStack` a “Level up” control with **formatCost(def.cost)**. On click: `purchaseEquipment(def)` then refresh. This applies to both base defs and non-base defs. Base equipment is leveled only here.
- **Catalog (“Buy new equipment”)**:
  - List only defs where **ownedItems[def.id] === 0** and def is **not** a base def. Each row: name, description, cost (formatCost), [Purchase] (enabled when canAffordCost). Purchasing adds first level (level 1); item then disappears from catalog and can only be leveled in the equipment section.
- **Defaults**: New save: `equipped[slot]` = base def id for that slot; `ownedItems[base-*]` = 1 for each base def. So “Base” is always at least level 1 and never in the catalog.

---

## 4. Progress and defaults

- **Progress.ts**: `purchaseEquipment` unchanged; works with multi-resource once `getUpgradeCost` returns `def.cost`. Ensure default progress / new save sets `equipped` to base def ids and `ownedItems` for each base def to 1.
- **roverConfig / Saves**: Default `getDefaultEquipped()` should return base def ids (e.g. `battery: "base-battery"`) so that “Base” is represented as a levelable def. Migration for existing saves: if `equipped[slot] === "base"`, set to the slot’s base def id and set `ownedItems[base-<slot>]` to 1 if not set.

---

## 5. UpgradeScene and menu

- Remove UpgradeScene from [src/main.ts](src/main.ts). Optionally delete [src/scenes/UpgradeScene.ts](src/scenes/UpgradeScene.ts).
- [PlanetRunMenuScene](src/scenes/PlanetRunMenuScene.ts): Use **canAffordAnyEquipment(bank, ownedItems)** for Configure Rover button highlight.

---

## 6. Files to touch (summary)


| Area                           | Files                                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cost model, base defs, helpers | [UpgradeDefs.ts](src/upgrades/UpgradeDefs.ts): `cost` shape, base defs per slot, `getUpgradeCost`, `canAffordCost`, `formatCost`, `getAllUpgradeDefs`, `canAffordAnyEquipment`, catalog filter (level 0, exclude base) |
| Defaults / migration           | [roverConfig.ts](src/types/roverConfig.ts) or Progress/Saves: default equipped = base def ids; new save init `ownedItems` for base defs = 1; migrate `"base"` → base def id                                            |
| Configure Rover UI             | [ConfigureRoverScene.ts](src/scenes/ConfigureRoverScene.ts): Level-up per equipped (including base); catalog = level-0 non-base defs only; remove resource pick and random 3                                           |
| Menu / cleanup                 | [PlanetRunMenuScene.ts](src/scenes/PlanetRunMenuScene.ts), [main.ts](src/main.ts), optionally [UpgradeScene.ts](src/scenes/UpgradeScene.ts)                                                                            |


---

## 7. Clarifications

- **Level upgraded only in config screen**: Catalog has no “level up”; it only sells the first level. All further levels (for any item, including base) happen via the equipment section “Level up” control.
- **Catalog = new items only**: Only defs with owned level 0 appear; base defs are excluded and are leveled only in the equipment section.
- **All catalog items start at level 0**: Purchasing from the catalog gives level 1; the item then no longer appears in the catalog.

