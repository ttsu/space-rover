import {
  Color,
  Engine,
  Scene,
  vec,
  Font,
  FontUnit,
  Keys,
  ScreenElement,
  Actor,
  CollisionType,
  type ExcaliburGraphicsContext,
} from "excalibur";
import { Button } from "../ui/Button";
import { Rover } from "../entities/Rover";
import { BlasterProjectile } from "../entities/BlasterProjectile";
import { BaseLander } from "../entities/BaseLander";
import {
  FogVisibilitySystem,
  drawFogOverlay,
  getPrimaryFogViewerData,
} from "../world/FogOfWar";
import { TILE_SIZE } from "../config/gameConfig";
import { resetRunTracking, GameState } from "../state/GameState";
import { Hud } from "../ui/Hud";
import { TouchControls } from "../ui/TouchControls";
import {
  getTouchControlsEnabled,
  setTouchControlsEnabled,
} from "../input/TouchInputState";
import { getCurrentSave } from "../state/Saves";
import {
  getCargoLayout,
  getEquipped,
  getMaxCargoFromLayout,
  getOwnedItems,
  getCurrentPlanetId,
  getWorldStateSaveForPlanet,
  setWorldStateSaveForPlanet,
} from "../state/Progress";
import { computeEffectiveRoverStatsFromEquipped } from "../upgrades/RoverStats";
import { setSeed } from "../utils/seedRandom";
import { burst } from "../effects/Particles";
import { playBlaster, playDamage } from "../audio/sounds";
import {
  triggerReturnToBase as runFlowReturnToBase,
  triggerDeath as runFlowDeath,
} from "./runFlow";
import type { WindRegion } from "../hazards/WindRegion";
import type { StormRegion } from "../hazards/StormRegion";
import type { SandstormRegion } from "../hazards/SandstormRegion";
import { ResourceNode } from "../entities/ResourceNode";
import { ResourceDeposit } from "../entities/ResourceDeposit";
import { DroppedCargoPile } from "../entities/DroppedCargoPile";
import { LightningSystem } from "../hazards/LightningSystem";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";
import { ChunkManager } from "../world/ChunkManager";
import { MinimapTileQuery } from "../world/MinimapTileQuery";
import {
  addDroppedCargo,
  isCargoEmpty,
  setActiveWorldState,
  worldStateFromSave,
  worldStateToSave,
  tileKey,
  worldToTile,
  type WorldState,
} from "../world/WorldState";
import { biomeLabel } from "../config/biomeConfig";
import { HazardTargetRegistry } from "../hazards/HazardTargetRegistry";
import { PlanetWindSystem } from "../systems/PlanetWindSystem";
import { PlanetLightningUpdateSystem } from "../systems/PlanetLightningUpdateSystem";
import { MagnetismSystem } from "../systems/MagnetismSystem";
import { PlayerTagComponent } from "../world/components/PlayerComponents";
import { PlanetRunController } from "./PlanetRunController";
import { BlasterTargetRegistry } from "../hazards/BlasterTargetRegistry";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";
import {
  emitSceneEvent,
  onSceneEvent,
  type HudContextEvent,
  type MinimapContextEvent,
  type MinimapHazardRegion,
  type MinimapHazardTile,
  type MinimapResourceDot,
  type ProjectileSpawnRequestedEvent,
  type RoverDamageEvent,
  type RoverFireBlasterEvent,
  type RoverStateChangedEvent,
} from "../events/GameEvents";

const TOUCH_TOGGLE_KEY = Keys.T;

