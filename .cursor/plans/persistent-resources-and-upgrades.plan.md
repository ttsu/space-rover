---
name: persistent-resources-and-upgrades
overview: Persist resources across runs, add shoot-to-mine with rover blaster, and let players spend resources on rover and blaster upgrades (choose one of three per resource type).
todos:
  - id: persistence-layer
    content: Persistence layer – types for progress (bank, applied upgrades), load/save localStorage, expose bank and add-to-bank on run success
    status: pending
  - id: credit-run-to-bank
    content: Credit run to bank – on successful run add lastRun.cargo to bank and save; Summary reads persisted state
    status: pending
  - id: upgrade-data-model
    content: Upgrade data model – upgrade type and pools per resource (iron, crystal, gas) including blaster upgrades in crystal pool; get-3-random-affordable helper
    status: pending
  - id: effective-rover-stats
    content: Effective rover stats – RoverStats includes blaster (damage, fireRate, range); base from config, merge applied upgrades
    status: pending
  - id: rover-built-from-stats
    content: Rover built from stats – Rover constructor takes RoverStats; set movement and blaster params; damage reduction and resistances in takeDamage and hazard logic
    status: pending
  - id: apply-upgrade-deduct-cost
    content: Apply upgrade and deduct cost – on pick append to applied upgrades, subtract cost from bank, save
    status: pending
  - id: rover-blaster-basic
    content: Rover blaster (basic) – fire input (Space/Ctrl), spawn projectile in facing direction, moderate fire rate and low damage from stats; projectile vs deposits only
    status: pending
  - id: resource-deposits
    content: Resource deposits – new ResourceDeposit with HP, resource type, size; on projectile hit subtract damage; when HP ≤ 0 run break-apart then spawn pickups
    status: pending
  - id: break-apart-animation
    content: Break-apart animation – when deposit HP reaches 0 play 200–400 ms sequence (particles/fragments preferred); then spawn pickup(s); tune for multiple hits with starting blaster
    status: pending
  - id: gas-drive-over
    content: Gas – keep as drive-over collectibles (or optional gas deposit type)
    status: pending
  - id: upgrade-ui-entry
    content: Upgrade UI – entry and resource choice – Menu and Summary Upgrade Rover button; choose resource type when multiple affordable
    status: pending
  - id: upgrade-ui-choose-three
    content: Upgrade UI – choose one of three – show 3 random affordable upgrades for chosen resource; on pick apply and deduct
    status: pending
  - id: menu-summary-show-bank
    content: Main menu and Summary show bank – display bank counts; enable Upgrade when applicable
    status: pending
  - id: goals-rewards-optional
    content: Goals/rewards (optional) – e.g. You have enough crystal for an upgrade! or milestones
    status: pending
isProject: false
---

# Persistent Resources and Rover Upgrades (Next Phase)

This plan extends the existing Excalibur rover game ([excalibur-space-rover-game_64606dc5.plan.md](excalibur-space-rover-game_64606dc5.plan.md)) by persisting collected resources between runs, adding **shoot-to-mine** mechanics with a rover blaster, and letting players spend resources on rover and blaster upgrades.

---

## Decisions (to be confirmed)

These choices affect the data model and implementation; confirm before or during implementation.


| #   | Decision                   | Options                                                                                                                   | Chosen                                                                                    |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **Upgrade stackability**   | Stackable (same upgrade buyable multiple times, with optional max stack per upgrade) **or** one purchase per upgrade type | stackable upgrades                                                                        |
| 2   | **Gas collection**         | Drive-over only (gas stays as current ResourceNode, no shooting) **or** shoot-to-free (gas deposits like iron/crystal)    | drive-over only                                                                           |
| 3   | **Pickups per deposit**    | One deposit → one pickup (current resource size) **or** one deposit → multiple smaller pickups                            | *one deposit - multiple pickups. more pickups for larger, higher-HP deposits*             |
| 4   | **Projectile vs deposits** | Single-target (one shot damages one deposit only) **or** piercing (one shot can hit multiple deposits)                    | *basic shot only has a single target. upgrade available for AOE effect on nearby targets* |


---

## 1. Persistent resource bank

- **Bank** = persistent totals for `iron`, `crystal`, `gas` that accumulate across runs.
- On **successful** run (return to base with health > 0): add `lastRun.cargo` to the bank.
- **Failed** runs (health = 0): no credit to bank (recommended).
- Persist bank (and applied upgrades) via **localStorage** with a single key. Load on boot; save whenever bank or upgrades change.

Existing flow: PlanetScene calls `finishRun(...)` then `goToScene('summary')`. New flow: after `finishRun`, add last run’s cargo to the bank when run succeeded, then persist. Summary and upgrade UI read from the same persisted state.

---

## 2. Mining mechanics: shoot to free minerals

Resources are no longer collected by driving over them. **Crystal clusters** and **iron ore deposits** are fixed nodes that must be **shot with the rover’s blaster** until they break; only then do they release collectible pickups that the rover can gather by collision (existing capacity logic).

### 2.1 Rover blaster (starting kit)

