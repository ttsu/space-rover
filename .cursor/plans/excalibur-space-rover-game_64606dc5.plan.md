---
name: excalibur-space-rover-game
overview: Design and implement a kid-friendly ExcaliburJS space exploration game focusing on planetary surface rover exploration, resource collection, and light math learning for ages 6–9.
todos:
  - id: proj-setup
    content: Set up ExcaliburJS project scaffolding with scenes for menu, planet, and summary
    status: completed
  - id: rover-core
    content: Implement rover actor, controls, camera follow, and basic capacity math state
    status: completed
  - id: planet-gen
    content: Create planet surface representation and random generation of tiles and biomes
    status: completed
  - id: resources-core
    content: Define resource types, spawn distributions, and collection/capacity logic with math feedback
    status: completed
  - id: hazards-core
    content: Implement key environmental hazards (lava, lightning, rocks, wind, quakes) and tune them for kids
    status: completed
  - id: hud-math-ui
    content: Build HUD that surfaces cargo, capacity, and simple math feedback in a kid-friendly way
    status: completed
  - id: run-summary
    content: Implement run completion, base-return logic, and a math-oriented summary screen
    status: completed
  - id: tuning-playtests
    content: Tune difficulty, pacing, and math clarity through early playtests and parameter tweaks
    status: completed
  - id: hud-always-visible
    content: Ensure HUD is implemented as a screen-space overlay that remains visible regardless of rover or camera position.
    status: completed
  - id: zero-health-restart
    content: Implement rover zero-health behavior so input and movement stop at 0 health and the run ends, requiring a fresh start.
    status: completed
  - id: solid-rock-collisions
    content: Update rock hazards so their colliders are solid and the rover cannot pass through them.
    status: completed
  - id: lava-movement-slowdown
    content: Apply a configurable movement slowdown effect while the rover is in lava tiles, in addition to damage over time.
    status: completed
isProject: false
---

### High-level goals

- **Build a top-down ExcaliburJS rover exploration prototype** for planetary surfaces with collectible resources, hazards, and a simple capacity system.
- **Embed age-appropriate math concepts** inside moment-to-moment decisions (movement, capacity, trade-offs) without feeling like worksheets.
- **Lay groundwork for future systems** (ship upgrades, interplanetary travel, richer math) while keeping this phase focused on planetary surface gameplay.

### Proposed game scope for this phase

- **Core loop**
  - Land on a planet → drive rover on a top-down map → collect resources → avoid hazards → return to base/lander with as much valuable cargo as possible.
- **Player avatar & controls**
  - 2D top-down rover (simple, friendly design).
  - Movement via keyboard (WASD/arrow keys) with smooth camera following.
  - Optional: a simple on-screen D-pad abstraction later for touch if needed.
- **Planet surface**
  - Tile-based or grid-based world using ExcaliburJS actors/tiles.
  - Biomes (e.g., rocky plains, lava fields, storm zones) that affect hazard frequency.
  - Fog-of-war or limited visibility to encourage exploration.
- **Resources (math hooks)**
  - A few mineral types with distinct values and weights/volumes.
  - Rover has a **maximum capacity** (e.g., 20 units) for early addition/subtraction and comparison.
  - Collecting resources updates cargo counts and shows **running totals** and **remaining capacity**.
  - Simple decisions: "Can I pick up this 3-unit crystal if I only have 2 units of space left?" (comparison, subtraction).
- **Hazards**
  - Lava pools/flows (static and slowly moving zone damage).
  - Lightning strikes (telegraphed areas, timed hazards).
  - Rock fields (slow movement, bump/knockback).
  - Wind gusts (push the rover, change trajectory).
  - Quakes (short time windows where ground cracks or rocks fall).
- **End-of-run summary (math reinforcement)**
  - Show total collected resources, capacity usage, and value.
  - Use simple bar or icon counts to visualize quantities.
  - Provide optional kid-friendly prompts: "You collected 7 iron and 5 crystal. How many pieces is that?" (can be interactive or just part of UI copy in later phases).

### Math design focus (recommendation)

- **Primary skills for v1**
  - **Addition & subtraction within 50–100** via capacity and scoring.
  - **Comparison (>, <, =) and reasoning about trade-offs** via choosing which resource types to pick when nearly full.
  - **Basic measurement/estimation** via distance/time to hazards and return-to-base choices ("Do I have time to grab one more resource?").
- **Subtle integration patterns**
  - Rover cargo UI always displays **current cargo, max cargo, and remaining space** in clear numeric form.
  - Resource nodes show **size/value** labels using small integers.
  - Upgrade choices later can compare capacities ("15 → 20" with visual difference).

### Technical architecture (ExcaliburJS)