export class PlanetScene extends Scene {
  private rover!: Rover;
  private hud!: Hud;
  private returnToShipBtn?: Button;
  private touchControlsOverlay?: TouchControls;
  private touchReturnContainer?: ScreenElement;
  private basePos = vec(0, 0);
  private worldActors: Actor[] = [];
  private stormRegions: StormRegion[] = [];
  private windRegions: WindRegion[] = [];
  private sandstormRegions: SandstormRegion[] = [];
  private hazardTargetRegistry = new HazardTargetRegistry();
  private blasterTargetRegistry = new BlasterTargetRegistry();
  private lightningSystem: LightningSystem | null = null;
  private lightningUpdateSystem: PlanetLightningUpdateSystem | null = null;
  private windSystem: PlanetWindSystem | null = null;
  private chunkManager: ChunkManager | null = null;
  private runController: PlanetRunController | null = null;
  private worldState: WorldState | null = null;
  private minimapTileQuery: MinimapTileQuery | null = null;
  private runEnded = false;
  private hasInitializedActors = false;
  private isPlayerInBaseTrigger = false;
  private baseReturnTrigger?: Actor;

  constructor(_engine: Engine) {
    super();
  }

  onActivate() {
    this.ensureCoreActorsInitialized();
    if (getTouchControlsEnabled() && !this.touchControlsOverlay) {
      this.addTouchControlsOverlay();
    }
    resetRunTracking();
    const save = getCurrentSave();
    if (!save) {
      goToScene(this.engine, SCENE_KEYS.mainMenu);
      return;
    }
    this.lightningSystem?.dispose();
    if (this.lightningUpdateSystem) {
      this.world.remove(this.lightningUpdateSystem);
      this.lightningUpdateSystem = null;
    }
    this.chunkManager?.destroy();
    for (const a of this.worldActors) a.kill();
    this.worldActors.length = 0;
    this.blasterTargetRegistry.clear();
    this.stormRegions.length = 0;
    this.windRegions.length = 0;
    this.sandstormRegions.length = 0;
    this.chunkManager = null;
    this.minimapTileQuery = null;
    setSeed(save.seed);
    const planetId = getCurrentPlanetId();
    this.worldState = worldStateFromSave(getWorldStateSaveForPlanet(planetId));
    setActiveWorldState(this.worldState);
    const base = new BaseLander(TILE_SIZE / 2, TILE_SIZE / 2);
    this.add(base);
    this.worldActors.push(base);
    this.basePos = base.pos.clone();
    this.chunkManager = new ChunkManager({
      scene: this,
      hazardTargetRegistry: this.hazardTargetRegistry,
      blasterTargetRegistry: this.blasterTargetRegistry,
      difficulty: save.difficulty,
      seed: save.seed,
      biomePreset: save.biomePreset ?? "barren",
      worldActors: this.worldActors,
      stormRegions: this.stormRegions,
      windRegions: this.windRegions,
      sandstormRegions: this.sandstormRegions,
      worldState: this.worldState,
    });
    const mult = DIFFICULTY_MULTIPLIERS[save.difficulty];
    this.lightningSystem = new LightningSystem({
      scene: this,
      engine: this.engine,
      rover: this.rover,
      stormRegions: this.stormRegions,
      strikeRateMultiplier: mult.lightningStrikeRate,
      warningTimeMultiplier: mult.lightningWarningTimeMultiplier,
      roverWarningTimeMs: this.rover.roverStats.lightningWarningTime,
    });
    this.lightningSystem.start();
    this.lightningUpdateSystem = new PlanetLightningUpdateSystem(
      this.lightningSystem
    );
    this.world.add(this.lightningUpdateSystem);
    this.runEnded = false;
    this.isPlayerInBaseTrigger = false;
    this.windSystem?.reset();
    this.rover.setVisibilityRadiusMultiplier(1);
    this.rover.resetForNewMission();
    this.rover.pos.x = this.basePos.x;
    this.rover.pos.y = this.basePos.y - TILE_SIZE;
    if (!this.runController) {
      this.runController = new PlanetRunController({
        basePos: this.basePos,
        sandstormRegions: this.sandstormRegions,
        chunkManager: this.chunkManager,
      });
    }
    this.runController?.reset({
      basePos: this.basePos,
      sandstormRegions: this.sandstormRegions,
      chunkManager: this.chunkManager,
    });
    this.minimapTileQuery = new MinimapTileQuery({
      seed: save.seed,
      worldState: this.worldState,
      difficulty: save.difficulty,
      biomePreset: save.biomePreset ?? "barren",
    });
    this.setupBaseReturnTrigger();
    this.spawnDroppedCargoPiles();
  }