- **Weapon:** Basic laser blaster, mounted on rover (direction = rover facing).
- **Firing:** Player fires with a dedicated key (e.g. Space or Ctrl). **Moderate firing rate** (e.g. 2–3 shots per second) and **low damage per shot** (e.g. 1 damage to deposits).
- **Projectiles:** Short-range laser shot (visual: line or small actor) that damages only **resource deposits** (and optionally future combat targets). No collision with terrain beyond range/duration.
- Blaster stats (damage per shot, fire rate, range) come from **rover stats** so they can be upgraded.

### 2.2 Resource deposits (breakable nodes)

- **Deposit actor** replaces or wraps the current “resource node” for iron and crystal:
  - Has **hit points** (e.g. 3–5 HP with starting blaster so multiple hits are required).
  - When HP reaches 0: **break-apart animation** (see below), then spawn one or more **pickup actors** (current `ResourceNode` behavior: collision with rover adds to cargo).
- **Gas** can remain collectible-by-driving (e.g. gas vents) or also become breakable; recommend keeping gas as drive-over for variety.
- Deposit type (iron ore vs crystal cluster) determines resource type and size of the pickups released. One deposit can release a single pickup of that resource (current size) or multiple smaller units; design choice.
- Resource deposits can have different sizes, larger deposits are harder to break but yield more resources.

### 2.3 Break-apart animation (implementation notes)

- **Trigger:** When deposit HP reaches 0, do not remove the deposit immediately. Run a short **break sequence** (e.g. 200–400 ms).
- **Visual options (pick one or combine):**
  - **Particles / fragments:** Spawn 4–8 small actors or particles at the deposit center, each with a short-lived tween: move outward in random directions, fade out, then kill. Use the resource’s color (iron grey, crystal purple). This option is preferred.
  - **Scale/crack:** Deposit actor scales down and/or switches to a “cracked” sprite/color over 2–3 frames, then kill.
  - **Simple pop:** Deposit flashes white, scales up slightly then down to zero, then kill; pickups appear at the same time or after.
- **After animation:** Spawn the **pickup(s)** at the deposit position (or slightly offset). Pickups use existing `ResourceNode` logic: rover overlap → `canPick` / `addResource` / popup.
- **Multiple hits to break:** With the **starting blaster** (low damage, e.g. 1 per shot), deposits should require **several hits** (e.g. 3–5 HP) so the player experiences “shoot, shoot, shoot, break, collect.” **Upgraded blasters** (higher damage per shot or fire rate) reduce time-to-break (fewer shots or faster clearing), making mining easier and reinforcing upgrade value.

### 2.4 Gas

- Gas can stay as **drive-over** collectibles (no shooting) to differentiate resource types and keep a mix of gameplay (shoot minerals, drive through gas vents).

---

## 3. Resource-to-upgrade grouping

Group upgrades by the **resource used to purchase** them.


| Resource    | Theme                        | Example upgrades                                                                                                                                                                                                                                     |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Iron**    | Hull, protection, durability | Extra health, lava damage reduction, lava slow resistance, wind/knockback resistance, reinforced hull (flat damage reduction)                                                                                                                        |
| **Crystal** | Tech, systems, blaster       | Cargo capacity, speed, turn rate, acceleration/braking, hazard telegraph, **blaster damage**, **blaster fire rate**, **blaster range**, **blaster efficiency (damage per deposit HP), resource yield (increase % of resources spawned per deposit)** |
| **Gas**     | Power, mobility              | Speed, handling (acceleration/braking/turn), thruster-style resistances (lava slow, wind)                                                                                                                                                            |


### 3.1 Iron pool (unchanged)

- +1 max health (cost 3 iron), lava damage reduction 1 (cost 4), lava slow resistance 10% (cost 3), wind push resistance 15% (cost 4), flat damage reduction 1 (cost 5).

### 3.2 Crystal pool (tech/systems, including blaster)

- **Systems:** +4 cargo capacity (cost 5 crystal), +20 max speed (cost 4), +0.2 rad/s turn speed (cost 3), +50 acceleration (cost 4), +5 lightning warning time (cost 3).
- **Blaster (tech):**
  - **Blaster damage +1** (cost 4 crystal) – each shot does more damage to deposits (and future enemies); fewer shots to break.
  - **Blaster fire rate** (cost 4 crystal) – e.g. +0.5 shots/sec so mining is faster.
  - **Blaster range** (cost 3 crystal) – longer reach for safer or more flexible mining.
  - **Blaster efficiency** (cost 5 crystal) – e.g. “deposits have 1 less HP” or “+1 damage to deposits only”; makes break-apart happen sooner with the same gun.

### 3.3 Gas pool (unchanged)

- +15 max speed (cost 4 gas), +30 acceleration (cost 3), +0.15 rad/s turn speed (cost 3), lava slow resistance 10% (cost 4), wind push resistance 10% (cost 3).

---

## 4. “Choose one of three” mechanic

