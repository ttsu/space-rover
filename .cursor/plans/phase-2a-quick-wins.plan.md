---
name: Phase 2a Quick Wins
overview: Run goals with Summary integration, HUD total/capacity as decision support, core SFX, and return-to-base/death feedback polish. First phase of the next-phase features proposal (engagement, math via gameplay, immersion).
todos:
  - id: run-goals-data
    content: "Run goals data model: define RunGoal type and goal kinds (e.g. collectNResource, totalCargo, noLavaDamage); store current goal in GameState or new RunGoals module"
    status: completed
  - id: run-goals-ui-planet-run-menu
    content: "Planet Run Menu: let player pick optional run goal before Start Run (or random/default); pass selected goal into run"
    status: pending
  - id: run-goals-planet-scene
    content: "PlanetScene: read active run goal; show one-line goal text (e.g. 'Goal: return with 5 crystal') on HUD or info area"
    status: pending
  - id: run-goals-evaluate-summary
    content: "Evaluate goal on run end: in finishRun or Summary, check lastRun against goal; apply bonus (e.g. extra bank) if met; set goal-complete flag for Summary"
    status: pending
  - id: run-goals-summary-display
    content: "SummaryScene: show goal success/failure and bonus if a goal was set; 'Mission complete! Goal met: +X crystal' or 'Goal: return with 5 crystal (not met)'"
    status: pending
  - id: hud-total-capacity
    content: "Hud: add total cargo line (e.g. '6 in cargo' or '6/20 slots'); ensure capacity and cargo counts support decision-making (no quiz)"
    status: completed
  - id: audio-loader
    content: "Audio: add Sound resources to loader in src/resources.ts; create src/audio/ or use public/assets for SFX files (blaster, pickup, damage, dock, menu click)"
    status: pending
  - id: sfx-blaster-pickup-damage
    content: "SFX: play blaster fire (Rover/onFireBlaster), pickup (ResourceNode on collect), damage (rover onDamaged)"
    status: pending
  - id: sfx-dock-menu
    content: "SFX: play dock sound on return-to-base; menu click on button pointerup in PlanetRunMenu, Summary, Upgrade, MainMenu as desired"
    status: pending
  - id: feedback-return-base
    content: "Return-to-base feedback: short dock moment (e.g. rover tween to base or base glow), 'Cargo banked!' message + particle burst before transitioning to Summary"
    status: completed
  - id: feedback-death
    content: "Death feedback: brief screen shake or fade-to-red, 'Mission failed' message, then transition to Summary"
    status: completed
isProject: false
---

# Phase 2a: Quick Wins

Part of the [Next Phase Features Proposal](next_phase_features_proposal_96eabf29.plan.md) (Section 4). This phase delivers run goals with counting/planning, HUD as decision support, core sound effects, and return/death polish.

## 1. Run goals (engagement + math via gameplay)

**Goal:** Optional run objectives (e.g. "Return with 5 crystal", "Fill cargo", "No lava damage") that the player uses counting/planning to achieve. Reward on success (bonus bank or badge); no quiz.

- **Data model:** Define `RunGoal` type and goal kinds. Options: new file `src/state/RunGoals.ts` or extend [src/state/GameState.ts](src/state/GameState.ts). Store `currentRunGoal: RunGoal | null` and clear on run start; set from Planet Run Menu.
- **Goal kinds (examples):** `{ kind: "collectResource", resourceId: "crystal", amount: 5 }`, `{ kind: "totalCargo", amount: 10 }`, `{ kind: "fillCapacity" }`, `{ kind: "noLavaDamage" }`.
- **Planet Run Menu:** [src/scenes/PlanetRunMenuScene.ts](src/scenes/PlanetRunMenuScene.ts) — add UI to choose one goal (or "No goal") before "Start Run"; pass selection into run (e.g. set on GameState or Saves for current run).
- **PlanetScene:** [src/scenes/PlanetScene.ts](src/scenes/PlanetScene.ts) — read active goal; show one-line text (e.g. in HUD or below info label): "Goal: return with 5 crystal."
- **Evaluation:** When `finishRun` is called (return to base or death), evaluate `lastRun` against `currentRunGoal`. If met and survived, apply bonus (e.g. add 1 crystal to bank for "5 crystal" goal, or fixed bonus). Set a `goalMet: boolean` (and bonus amount) so Summary can display it.
- **SummaryScene:** [src/scenes/SummaryScene.ts](src/scenes/SummaryScene.ts) — if a goal was set, show "Goal met! +X bonus" or "Goal not met." Include in `statsLabel` or a separate label.

## 2. HUD total and capacity (decision support)

**Goal:** Player sees total cargo (e.g. "6 in cargo" or "6/20 slots") to decide "room for one more?" and "am I at my goal?"

- **File:** [src/ui/Hud.ts](src/ui/Hud.ts).
- **Changes:** In `updateFromState`, extend `cargoLabel` or add a line: show total pieces (iron + crystal + gas) and/or "X/20 slots" (using `rover.usedCapacity` and `rover.maxCapacity`). Keep existing per-resource counts. Optional later: resource icons row (Phase 2b or 2c).

## 3. Sound effects (immersion)

**Goal:** Core SFX so actions feel responsive and the world has presence.

- **Loader:** [src/resources.ts](src/resources.ts) — Excalibur `Sound` or HTML5 `Audio`; add SFX files to loader (e.g. from `public/assets/sfx/`). Ensure paths work with build.
- **Audio module (optional):** `src/audio/sounds.ts` or similar: export `playBlaster()`, `playPickup()`, `playDamage()`, `playDock()`, `playClick()` that use loaded sounds. Call from:
  - **Blaster:** [src/entities/Rover.ts](src/entities/Rover.ts) or wherever `onFireBlaster` is invoked (PlanetScene).
  - **Pickup:** [src/entities/ResourceNode.ts](src/entities/ResourceNode.ts) on successful collect.
  - **Damage:** [src/scenes/PlanetScene.ts](src/scenes/PlanetScene.ts) in `rover.onDamaged`.
  - **Dock:** PlanetScene when player triggers return-to-base and before `finishRun`/transition.
  - **Menu click:** Button `pointerup` in PlanetRunMenuScene, SummaryScene, UpgradeScene, MainMenuScene (optional, can be one shared click sound).

## 4. Return-to-base and death feedback (immersion)

**Goal:** Clear, satisfying moment on success and failure.

- **Return to base:** In [src/scenes/PlanetScene.ts](src/scenes/PlanetScene.ts), when the player presses Enter or "Return to ship" and is near base: (1) play dock SFX, (2) optional short tween (rover to base center) or base glow, (3) show "Cargo banked!" label and/or particle burst (reuse [src/effects/Particles.ts](src/effects/Particles.ts)), (4) short delay then call `finishRun` and goToScene("summary").
- **Death:** When rover health reaches 0: (1) play damage SFX if not already, (2) brief camera shake or red flash, (3) show "Mission failed" (e.g. label or overlay), (4) short delay then `finishRun` and goToScene("summary").

## 5. Implementation order

1. Run goals data + Planet Run Menu selection + PlanetScene goal text.
2. Goal evaluation in finishRun + Summary display.
3. HUD total/capacity.
4. Audio loader + SFX wiring (blaster, pickup, damage, dock, click).
5. Return-to-base and death feedback polish.