  private spawnDroppedCargoPiles(): void {
    if (!this.worldState) return;
    const state = this.worldState;
    for (const entry of state.droppedCargo) {
      if (isCargoEmpty(entry.cargo)) continue;
      const onEmpty = () => {
        const i = state.droppedCargo.indexOf(entry);
        if (i >= 0) state.droppedCargo.splice(i, 1);
      };
      const pile = new DroppedCargoPile(entry, onEmpty);
      this.add(pile);
      this.worldActors.push(pile);
    }
  }

  onInitialize() {
    this.ensureCoreActorsInitialized();
  }

  private ensureCoreActorsInitialized(): void {
    if (this.hasInitializedActors) return;
    this.hasInitializedActors = true;
    this.engine.backgroundColor = Color.fromHex("#020617");

    const stats = computeEffectiveRoverStatsFromEquipped(
      getEquipped(),
      getOwnedItems()
    );
    const cargoConfig = getMaxCargoFromLayout(getCargoLayout());
    this.rover = new Rover(
      this.engine.drawWidth / 2,
      this.engine.drawHeight / 2,
      stats,
      cargoConfig
    );
    this.add(this.rover);
    this.hazardTargetRegistry.register(this.rover);

    onSceneEvent<RoverDamageEvent>(this, "playerDamaged", (e) => {
      playDamage();
      this.engine.currentScene.camera.shake(4, 4, 200);
      const r = this.rover.pos;
      burst(this, r.x, r.y, {
        color: Color.fromHex("#ef4444"),
        count: 5 + Math.min(e.amount, 3),
        speedMin: 30,
        speedMax: 90,
        lifetimeMs: 350,
        sizeMin: 3,
        sizeMax: 7,
      });
    });

    onSceneEvent<ProjectileSpawnRequestedEvent>(
      this,
      "projectileSpawnRequested",
      (e) => {
        playBlaster();
        const target = e.seeking
          ? this.findNearestBlasterTarget(e.x, e.y)
          : undefined;
        const proj = new BlasterProjectile(
          e.x,
          e.y,
          e.angle,
          e.damage,
          e.speed,
          e.range,
          target
        );
        this.add(proj);
      }
    );

    this.rover.events.on("damage", (evt) => {
      emitSceneEvent(this, "playerDamaged", evt as RoverDamageEvent);
    });

    this.rover.events.on("fireblaster", (evt) => {
      const e = evt as RoverFireBlasterEvent;
      emitSceneEvent(this, "projectileSpawnRequested", {
        ...e,
        seeking: this.rover.roverStats.blasterBehavior === 2,
      } satisfies ProjectileSpawnRequestedEvent);
    });

    this.rover.events.on("batterydepleted", () => {
      if (this.runEnded) return;
      emitSceneEvent(this, "runEnded", { reason: "death" });
      this.triggerDeath();
    });
    this.rover.events.on("statechanged", (evt) => {
      emitSceneEvent(this, "hud:state", evt as RoverStateChangedEvent);
    });

    this.hud = new Hud(this.engine);
    this.hud.z = 1000;
    this.add(this.hud);

    if (getTouchControlsEnabled()) {
      this.addTouchControlsOverlay();
    }

    this.camera.strategy.lockToActor(this.rover);

    this.world.add(new FogVisibilitySystem(this.world, this));
    this.world.add(new MagnetismSystem(this.world));
    this.windSystem = new PlanetWindSystem({
      world: this.world,
      windRegions: this.windRegions,
      stormRegions: this.stormRegions,
      sandstormRegions: this.sandstormRegions,
    });
    this.world.add(this.windSystem);
    this.runController = new PlanetRunController({
      basePos: this.basePos,
      sandstormRegions: this.sandstormRegions,
      chunkManager: this.chunkManager,
    });
    this.setupBaseReturnTrigger();
  }

