---
name: ReactMenuOverlay
overview: Add a React/HTML overlay system and replace `PlanetRunMenuScene` and `ConfigureRoverScene` UI with React components while keeping the Excalibur gameplay scenes unchanged.
todos:
  - id: react-deps-tsconfig
    content: Add React/ReactDOM deps, update `tsconfig.json` for JSX, optionally add `@vitejs/plugin-react` in `vite.config.ts`.
    status: completed
  - id: overlay-root-dom-css
    content: Add overlay DOM (`index.html`) and overlay CSS (`src/style.css`) + wrapper element for correct positioning over canvas.
    status: completed
  - id: overlay-manager
    content: Create `src/ui/react/ReactOverlayManager.ts` to mount/unmount React and scale overlay to current canvas draw resolution; manage pointer-events.
    status: completed
  - id: planet-menu-react-view
    content: Create `src/ui/react/views/PlanetRunMenuView.tsx` rendering goals/bank/buttons and calling existing game functions; keep UI in sync via local rerender tick.
    status: completed
  - id: configure-rover-react-view
    content: Create `src/ui/react/views/ConfigureRoverView.tsx` implementing slot inventory/cargo/shop UI with click-to-select equip flow and tooltip; re-render via local tick.
    status: completed
  - id: scene-wiring
    content: Update `src/scenes/PlanetRunMenuScene.ts` and `src/scenes/ConfigureRoverScene.ts` to mount/unmount React overlays and remove Excalibur UI construction.
    status: completed
  - id: verify-build-lint
    content: Run `npm run build` and `npm run lint` and fix any TypeScript/formatting issues.
    status: completed
isProject: false
---

## Implementation Plan: React HTML Menus

### 1. Add React to the project

- Update `package.json` to add `react`, `react-dom` (and `@types/react`, `@types/react-dom` for TypeScript).
- Update `tsconfig.json` to enable JSX transform:
  - Set `compilerOptions.jsx` to `react-jsx`.
- (Optional but recommended) Update `vite.config.ts` to include `@vitejs/plugin-react` for faster refresh + consistent JSX handling.

### 2. Create an HTML overlay root over the Excalibur canvas

- Update `index.html` to include an overlay container next to the canvas (keep it above the canvas in DOM order), e.g.:
  - wrap canvas+overlay in a positioned container (`#game-wrap`)
  - add a new `div#ui-overlay`.
- Update `src/style.css` with minimal positioning rules:
  - `#game-wrap { position: relative; }`
  - `#ui-overlay { position: absolute; inset: 0; z-index: <high>; pointer-events: none; }`
- Add a small overlay manager module (new file), e.g. `src/ui/react/ReactOverlayManager.ts`:
  - Own a single React root.
  - Provide `mount(component)` and `unmount()`.
  - Compute overlay scaling from the canvas bounding box so layout coordinates stay consistent with Excalibur’s `engine.drawWidth/drawHeight`.
  - When mounted, set `#ui-overlay { pointer-events: auto; }`.

### 3. Implement React views for the two screens

Create two React components that render the same UI data currently shown by Excalibur Labels/Actors.

#### 3.1 Planet run menu view

- New file: `src/ui/react/views/PlanetRunMenuView.tsx`
- Props should include callbacks to trigger existing game logic:
  - `onStartRun()`, `onConfigureRover()`, `onSpaceship()`, `onRepairShip()`, `onExitToMainMenu()`, `onToggleTouch()`.
- Data sourcing (use existing modules as-is):
  - `getBank()`, `getOwnedItems()`, `getEquipped()`, `isShipRepaired()`, `canRepairShip()`, `canAffordAnyEquipment()`
  - `getCurrentSave()` + `generateGoalChoices()` + `setCurrentGoals()`
  - `getTouchControlsEnabled()` + `isTouchDeviceCapable()`.
- Rendering:
  - Title, bank label, 3 goal labels, and the buttons.
  - Configure button highlight/disabled state computed via `canAffordAnyEquipment(...)`.
- Update strategy:
  - Use local React state `tick` and increment it after any action that mutates `Progress`/`Saves` so the UI re-renders.

#### 3.2 Rover configure/upgrade view

- New file: `src/ui/react/views/ConfigureRoverView.tsx`
- Props should include callbacks:
  - `onStartMission()` and `onBackToPlanetRunMenu()`.
- Data sourcing:
  - Slots/equipment: `getEquipped()`, `getOwnedItems()`, `getUpgradeById()`, `DEFAULT_EQUIPPED_IDS`, `ALL_SLOT_IDS`, `getCatalogDefs()`, `canAffordCost()`, `formatCost()`, `purchaseEquipment()`, `setEquipped()`, `saveCurrentSave()`, `playClick()`.
  - Cargo: `getCargoLayout()`, `getCargoRows()`, `setCargoLayout()`, `setCargoRows()`.
- Interaction model (per your click-select preference):
  - Click an inventory chip to “select” that item.
  - Click a slot to equip the selected item (only if slot type matches); clicking a slot when nothing is selected resets to default (matches current behavior).
  - Clicking the background cancels selection.
- Tooltip:
  - On hover (inventory chips), show tooltip with description.
- Re-render strategy:
  - Same `tick` state approach after any purchase/equip/cargo change.

### 4. Wire React into Excalibur scenes (mount/unmount)

Replace the existing Excalibur actor-based UI construction in:

- `src/scenes/PlanetRunMenuScene.ts`
- `src/scenes/ConfigureRoverScene.ts`

For each scene:

- In `onActivate()`:
  - Mount the appropriate React component via the overlay manager.
  - Pass callbacks that call existing functions and perform scene transitions using `goToScene(engine, ...)`.
- In `onDeactivate()` (new override):
  - Unmount the React overlay to remove DOM nodes and event listeners.

Note: keep gameplay scenes (`PlanetScene`, etc.) as Excalibur-only; only these two UI screens move to React.

### 5. Confirm input + layering behavior

- While the overlay is mounted, it should receive pointer input and Excalibur should not interfere.
- Ensure the overlay sits above the canvas with `z-index`.
- Ensure any full-screen transitions still work (callbacks should call `requestFullscreen()` then navigate to `SCENE_KEYS.planet`).

### 6. Build + lint verification

- After code changes:
  - `npm run build`
  - `npm run lint`

---

## Key Files

- `[index.html](index.html)`: add `#ui-overlay` container.
- `[src/style.css](src/style.css)`: overlay positioning + pointer event rules.
- `[src/scenes/PlanetRunMenuScene.ts](src/scenes/PlanetRunMenuScene.ts)`: mount/unmount React instead of Excalibur Labels/Buttons.
- `[src/scenes/ConfigureRoverScene.ts](src/scenes/ConfigureRoverScene.ts)`: mount/unmount React instead of Excalibur UI actors.
- `[src/ui/react/ReactOverlayManager.ts](src/ui/react/ReactOverlayManager.ts)`: React root + scaling + pointer-events toggling.
- `[src/ui/react/views/PlanetRunMenuView.tsx](src/ui/react/views/PlanetRunMenuView.tsx)`: React HTML menu.
- `[src/ui/react/views/ConfigureRoverView.tsx](src/ui/react/views/ConfigureRoverView.tsx)`: React HTML upgrade screen.

