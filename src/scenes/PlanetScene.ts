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
  type ExcaliburGraphicsContext,
} from "excalibur";
import { Button } from "../ui/Button";
import { Rover } from "../entities/Rover";
import { BlasterProjectile } from "../entities/BlasterProjectile";
import { BaseLander } from "../entities/BaseLander";
import { FogVisibilitySystem, drawFogOverlay } from "../world/FogOfWar";
import {
  ICE_ACCELERATION_SCALE,
  ICE_TRACTION_SCALE,
  TILE_SIZE,
} from "../config/gameConfig";
import {
  resetRunTracking,
  GameState,
  recordHazardHit,
} from "../state/GameState";
import { Hud } from "../ui/Hud";
import { getEdgeIndicator } from "../utils/edgeIndicator";
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
import { LightningSystem } from "../hazards/LightningSystem";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";
import { ChunkManager } from "../world/ChunkManager";
import {
  setActiveWorldState,
  worldStateFromSave,
  worldStateToSave,
  type WorldState,
} from "../world/WorldState";
import { biomeLabel } from "../config/biomeConfig";
import { HazardTargetRegistry } from "../hazards/HazardTargetRegistry";
import { PlanetWindSystem } from "../systems/PlanetWindSystem";
import { PlanetLightningUpdateSystem } from "../systems/PlanetLightningUpdateSystem";
import { MagnetismSystem } from "../systems/MagnetismSystem";
import {
  emitSceneEvent,
  onSceneEvent,
  type HudSnapshotEvent,
  type ProjectileSpawnRequestedEvent,
  type RoverDamageEvent,
  type RoverFireBlasterEvent,
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
  private lightningSystem: LightningSystem | null = null;
  private lightningUpdateSystem: PlanetLightningUpdateSystem | null = null;
  private windSystem: PlanetWindSystem | null = null;
  private chunkManager: ChunkManager | null = null;
  private worldState: WorldState | null = null;
  private quakeTimer = 0;
  private runEnded = false;
  private hasInitializedActors = false;

  constructor(_engine: Engine) {
    super();
  }

  onActivate() {
    this.ensureCoreActorsInitialized();
    resetRunTracking();
    const save = getCurrentSave();
    if (!save) {
      this.engine.goToScene("mainMenu");
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
    this.stormRegions.length = 0;
    this.windRegions.length = 0;
    this.sandstormRegions.length = 0;
    this.chunkManager = null;
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
      difficulty: save.difficulty,
      seed: save.seed,
      biomePreset: save.biomePreset ?? "mixed",
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
    this.windSystem?.reset();
    this.rover.setVisibilityRadiusMultiplier(1);
    this.rover.resetForNewMission();
    this.rover.pos.x = this.basePos.x;
    this.rover.pos.y = this.basePos.y - TILE_SIZE;
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
      emitSceneEvent(this, "runEnded", { reason: "death" });
      this.triggerDeath();
    });

    this.hud = new Hud(this.engine);
    this.hud.z = 1000;
    this.add(this.hud);

    if (getTouchControlsEnabled()) {
      this.addTouchControlsOverlay();
    }

    this.camera.strategy.lockToActor(this.rover);

    this.world.add(new FogVisibilitySystem(this.world, this.rover));
    this.world.add(new MagnetismSystem(this.world, this.rover));
    this.windSystem = new PlanetWindSystem({
      rover: this.rover,
      windRegions: this.windRegions,
      stormRegions: this.stormRegions,
      sandstormRegions: this.sandstormRegions,
    });
    this.world.add(this.windSystem);
  }

  onPostDraw(ctx: ExcaliburGraphicsContext, _elapsed: number): void {
    drawFogOverlay(
      ctx,
      this.rover,
      this.camera,
      this.engine.drawWidth,
      this.engine.drawHeight
    );
  }

  private static readonly RETURN_BUTTON_WIDTH = 220;
  private static readonly RETURN_BUTTON_HEIGHT = 52;

  private addTouchControlsOverlay(): void {
    const tc = new TouchControls(this.engine);
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
      text: "Return to ship",
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

  private triggerReturnToBase(): void {
    this.runEnded = true;
    emitSceneEvent(this, "runEnded", { reason: "return" });
    this.persistWorldState();
    runFlowReturnToBase(this, this.engine, this.rover, this.basePos);
  }

  private triggerDeath(): void {
    this.runEnded = true;
    this.persistWorldState();
    runFlowDeath(this, this.engine, this.rover);
  }

  onDeactivate(): void {
    this.lightningSystem?.dispose();
    if (this.lightningUpdateSystem) {
      this.world.remove(this.lightningUpdateSystem);
      this.lightningUpdateSystem = null;
    }
    this.chunkManager?.destroy();
    this.chunkManager = null;
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

    if (!this.runEnded) {
      this.chunkManager?.update(this.rover.pos.x, this.rover.pos.y);
    }

    const distanceToBase = this.rover.pos.distance(this.basePos);
    const closeToBase = distanceToBase < 80;

    if (!this.runEnded && closeToBase) {
      const keyboard = engine.input.keyboard;
      if (keyboard.wasPressed(Keys.Enter)) {
        this.triggerReturnToBase();
      }
    }

    this.quakeTimer += delta;
    if (this.quakeTimer > 15000) {
      this.quakeTimer = 0;
      this.engine.currentScene.camera.shake(5, 5, 500);
      recordHazardHit("quake");
    }

    const biomeId = this.chunkManager
      ? this.chunkManager.getBiomeAtWorldPos(this.rover.pos.x, this.rover.pos.y)
      : "barren";

    const onIcePatch = this.chunkManager
      ? this.chunkManager.isIceHazardAtWorldPos(
          this.rover.pos.x,
          this.rover.pos.y
        )
      : false;
    this.rover.setDriveModifiersThisFrame(
      onIcePatch ? ICE_ACCELERATION_SCALE : 1,
      onIcePatch ? ICE_TRACTION_SCALE : 1
    );

    let sandstormVisibilityMultiplier = 1;
    for (const sandstorm of this.sandstormRegions) {
      if (sandstorm.isKilled()) continue;
      if (!sandstorm.containsWorldPoint(this.rover.pos.x, this.rover.pos.y)) {
        continue;
      }
      sandstormVisibilityMultiplier = Math.min(
        sandstormVisibilityMultiplier,
        sandstorm.visibilityMultiplier
      );
    }
    this.rover.setVisibilityRadiusMultiplier(sandstormVisibilityMultiplier);

    const baseIndicator = getEdgeIndicator(
      this.basePos.x,
      this.basePos.y,
      this.camera.pos,
      this.engine.drawWidth,
      this.engine.drawHeight
    );
    const hudSnapshot: HudSnapshotEvent = {
      health: this.rover.health,
      battery: this.rover.battery,
      usedCapacity: this.rover.usedCapacity,
      maxCapacity: this.rover.maxCapacity,
      cargo: { ...this.rover.cargo },
      biomeName: biomeLabel(biomeId),
      isNearBase: closeToBase,
      baseIndicator,
      hazardHits: { ...GameState.currentHazardsHit },
    };
    emitSceneEvent(this, "hud:update", hudSnapshot);

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
    const from = vec(fromX, fromY);
    let nearest: Actor | undefined;
    let nearestDist = Infinity;
    for (const actor of this.actors) {
      if (actor === this.rover) continue;
      const target = actor as { takeBlasterDamage?: (n: number) => void };
      if (typeof target.takeBlasterDamage !== "function") continue;
      const d = actor.pos.distance(from);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = actor;
      }
    }
    return nearest;
  }
}
