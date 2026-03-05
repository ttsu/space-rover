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
import { ResourceNode } from "../entities/ResourceNode";
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
import { Hud, type BaseIndicator } from "../ui/Hud";
import { TouchControls } from "../ui/TouchControls";
import {
  getTouchControlsEnabled,
  setTouchControlsEnabled,
} from "../input/TouchInputState";
import { getCurrentSave, saveCurrentSave } from "../state/Saves";
import {
  getCargoLayout,
  getEquipped,
  getMaxCargoFromLayout,
  getOwnedItems,
} from "../state/Progress";
import { computeEffectiveRoverStatsFromEquipped } from "../upgrades/RoverStats";
import { setSeed } from "../utils/seedRandom";
import { burst } from "../effects/Particles";
import { playBlaster, playDamage } from "../audio/sounds";
import {
  triggerReturnToBase as runFlowReturnToBase,
  triggerDeath as runFlowDeath,
} from "./runFlow";
import { getWindVelocityDelta } from "../hazards/WindSystem";
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
  private lightningSystem: LightningSystem | null = null;
  private chunkManager: ChunkManager | null = null;
  private worldState: WorldState | null = null;
  private quakeTimer = 0;
  private windHitTimer = 0;
  private sandstormHitTimer = 0;
  private runEnded = false;

  constructor(_engine: Engine) {
    super();
  }

  onActivate() {
    resetRunTracking();
    const save = getCurrentSave();
    if (!save) {
      this.engine.goToScene("mainMenu");
      return;
    }
    this.lightningSystem?.dispose();
    this.chunkManager?.destroy();
    for (const a of this.worldActors) a.kill();
    this.worldActors = [];
    this.stormRegions = [];
    this.windRegions = [];
    this.sandstormRegions = [];
    this.chunkManager = null;
    setSeed(save.seed);
    this.worldState = worldStateFromSave(save.worldState);
    setActiveWorldState(this.worldState);
    const base = new BaseLander(TILE_SIZE / 2, TILE_SIZE / 2);
    this.add(base);
    this.worldActors.push(base);
    this.basePos = base.pos.clone();
    this.chunkManager = new ChunkManager({
      scene: this,
      hazardTarget: this.rover,
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
    this.runEnded = false;
    this.windHitTimer = 0;
    this.sandstormHitTimer = 0;
    this.rover.setVisibilityRadiusMultiplier(1);
    if (this.rover) {
      this.rover.resetForNewMission();
      this.rover.pos.x = this.basePos.x;
      this.rover.pos.y = this.basePos.y - TILE_SIZE;
    }
  }

  onInitialize() {
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

    this.rover.events.on("damage", (evt: unknown) => {
      const e = evt as { amount: number };
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

    this.rover.events.on("fireblaster", (evt: unknown) => {
      const e = evt as {
        x: number;
        y: number;
        angle: number;
        damage: number;
        speed: number;
        range: number;
      };
      playBlaster();
      const seeking = this.rover.roverStats.blasterBehavior === 2;
      const target = seeking
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
    });

    this.rover.events.on("batterydepleted", () => {
      this.triggerDeath();
    });

    this.hud = new Hud(this.engine, this.rover);
    this.hud.z = 1000;
    this.add(this.hud);

    if (getTouchControlsEnabled()) {
      this.addTouchControlsOverlay();
    }

    this.camera.strategy.lockToActor(this.rover);

    this.world.add(new FogVisibilitySystem(this.world, this.rover));
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
    let inSandstorm = false;
    for (const sandstorm of this.sandstormRegions) {
      if (sandstorm.isKilled()) continue;
      if (!sandstorm.containsWorldPoint(this.rover.pos.x, this.rover.pos.y)) {
        continue;
      }
      inSandstorm = true;
      sandstormVisibilityMultiplier = Math.min(
        sandstormVisibilityMultiplier,
        sandstorm.visibilityMultiplier
      );
    }
    this.rover.setVisibilityRadiusMultiplier(sandstormVisibilityMultiplier);

    const baseIndicator = this.getBaseIndicator();
    this.hud.updateFromState(
      closeToBase,
      GameState.currentHazardsHit,
      biomeLabel(biomeId),
      baseIndicator
    );

    if (this.returnToShipBtn) {
      this.returnToShipBtn.graphics.isVisible = !this.runEnded && closeToBase;
    }

    this.applyMagnetism(delta);
    this.rover.windEffectThisFrame = getWindVelocityDelta(
      this.rover,
      this.windRegions,
      this.stormRegions,
      this.sandstormRegions,
      delta
    );
    const wind = this.rover.windEffectThisFrame;
    if (wind.x !== 0 || wind.y !== 0) {
      this.windHitTimer += delta;
      if (this.windHitTimer >= 800) {
        this.windHitTimer = 0;
        recordHazardHit("wind");
      }
    } else {
      this.windHitTimer = 0;
    }
    if (inSandstorm) {
      this.sandstormHitTimer += delta;
      if (this.sandstormHitTimer >= 800) {
        this.sandstormHitTimer = 0;
        recordHazardHit("sandstorm");
      }
    } else {
      this.sandstormHitTimer = 0;
    }
    this.lightningSystem?.update(delta);
  }

  /**
   * When base is off-screen, returns position and angle for the edge arrow; otherwise null.
   */
  private getBaseIndicator(): BaseIndicator | null {
    const w = this.engine.drawWidth;
    const h = this.engine.drawHeight;
    const margin = 48;
    const halfW = w / 2;
    const halfH = h / 2;
    const cam = this.camera.pos;
    const baseScreenX = this.basePos.x - cam.x + halfW;
    const baseScreenY = this.basePos.y - cam.y + halfH;

    if (
      baseScreenX >= margin &&
      baseScreenX <= w - margin &&
      baseScreenY >= margin &&
      baseScreenY <= h - margin
    ) {
      return null;
    }

    const dx = baseScreenX - halfW;
    const dy = baseScreenY - halfH;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const ux = dx / len;
    const uy = dy / len;

    const edgeMargin = 36;
    const left = edgeMargin;
    const right = w - edgeMargin;
    const top = edgeMargin;
    const bottom = h - edgeMargin;

    let t = Infinity;
    if (ux > 0) t = Math.min(t, (right - halfW) / ux);
    else if (ux < 0) t = Math.min(t, (left - halfW) / ux);
    if (uy > 0) t = Math.min(t, (bottom - halfH) / uy);
    else if (uy < 0) t = Math.min(t, (top - halfH) / uy);

    if (t === Infinity || t <= 0) return null;
    const screenX = halfW + ux * t;
    const screenY = halfH + uy * t;
    const angleRad = Math.atan2(dy, dx);
    return { screenX, screenY, angleRad };
  }

  private persistWorldState(): void {
    if (!this.worldState) return;
    const save = getCurrentSave();
    if (!save) return;
    save.worldState = worldStateToSave(this.worldState);
    try {
      saveCurrentSave();
    } catch {
      // Avoid hard-crashing gameplay if storage quota is hit.
    }
  }

  private applyMagnetism(delta: number): void {
    const magnetism = this.rover.roverStats.magnetism;
    if (magnetism <= 0) return;
    const roverPos = this.rover.pos;
    const attractionSpeed = 80;
    for (const actor of this.actors) {
      if (actor instanceof ResourceNode && !actor.isKilled()) {
        const dist = actor.pos.distance(roverPos);
        if (dist > 0 && dist < magnetism) {
          const toRover = roverPos.sub(actor.pos).normalize();
          actor.vel = toRover.scale(attractionSpeed * (delta / 1000));
        } else {
          actor.vel = vec(0, 0);
        }
      }
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