  onPostDraw(ctx: ExcaliburGraphicsContext, _elapsed: number): void {
    const viewer = getPrimaryFogViewerData(this.world);
    if (!viewer) return;
    drawFogOverlay(
      ctx,
      viewer.pos,
      viewer.visibilityRadiusTiles,
      this.camera,
      this.engine.drawWidth,
      this.engine.drawHeight
    );
  }

  private static readonly RETURN_BUTTON_WIDTH = 220;
  private static readonly RETURN_BUTTON_HEIGHT = 52;

  private addTouchControlsOverlay(): void {
    const tc = new TouchControls(this.engine, "planet-simple");
    this.touchControlsOverlay = tc;
    this.add(tc);
    const returnContainer = new ScreenElement({ x: 0, y: 0 });
    returnContainer.z = 1000;
    this.touchReturnContainer = returnContainer;
    const cx = this.engine.drawWidth / 2;
    const by = this.engine.drawHeight - 40;
    const returnBtn = new Button({
      pos: vec(cx, by),
      width: PlanetScene.RETURN_BUTTON_WIDTH,
      height: PlanetScene.RETURN_BUTTON_HEIGHT,
      text: "Go Home",
      color: Color.fromHex("#1c1917"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        if (this.runEnded) return;
        this.triggerReturnToBase();
      },
    });
    returnBtn.graphics.isVisible = false;
    this.returnToShipBtn = returnBtn;
    returnContainer.addChild(returnBtn);
    this.add(returnContainer);
  }

  private removeTouchControlsOverlay(): void {
    if (this.touchControlsOverlay) {
      this.touchControlsOverlay.kill();
      this.touchControlsOverlay = undefined;
    }
    if (this.touchReturnContainer) {
      this.returnToShipBtn = undefined;
      this.touchReturnContainer.kill();
      this.touchReturnContainer = undefined;
    }
  }

  private setupBaseReturnTrigger(): void {
    this.baseReturnTrigger?.kill();
    const trigger = new Actor({
      pos: this.basePos.clone(),
      width: 160,
      height: 160,
      anchor: vec(0.5, 0.5),
      color: Color.Transparent,
    });
    trigger.body.collisionType = CollisionType.Passive;
    trigger.on("collisionstart", (evt) => {
      if (evt.other.owner.get(PlayerTagComponent)) {
        this.isPlayerInBaseTrigger = true;
      }
    });
    trigger.on("collisionend", (evt) => {
      if (evt.other.owner.get(PlayerTagComponent)) {
        this.isPlayerInBaseTrigger = false;
      }
    });
    this.baseReturnTrigger = trigger;
    this.add(trigger);
    this.worldActors.push(trigger);
  }

  private triggerReturnToBase(): void {
    if (this.runEnded) return;
    this.runEnded = true;
    emitSceneEvent(this, "runEnded", { reason: "return" });
    this.persistWorldState();
    runFlowReturnToBase(
      this,
      this.engine,
      {
        cargo: this.rover.cargo,
        usedCapacity: this.rover.usedCapacity,
        maxCapacity: this.rover.maxCapacity,
        health: this.rover.health,
        pos: this.rover.pos.clone(),
        moveTo: (target, speed) => this.rover.actions.moveTo(target, speed),
      },
      this.basePos
    );
  }