- **Overall structure**
  - `Game` bootstrap file configuring Excalibur `Engine`, resolution, and scenes.
  - **Scenes**:
    - `MainMenuScene`: title, start button, simple settings.
    - `PlanetScene`: primary gameplay scene for rover exploration.
    - `SummaryScene`: post-run summary of collected resources and hazards encountered.
- **Core systems**
  - **RoverController**: handles movement, collision, capacity, and math-related state (cargo counts, remaining capacity).
  - **PlanetGenerator**: deterministic/random generation of tiles, resources, and hazard zones.
  - **ResourceSystem**: data structures and logic for resource types, values, capacities.
  - **HazardSystem**: spawners, telegraphs, and interactions (damage, knockback, movement modifiers).
  - **UISystem**: HUD elements for capacity, cargo, health, and small math-reinforcing displays.

### Concrete implementation tasks

#### 1. Project setup & core engine

- **1.1 Initialize project scaffold**
  - Set up a basic TypeScript project using Vite as the bundler.
  - Install ExcaliburJS and configure entry point (`index.ts` / `main.ts`).
  - Create a basic `Engine` configuration (logical resolution, scaling, background color).
- **1.2 Scene framework**
  - Implement `MainMenuScene` with a title, a "Play" button, and simple instructions.
  - Implement empty `PlanetScene` and `SummaryScene` and set up scene transitions.

#### 2. Rover actor & controls

- **2.1 Rover visuals & physics**
  - Create a `Rover` actor class with placeholder sprite/shape.
  - Configure movement speed, friction, collision box, and health.
  - When rover health reaches 0, immediately disable player input and rover movement, mark the run as failed, and trigger a restart flow (e.g., reload `PlanetScene` or navigate to `SummaryScene` with a clear mission failed state).
- **2.2 Input handling**
  - Implement keyboard-based movement (WASD/arrow keys) using Excalibur input.
  - Implement camera follow behavior centered on the rover.
- **2.3 Basic math state for capacity**
  - Add rover cargo state: `maxCapacity`, `usedCapacity`, per-resource counts.
  - Expose utility methods: `canPick(resource)`, `addResource(resource)`, `remainingCapacity()`; these will drive math-heavy UI.

#### 3. Planet surface generation

- **3.1 Map representation**
  - Choose and implement a representation (grid of tiles vs. freely placed actors) appropriate for Excalibur.
  - Define tile types: ground, lava, rock-field, storm-zone, safe base area.
- **3.2 Random planet generator**
  - Implement a simple seeded random generator for reproducible planets.
  - Define planet parameters (radius/size, biome mix, hazard density).
  - Fill the map with base tiles and apply biome masks (e.g., lava region near equator, rocks near poles for flavor).
- **3.3 Landed base/lander**
  - Place a lander/base actor that marks the safe return point.
  - Implement detection of rover entering/exiting base area.

#### 4. Resource distribution & collection

- **4.1 Resource type definitions**
  - Create data models for resources: `id`, `name`, `size`, `value`, `color/icon`.
  - Calibrate values and sizes to produce small-integer arithmetic (e.g., sizes 1–5, values 1–10).
- **4.2 Spawning resources**
  - Distribute resource nodes across the map using random sampling with biome-based frequency.
  - Ensure spawn spacing avoids clutter and creates exploration pockets.
- **4.3 Pickup logic & math feedback**
  - Implement collision detection for rover vs. resource node.
  - On overlap, check `canPick(resource)` using capacity math.
  - If capacity allows:
    - Add counts to rover cargo, update HUD.
    - Show a small math pop-up (e.g., `5/20 → 8/20` or `+3 iron (total 7)`).
  - If capacity is insufficient:
    - Show a friendly message like "Not enough space — you need 3 units, but only have 2" to reinforce comparison.

#### 5. Hazards and environmental challenges

- **5.1 Lava**
  - Represent lava tiles or actors that deal damage over time when rover is inside.
  - Optionally include slow-moving lava flows.
  - While the rover is inside lava tiles, apply a strong movement slowdown (for example, around 50% of normal speed) in addition to damage over time; make this slowdown tunable via the hazard configuration parameters described in section `8.1 Playtest-focused parameters`.
- **5.2 Lightning**
  - Implement timed hazard zones that telegraph with a visual warning before a strike.
  - Trigger damage/knockback on strike.
- **5.3 Rocks & rough terrain**
  - Add rock obstacles with solid colliders that the rover cannot pass through; the player must navigate around them.
  - Optionally include separate rough-terrain tiles that slow rover movement but remain traversable, distinct from solid rock obstacles.
- **5.4 Wind & earthquakes**
  - Wind: periodic directional forces applied to rover in certain zones.
  - Earthquakes: brief global events with screen shake and temporary hazards (falling rocks or cracks).
