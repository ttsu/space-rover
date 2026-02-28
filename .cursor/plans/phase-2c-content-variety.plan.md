---
name: Phase 2c Content and Variety
overview: Resource recipes (meaningful trade-off, no quiz), in-world pattern/sequence challenge or planet-of-the-day seed, and flavor text on Summary and mission brief. Third phase of the next-phase features proposal.
todos:
  - id: recipes-data
    content: "Recipes: define RECIPES config (costs + effect, e.g. 2 iron + 1 crystal = repair kit for next run); helper to check canCraft and apply"
  - id: recipes-ui
    content: "Recipes UI: craft panel or section in Planet Run Menu; show affordable recipes; on craft, spend from bank and apply effect (e.g. set 'next run bonus health')"
  - id: recipe-effect-next-run
    content: "Apply recipe effect on run: e.g. repair kit grants +1 health at start of next run; consume flag when PlanetScene starts"
  - id: pattern-sequence-challenge
    content: "In-world pattern/sequence: e.g. bonus deposit or trigger that rewards collecting in order (iron then crystal then gas) or stepping tiles in sequence; no modal quiz"
  - id: planet-of-the-day-seed
    content: "Optional: planet-of-the-day or challenge seed (daily seed) for variety; show in Planet Run Menu when starting run"
  - id: flavor-text-summary
    content: "Summary flavor text: short message by outcome (success/fail, goal met/not); e.g. 'You brought back 4 crystal. The base crew is happy!'"
  - id: flavor-text-mission-brief
    content: "Mission brief: when run goal is set, show one-line brief on Planet Run Menu or run start (e.g. 'This run: collect at least 5 crystal')"
isProject: false
---

# Phase 2c: Content and Variety

Part of the [Next Phase Features Proposal](next_phase_features_proposal_96eabf29.plan.md) (Section 4). This phase adds recipes as meaningful trade-offs, optional in-world pattern/sequence or daily seed, and narrative flavor text.

## 1. Resource recipes (math: "do I have enough?" trade-off)

**Goal:** Player decides to spend a combination of resources (e.g. 2 iron + 1 crystal) for a gameplay bonus. Math is in the decision, not a quiz.

- **Data:** New config or module, e.g. `src/config/recipes.ts` or table in existing config. Each recipe: `id`, `costs: { iron?, crystal?, gas? }`, `effect` (e.g. `{ kind: "extraHealthNextRun", value: 1 }`). Example: "Repair kit: 2 iron + 1 crystal → +1 health next run."
- **Helpers:** `canCraft(recipe, bank): boolean`; `craft(recipe): boolean` — deduct costs from bank (use `spendFromBank` from [src/state/Progress.ts](src/state/Progress.ts)) and set effect flag (e.g. on save or GameState: `nextRunBonusHealth: number`). Persist so next run consumes it.
- **UI:** In [src/scenes/PlanetRunMenuScene.ts](src/scenes/PlanetRunMenuScene.ts), add a "Craft" section or panel. List recipes the player can afford (using `canCraft` and `getBank()`). On tap, call `craft(recipe)`, refresh bank display, optional SFX/particle.
- **Apply effect:** In [src/scenes/PlanetScene.ts](src/scenes/PlanetScene.ts) on activate (when setting up rover), if `nextRunBonusHealth > 0`, add to rover max health or current health for that run, then clear the flag (so one-time per craft).

## 2. In-world pattern or sequence challenge (no quiz)

**Goal:** A gameplay challenge that rewards pattern/sequence (e.g. collect in order, or trigger tiles in order) for a bonus. No modal "what's next?" question.

- **Option A — Collect order:** One special "bonus" deposit or trigger per run. If the player has collected resources in a defined order (e.g. iron then crystal then gas) before touching it, the deposit yields extra or unlocks a bonus. Track last N pickups (e.g. iron, crystal, gas) in GameState or rover; when rover collides with bonus trigger, check sequence and grant reward.
- **Option B — Tile sequence:** A path of tiles or markers the rover must drive over in order (1 → 2 → 3). When completed in order, grant bonus (extra resource, shield, etc.). Track "last stepped index" and "current sequence index" in scene or entity.
- **Implementation:** New entity or flag in [src/world/PlanetGenerator.ts](src/world/PlanetGenerator.ts) to place one bonus trigger per run. New small module or scene logic to track order/sequence and apply reward. Reward: e.g. add resource to cargo, or set one-time shield for run.

## 3. Planet-of-the-day / challenge seed (optional)

**Goal:** Variety: optional daily or challenge seed so layout changes.

- **Data:** Compute a "day seed" from current date (e.g. `dateToSeed(new Date())`) so the same day gives the same planet. Store in GameState or pass to PlanetGenerator when "Planet of the day" is selected.
- **UI:** In Planet Run Menu, add optional "Planet of the day" or "Challenge" button that uses day seed instead of save seed for the next run. Show short label: "Today's planet" or "Daily challenge."

## 4. Flavor text on Summary

**Goal:** Short narrative line by outcome so Summary feels less dry.

- **Content:** Templates or strings keyed by: mission success vs failed; goal set and met vs not set vs not met. Examples: "You brought back 4 crystal. The base crew is happy!" / "Tough run. Upgrade your hull and try again." / "Goal met! Nice work."
- **Implementation:** In [src/scenes/SummaryScene.ts](src/scenes/SummaryScene.ts), in `onActivate`, build one or two flavor lines from `GameState.lastRun`, goal result, and bank. Prepend or append to `statsLabel`, or add a separate `flavorLabel`.

## 5. Mission brief (run goal)

**Goal:** When a run goal is set, show a one-line brief so the player knows the target.

- **Where:** Planet Run Menu when "Start Run" is pressed (e.g. "This run: collect at least 5 crystal") or at start of PlanetScene (e.g. same line under goal text).
- **Implementation:** If `currentRunGoal` is set, include goal description in the text shown on Planet Run Menu (above Start Run) or in PlanetScene goal line. Reuse goal-to-string from Phase 2a.

## 6. Implementation order

1. Recipes: data + canCraft/craft + apply effect on next run; then Craft UI in Planet Run Menu.
2. Flavor text: Summary templates + mission brief (goal line).
3. In-world pattern/sequence: design one variant (collect order or tile sequence), then bonus trigger + tracking + reward.
4. Optional: planet-of-the-day seed and Planet Run Menu entry.
