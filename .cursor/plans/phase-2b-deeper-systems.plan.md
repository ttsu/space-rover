---
name: ""
overview: ""
todos: []
isProject: false
---

---

name: Phase 2b Deeper Systems
overview: Upgrade screen "after buying: X left" (and optional equation hint), milestones and first-time tutorial, music loop with dynamic layers, and sky/ambient in PlanetScene. Second phase of the next-phase features proposal.
todos:

- id: upgrade-after-buying
content: "UpgradeScene: under each upgrade option show 'After buying: X [resource] left' using bank and cost; optional equation hint (e.g. '5 - 3 = 2') for younger age band"
- id: age-band-config
content: "Age band (optional): add to Saves or config (e.g. 3-5 vs 6-9); use only for hint level (equation vs plain 'X left'); no quizzing"
- id: milestones-data
content: "Milestones: define milestone IDs (e.g. firstUpgrade, bankTotal10, crystal50); store achieved set in save or localStorage"
- id: milestones-check-display
content: "Check and show milestones: on Summary or after upgrade/bank change; one-time congratulations (modal or Summary line) and optional particle/badge"
- id: tutorial-first-time
content: "First-time tutorial: overlay or tooltips (Drive WASD, Shoot deposits, Return to base); store 'tutorial seen' in save or localStorage; show only once"
- id: music-loader-loop
content: "Music: add exploration loop to loader; play in PlanetScene on activate, stop or mute when leaving; keep volume low under SFX"
- id: music-dynamic
content: "Music dynamic layer: optional tension layer when health low or in hazard; short success sting on Summary when mission complete"
- id: sky-ambient
content: "PlanetScene sky/ambient: simple gradient or parallax background (stars/horizon) so play area feels like a place; no full art pass required"
isProject: false

---

# Phase 2b: Deeper Systems

Part of the [Next Phase Features Proposal](next_phase_features_proposal_96eabf29.plan.md) (Section 4). This phase adds upgrade cost info (math decision support), milestones and tutorial, and music + sky for immersion.

## 1. Upgrade screen: "After buying: X left" (math decision support)

**Goal:** Show information that supports the player's choice (subtraction in context). No quiz—player uses it to decide which upgrade to buy.

- **File:** [src/scenes/UpgradeScene.ts](src/scenes/UpgradeScene.ts).
- **Current behaviour:** Shows resource choice, then three options with name, cost, description. Player taps one to buy.
- **Change:** For each upgrade option, add a line: "After buying: X [iron/crystal/gas] left" where X = current bank for that resource minus cost. Use existing `getBank()` and option `cost`/`resourceId`.
- **Optional equation hint:** If age band (e.g. 3–5) is "younger", show "5 − 3 = 2 left" in addition to or instead of "After buying: 2 left". Requires age band in save/config (see below).

## 2. Age band (optional)

**Goal:** Tune hint level only; no quizzing in any band.

- **Storage:** Add to [src/state/Saves.ts](src/state/Saves.ts) `GameSave` (e.g. `ageBand?: "3-5" | "6-9"`) or a separate config/localStorage key. Set in DifficultySelectScene or a settings screen.
- **Usage:** UpgradeScene reads age band; when "3-5", show equation hint ("5 − 3 = 2 left"); when "6-9" or unset, show only "After buying: 2 left."

## 3. Milestones and celebration

**Goal:** First-time achievements (e.g. first upgrade, bank total 10, 50 crystal all-time) with one-time congratulations.

- **Data:** Define milestone IDs and conditions (e.g. `firstUpgrade`, `bankTotal10`, `crystal50`). Store `milestonesAchieved: string[]` in save or a dedicated localStorage key.
- **Check points:** After `addToBank` (Summary or Progress), after `addAppliedUpgrade` (UpgradeScene), and optionally on Summary when showing total resources. If condition met and not already in achieved set, add and persist.
- **Display:** When a new milestone is achieved, show congratulations (e.g. modal with "You banked 10 total for the first time!" or a line on Summary). Optional: particle burst or badge graphic. Keep one-time (only when just achieved).

## 4. First-time tutorial

**Goal:** One-time tooltips or overlay so first run is easier to learn.

- **Content:** Short hints: "Drive: W/A/S/D" (or touch joystick), "Shoot deposits to mine", "Return to base to bank cargo."
- **Storage:** e.g. `tutorialCompleted: boolean` in save or `localStorage.getItem("starship-tutorial-done")`. Set to true when user dismisses or completes first run.
- **Display:** On first run (PlanetScene), show overlay or labels that point to controls; dismiss on key press or "Got it" button. Only when `tutorialCompleted` is false.

## 5. Music loop and dynamic layers

**Goal:** Calm exploration music on planet; optional tension when low health or in hazard; short success sting on Summary.

- **Loader:** Add music files to [src/resources.ts](src/resources.ts) (exploration loop, optional tension loop, success sting).
- **PlanetScene:** On activate, start exploration loop (loop: true). On deactivate, stop. Volume balanced below SFX.
- **Dynamic:** If health ≤ 1 or rover in hazard, optionally crossfade or layer tension (or lower pitch). Requires passing rover state to a small music helper or checking in scene preupdate.
- **SummaryScene:** On activate, if mission complete (lastRun.healthRemaining > 0), play short success sting once.

## 6. Sky / ambient in PlanetScene

**Goal:** Play area feels like a place, not a flat grid.

- **Implementation:** In [src/scenes/PlanetScene.ts](src/scenes/PlanetScene.ts), add a background actor or draw a gradient (e.g. darker at top for sky, lighter at bottom for ground). Alternatively, a tiled or single sprite for "sky" or "horizon" behind the tile layer. Excalibur: add child actor with z-index below tiles, or use scene background color + a simple gradient shape.
- **Scope:** Minimal—no full art pass. Simple gradient or single image is enough for Phase 2b.

## 7. Implementation order

1. Upgrade "after buying: X left" in UpgradeScene; optionally age band + equation hint.
2. Milestones: data, check points, one-time display.
3. Tutorial: storage + first-run overlay in PlanetScene.
4. Music: loader, exploration loop in PlanetScene, success sting in Summary; optional tension layer.
5. Sky/ambient background in PlanetScene.