- **5.5 Hazard difficulty tuning**
  - Make damage forgiving (kids 6–9), focusing on planning and timing rather than twitch reflex.
  - Consider a "safety mode" option to reduce hazard intensity.

#### 6. HUD and math-reinforcing UI

- **6.1 Core HUD**
  - Display rover health, current cargo, maximum capacity, and remaining space.
  - Use clear visuals (icons + numbers) to emphasize quantities.
  - Implement the HUD as a screen-space overlay (e.g., Excalibur `ScreenElement`-style UI) anchored to the viewport so it remains visible regardless of rover position or camera movement.
  - Ensure HUD elements do not scroll with the world; they should always be visible, fixing issues where the HUD only appears when the rover is in a specific map corner.
- **6.2 Resource breakdown**
  - Show per-resource totals and values.
  - Visualize capacity usage (e.g., bar segmented by resource type or icon row).
- **6.3 Subtle prompts and feedback**
  - For capacity-related actions, display contextual hints:
    - "You have 5/20 space used. This crystal takes 4 space. What will your total be?" (can be non-interactive text for now).
  - Ensure UI is not text-heavy; keep language simple and readable for young kids and parents.

#### 7. Run completion & summary screen

- **7.1 Return-to-base logic**
  - When rover returns to base area, allow player to end the run.
  - Save cargo and hazard statistics for summary.
  - Also end the run when rover health reaches 0; show kid-friendly failure messaging (e.g., Rover powered down) and require the player to start a new run rather than continuing from zero health.
- **7.2 Summary presentation**
  - Show total pieces collected per resource and overall.
  - Show capacity usage (e.g., `18/20` at end of run) with visualization.
  - Optionally show "best run" stats for replay motivation.
- **7.3 Math recap hooks**
  - Include simple, optional recap prompts for adults to discuss with kids, e.g., "You traded 7 iron and 3 crystal for 10 credits. How many pieces did you trade?" (even if trading is implemented later, this scaffolds the concept).

#### 8. Initial balancing & kid-friendly tuning

- **8.1 Playtest-focused parameters**
  - Expose configuration for rover speed, hazard damage, resource density, and capacity in a config file.
  - Start with short runs (2–4 minutes per planet) to align with young kids' attention spans.
- **8.2 Accessibility & clarity**
  - Use high-contrast colors and large UI elements.
  - Avoid overwhelming the screen with numbers; prioritize one or two key math indicators (capacity and totals).

#### 9. Future extension hooks (beyond this phase)

- **9.1 Ship upgrades**
  - Design rover/ship stats: cargo capacity, hull strength, hazard resistance, engine speed.
  - Plan upgrade costs in terms of collected resources to create more advanced arithmetic and comparison opportunities.
- **9.2 Interplanetary travel**
  - Sketch a star map layer where each planet has difficulty, hazard profile, and resource mix.
  - Use travel time/fuel as measurement concepts (distance, time, rate) for older end of age range.

### Open questions and unknowns with high impact

- **Target input & devices**
  - Are we prioritizing **desktop keyboard/mouse**, **tablet touch**, or truly cross-platform? This affects control schemes, HUD layout, and resolution/aspect ratio assumptions.
- **Visual style and asset strategy**
  - Will we use **simple programmer art / shapes** initially, or do we need a more polished, cartoony art direction from the start? This impacts time budget for sprite creation and UI styling.
- **Reading level & localization**
  - Are we designing primarily for **early readers with adult guidance**, or must the game be **fully usable by independent 6-year-olds** (minimal text, pictograms)? This affects how much math explanation can be in-text vs. purely visual.
- **Session length & difficulty philosophy**
  - What is the expected **average session length** (e.g. 10–20 minutes vs. quick 3–5 minute bursts)? This drives planet size, hazard density, and resource frequency.
- **Failure states**
  - Should the rover be able to "fail" (e.g., be destroyed and lose some/all cargo), or should failure be heavily softened (e.g., return to base with reduced reward)? Philosophical stance here strongly affects hazard tuning and player frustration.
- **Math explicitness vs. stealth**
  - Should math prompts be **explicit mini-questions** ("What is 7 + 5?") or remain **implicit** as part of playing efficiently? This may introduce additional UI flows or mini-activities beyond the core rover loop.
- **Single-player vs. shared/parent mode**
  - Do we envision **co-play with a parent/teacher** (e.g., a companion dashboard or guidance text) or pure single-player? Co-play can shape how much math explanation is delegated to adults.
- **Save/progression system**
  - Do we need persistent progression in this phase (resources carrying over, upgrades saved), or is each run self-contained for now? This affects data storage and meta-game structure.
- **Platform constraints**
  - Are there any constraints such as **running offline**, **embedding in a learning platform**, or **school hardware limits** that could influence engine configuration, performance budget, or packaging?