  private triggerDeath(): void {
    if (this.runEnded) return;
    this.runEnded = true;
    if (this.worldState && !isCargoEmpty(this.rover.cargo)) {
      addDroppedCargo(
        this.worldState,
        this.rover.pos.x,
        this.rover.pos.y,
        this.rover.cargo
      );
    }
    this.persistWorldState();
    runFlowDeath(this, this.engine, {
      cargo: this.rover.cargo,
      usedCapacity: this.rover.usedCapacity,
      maxCapacity: this.rover.maxCapacity,
      health: this.rover.health,
      pos: this.rover.pos.clone(),
    });
  }

  onDeactivate(): void {
    this.lightningSystem?.dispose();
    if (this.lightningUpdateSystem) {
      this.world.remove(this.lightningUpdateSystem);
      this.lightningUpdateSystem = null;
    }
    this.chunkManager?.destroy();
    this.chunkManager = null;
    this.minimapTileQuery = null;
    this.lightningSystem = null;
    setActiveWorldState(null);
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (engine.input.keyboard.wasPressed(TOUCH_TOGGLE_KEY)) {
      const next = !getTouchControlsEnabled();
      setTouchControlsEnabled(next);
      if (next) {
        this.addTouchControlsOverlay();
      } else {
        this.removeTouchControlsOverlay();
      }
    }

    if (!this.runEnded && this.rover.health <= 0) {
      emitSceneEvent(this, "runEnded", { reason: "death" });
      this.triggerDeath();
      return;
    }

    if (!this.runEnded && this.runController?.update(this.rover.pos, delta)) {
      this.engine.currentScene.camera.shake(5, 5, 500);
    }

    const runSnapshot = this.runController?.getSnapshot(
      this.rover.pos,
      this.camera.pos,
      this.engine.drawWidth,
      this.engine.drawHeight
    );
    const closeToBase =
      (runSnapshot?.isNearBase ?? false) || this.isPlayerInBaseTrigger;

    if (!this.runEnded && closeToBase) {
      const keyboard = engine.input.keyboard;
      if (keyboard.wasPressed(Keys.Enter)) {
        this.triggerReturnToBase();
      }
    }

    this.rover.setDriveModifiersThisFrame(
      runSnapshot?.accelerationScale ?? 1,
      runSnapshot?.tractionScale ?? 1
    );
    this.rover.setVisibilityRadiusMultiplier(
      runSnapshot?.visibilityMultiplier ?? 1
    );

    emitSceneEvent(this, "hud:context", {
      biomeName: runSnapshot?.biomeName ?? biomeLabel("barren"),
      isNearBase: closeToBase,
      baseIndicator: runSnapshot?.baseIndicator ?? null,
      hazardHits: { ...GameState.currentHazardsHit },
    } satisfies HudContextEvent);

    const viewer = getPrimaryFogViewerData(this.world);
    const stats = this.rover.roverStats;
    const options = {
      revealAllResources: (stats.minimapRevealAllResources ?? 0) > 0,
      showHazards: (stats.minimapShowHazards ?? 0) > 0,
      noFog: (stats.minimapNoFog ?? 0) > 0,
    };
    const resourceDots =
      options.revealAllResources && this.minimapTileQuery
        ? this.collectMinimapResourceDotsFromTileQuery()
        : this.collectMinimapResourceDots(GameState.exploredTileKeys);
    const hazardRegions = options.showHazards
      ? this.collectMinimapHazardRegions()
      : [];
    const hazardTiles =
      options.showHazards && this.minimapTileQuery
        ? this.collectMinimapHazardTiles()
        : [];
    emitSceneEvent(this, "minimap:context", {
      roverWorldPos: { x: this.rover.pos.x, y: this.rover.pos.y },
      baseWorldPos: { x: this.basePos.x, y: this.basePos.y },
      exploredTileKeys: GameState.exploredTileKeys,
      visibilityRadiusTiles: viewer?.visibilityRadiusTiles ?? 7,
      options,
      resourceDots,
      hazardRegions,
      hazardTiles,
    } satisfies MinimapContextEvent);

    if (this.returnToShipBtn) {
      this.returnToShipBtn.graphics.isVisible = !this.runEnded && closeToBase;
    }
  }