- When the player has enough of a resource to afford at least one upgrade in that resource’s pool, they can open the upgrade flow for that resource.
- Offer: randomly pick **3 different** upgrades from the pool for that resource (filter to affordable and optionally not maxed).
- Player chooses one; cost is deducted and the upgrade is applied.
- If the player has enough of multiple resource types, they choose which resource to spend, then see the 3 options for that type.

---

## 5. Goals, rewards, and progression

- **Short-term:** “Return to base with at least 5 crystal,” “Finish a run without taking lava damage,” “Collect 10 iron in one run.”
- **Rewards:** “You earned enough crystal for an upgrade!” in Summary or menu.
- **Progression:** Bank grows → buy upgrades (rover + blaster) → stronger rover and faster mining → riskier/longer runs. Optional milestones (total resources ever collected).

---

## 6. UI flow

- **Main menu:** Show bank; “Upgrade Rover” button (or “Upgrades”) – enter upgrade flow when any resource can afford at least one upgrade.
- **Summary:** Show “Resources added to your bank!”; “Upgrade Rover” and “Back to Menu.”
- **Upgrade screen:** (1) Choose resource type if multiple affordable; (2) show 3 random choices from that pool; (3) pick one → deduct cost, apply upgrade, save; (4) return to menu or “Pick another.”
- **Rover construction:** PlanetScene creates the rover from **effective stats** (base config + applied upgrades), including blaster stats (damage, fire rate, range).

---

## 7. Technical touchpoints

- **Persistence:** load/save `{ bank, appliedUpgrades }` to localStorage.
- **Upgrade definitions:** per-resource pools including blaster upgrades (id, resourceId, cost, name, description, effect).
- **Effective rover stats:** include **blasterDamage**, **blasterFireRate**, **blasterRange**; Rover/PlanetScene create blaster with these.
- **Deposits:** New actor type (e.g. `ResourceDeposit`) with HP, hit by projectile group; on death run break-apart animation then spawn pickups. Projectiles from rover only damage deposits (and future combat targets).
- **Rover:** Accepts RoverStats; has a **Blaster** component or child actor that spawns projectiles on fire input, using stats for damage/rate/range. Projectiles register hits on deposits.

---

## 8. Implementation tasks (split for an agent)

1. **Persistence layer** – Types for progress (bank, applied upgrades). Load/save localStorage. Expose bank and “add to bank” on run success.
2. **Credit run to bank** – On successful run, add lastRun.cargo to bank and save. Summary reads persisted state.
3. **Upgrade data model** – Upgrade type and pools per resource (iron, crystal, gas); include **blaster upgrades** in crystal pool. “Get 3 random affordable” helper.
4. **Effective rover stats** – RoverStats includes blaster (damage, fireRate, range). Base from config; merge applied upgrades.
5. **Rover built from stats** – Rover constructor takes RoverStats; set movement + blaster params. Damage reduction / resistances in takeDamage and hazard logic.
6. **Apply upgrade and deduct cost** – On pick: append to applied upgrades, subtract cost, save.
7. **Rover blaster (basic)** – Fire input (Space/Ctrl). Spawn projectile (laser) in facing direction; moderate fire rate, low damage from stats. Projectile: short lifetime/range, collision group vs deposits only.
8. **Resource deposits** – New `ResourceDeposit` (or extend ResourceNode): HP, resource type, size. On hit by projectile: subtract damage; when HP ≤ 0 run break-apart (see 9) then spawn pickups. Existing pickup logic for collision with rover.
9. **Break-apart animation** – When deposit HP reaches 0: play 200–400 ms sequence (particles/fragments outward + fade, or scale-down/crack, or pop). Then spawn pickup(s) at position. Tune so starting blaster needs multiple hits (e.g. 3–5); upgraded blaster fewer hits.
10. **Gas** – Keep gas as drive-over if desired; or add gas “deposit” type with same shoot-to-free pattern.
11. **Upgrade UI – entry and resource choice** – Menu and Summary “Upgrade Rover”; choose resource type when multiple affordable.
12. **Upgrade UI – choose one of three** – Show 3 random affordable upgrades for chosen resource; on pick apply and deduct.
13. **Main menu and Summary show bank** – Display bank counts; enable Upgrade when applicable.
14. **Goals/rewards (optional)** – e.g. “You have enough crystal for an upgrade!” or milestones.

---

## 9. High-impact open questions

- **Decisions table (above):** Upgrade stackability, gas behavior, pickups per deposit, and projectile single-target vs piercing are in **Decisions (to be confirmed)**; fill in Chosen when decided.
- Failed-run policy: no bank credit recommended.
- Cost curve and exact numbers; tune after playtest.
- LocalStorage scope (browser); fallback if needed.
- Quake: damage/resistance and whether to add quake resistance (iron).
- **Mining tuning:** Exact deposit HP and starting blaster damage (e.g. 3–5 hits to break); tune after implementation.
- **Mining:** Exact deposit HP and starting blaster damage so “multiple hits” feels good (e.g. 3–5 hits to break). Whether one deposit releases one pickup or several. Whether projectiles can hit multiple deposits in one shot (e.g. piercing) or one shot one target.