  private persistWorldState(): void {
    if (!this.worldState) return;
    try {
      setWorldStateSaveForPlanet(
        getCurrentPlanetId(),
        worldStateToSave(this.worldState)
      );
    } catch {
      // Avoid hard-crashing gameplay if storage quota is hit.
    }
  }

  private findNearestBlasterTarget(
    fromX: number,
    fromY: number
  ): Actor | undefined {
    return this.blasterTargetRegistry.findNearest(fromX, fromY);
  }

  /** Visible minimap tile radius (matches MinimapWidget VIEW_TILES_HALF). */
  private static readonly MINIMAP_VIEW_TILES_HALF = 64;

  private collectMinimapResourceDots(
    exploredTileKeys: Set<string>
  ): MinimapResourceDot[] {
    const dots: MinimapResourceDot[] = [];
    for (const actor of this.worldActors) {
      if (actor.isKilled()) continue;
      let resourceId: string | null = null;
      if (actor instanceof ResourceNode) {
        resourceId = actor.resource.id;
      } else if (actor instanceof ResourceDeposit) {
        resourceId = actor.resource.id;
      }
      if (!resourceId) continue;
      const pos = actor.globalPos;
      const { gx, gy } = worldToTile(pos.x, pos.y);
      if (!exploredTileKeys.has(tileKey(gx, gy))) continue;
      dots.push({ gx, gy, resourceId });
    }
    return dots;
  }

  private collectMinimapResourceDotsFromTileQuery(): MinimapResourceDot[] {
    const query = this.minimapTileQuery;
    if (!query) return [];
    const roverGx = Math.floor(this.rover.pos.x / TILE_SIZE);
    const roverGy = Math.floor(this.rover.pos.y / TILE_SIZE);
    const half = PlanetScene.MINIMAP_VIEW_TILES_HALF;
    const dots: MinimapResourceDot[] = [];
    for (let gy = roverGy - half; gy <= roverGy + half; gy++) {
      for (let gx = roverGx - half; gx <= roverGx + half; gx++) {
        const content = query.getTileContent(gx, gy);
        if (content.resource) {
          dots.push({ gx, gy, resourceId: content.resource });
        }
      }
    }
    return dots;
  }

  private collectMinimapHazardRegions(): MinimapHazardRegion[] {
    const regions: MinimapHazardRegion[] = [];
    for (const storm of this.stormRegions) {
      if (storm.isKilled()) continue;
      regions.push({
        x: storm.pos.x,
        y: storm.pos.y,
        radius: storm.radius,
        kind: "storm",
      });
    }
    for (const wind of this.windRegions) {
      if (wind.isKilled()) continue;
      regions.push({
        x: wind.pos.x,
        y: wind.pos.y,
        radius: wind.radius,
        kind: "wind",
      });
    }
    for (const sand of this.sandstormRegions) {
      if (sand.isKilled()) continue;
      regions.push({
        x: sand.pos.x,
        y: sand.pos.y,
        radius: sand.radius,
        kind: "sandstorm",
      });
    }
    return regions;
  }

  private collectMinimapHazardTiles(): MinimapHazardTile[] {
    const query = this.minimapTileQuery;
    if (!query) return [];
    const roverGx = Math.floor(this.rover.pos.x / TILE_SIZE);
    const roverGy = Math.floor(this.rover.pos.y / TILE_SIZE);
    const half = PlanetScene.MINIMAP_VIEW_TILES_HALF;
    const tiles: MinimapHazardTile[] = [];
    for (let gy = roverGy - half; gy <= roverGy + half; gy++) {
      for (let gx = roverGx - half; gx <= roverGx + half; gx++) {
        const content = query.getTileContent(gx, gy);
        if (content.hazard) {
          tiles.push({ gx, gy, hazard: content.hazard });
        }
      }
    }
    return tiles;
  }
}
