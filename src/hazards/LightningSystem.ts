import {
  Scene,
  vec,
  Circle,
  Color,
  Engine,
  Actor,
  CollisionType,
} from "excalibur";
import type { StormRegion } from "./StormRegion";
import type { IHazardTarget } from "../entities/Rover";
import { recordHazardHit } from "../state/GameState";
import {
  LIGHTNING_STRIKES_PER_MINUTE,
  LIGHTNING_BASE_WARNING_MS,
  LIGHTNING_STRIKE_RADIUS_PX,
  LIGHTNING_WARNING_VISUAL_RADIUS_MULTIPLIER,
  LIGHTNING_CHARGE_PHASE_MS,
  LIGHTNING_DAMAGE,
} from "../config/gameConfig";
import { random } from "../utils/seedRandom";
import { playThunder } from "../audio/sounds";

const VISUAL_RADIUS =
  LIGHTNING_STRIKE_RADIUS_PX * LIGHTNING_WARNING_VISUAL_RADIUS_MULTIPLIER;

interface PendingStrike {
  x: number;
  y: number;
  chargeEndAt: number;
  warningEndAt: number;
  warningActor: Actor | null;
  mainWarningShown: boolean;
}

export interface LightningSystemParams {
  scene: Scene;
  engine: Engine;
  rover: IHazardTarget;
  stormRegions: StormRegion[];
  /** Difficulty multiplier for strike rate (higher = more frequent). */
  strikeRateMultiplier: number;
  /** Difficulty multiplier for base warning time (e.g. 0.85 on hard). */
  warningTimeMultiplier: number;
  /** Extra warning time from rover equipment (ms). */
  roverWarningTimeMs?: number;
}

/**
 * Schedules lightning strikes at random times inside storm regions.
 * Warning ramp-up (charge phase then main warning), boundary-inclusive damage,
 * distance-scaled flash, shake, and thunder.
 */
export class LightningSystem {
  private scene: Scene;
  private engine: Engine;
  private rover: IHazardTarget;
  private stormRegions: StormRegion[];
  private strikeRateMultiplier: number;
  private warningTimeMultiplier: number;
  private roverWarningTimeMs: number;
  /** Per-storm: next time (clock ms) this storm should trigger a strike. */
  private nextStrikeAtByStorm = new Map<StormRegion, number>();
  private activeStrike: PendingStrike | null = null;

  constructor(params: LightningSystemParams) {
    this.scene = params.scene;
    this.engine = params.engine;
    this.rover = params.rover;
    this.stormRegions = params.stormRegions;
    this.strikeRateMultiplier = params.strikeRateMultiplier;
    this.warningTimeMultiplier = params.warningTimeMultiplier;
    this.roverWarningTimeMs = params.roverWarningTimeMs ?? 0;
  }

  /** Call once when system is ready; each storm gets its own first strike time. */
  start(): void {
    const now = this.engine.clock.now();
    for (const storm of this.stormRegions) {
      this.nextStrikeAtByStorm.set(storm, now + this.randomDelayMs());
    }
  }

  update(_deltaMs: number): void {
    const now = this.engine.clock.now();
    const roverPos = this.rover.getActor().pos;
    this.syncStormTimers(now);

    if (this.activeStrike) {
      if (now >= this.activeStrike.warningEndAt) {
        this.resolveStrike(roverPos.x, roverPos.y);
        this.activeStrike = null;
        return;
      }
      if (
        now >= this.activeStrike.chargeEndAt &&
        !this.activeStrike.mainWarningShown
      ) {
        if (
          this.activeStrike.warningActor &&
          !this.activeStrike.warningActor.isKilled()
        ) {
          this.activeStrike.warningActor.kill();
        }
        this.activeStrike.warningActor = null;
        this.showWarningCircle();
        this.activeStrike.mainWarningShown = true;
      }
      return;
    }

    for (const storm of this.stormRegions) {
      if (storm.isKilled()) continue;
      const nextAt = this.nextStrikeAtByStorm.get(storm) ?? 0;
      if (now >= nextAt) {
        const point = storm.getRandomPointInside();
        const baseWarning =
          LIGHTNING_BASE_WARNING_MS * this.warningTimeMultiplier +
          this.roverWarningTimeMs;
        this.activeStrike = {
          x: point.x,
          y: point.y,
          chargeEndAt: now + LIGHTNING_CHARGE_PHASE_MS,
          warningEndAt: now + LIGHTNING_CHARGE_PHASE_MS + baseWarning,
          warningActor: null,
          mainWarningShown: false,
        };
        this.nextStrikeAtByStorm.set(storm, now + this.randomDelayMs());
        this.showChargeCircle();
        break;
      }
    }
  }

  private randomDelayMs(): number {
    const rate = LIGHTNING_STRIKES_PER_MINUTE * this.strikeRateMultiplier;
    const meanIntervalMs = rate > 0 ? 60000 / rate : 30000;
    return meanIntervalMs * (0.5 + random());
  }

  private syncStormTimers(now: number): void {
    for (const storm of this.stormRegions) {
      if (storm.isKilled()) continue;
      if (!this.nextStrikeAtByStorm.has(storm)) {
        this.nextStrikeAtByStorm.set(storm, now + this.randomDelayMs());
      }
    }
    for (const storm of this.nextStrikeAtByStorm.keys()) {
      if (storm.isKilled() || !this.stormRegions.includes(storm)) {
        this.nextStrikeAtByStorm.delete(storm);
      }
    }
  }

  private showChargeCircle(): void {
    if (!this.activeStrike) return;
    const radius = VISUAL_RADIUS * 0.6;
    const circle = new Actor({
      x: this.activeStrike.x,
      y: this.activeStrike.y,
      width: radius * 2,
      height: radius * 2,
      anchor: vec(0.5, 0.5),
    });
    const graphic = new Circle({
      radius,
      color: Color.fromRGB(0, 0, 0, 0),
      strokeColor: Color.fromRGB(250, 204, 21, 0.8),
      lineWidth: 1,
    });
    graphic.origin = vec(radius, radius);
    circle.graphics.use(graphic);
    circle.body.collisionType = CollisionType.PreventCollision;
    this.addFlashingOutline(circle, graphic, 140);
    this.scene.add(circle);
    this.activeStrike.warningActor = circle;
    circle.actions.delay(LIGHTNING_CHARGE_PHASE_MS).callMethod(() => {
      if (circle && !circle.isKilled()) circle.kill();
    });
  }

  private showWarningCircle(): void {
    if (!this.activeStrike) return;
    const circle = new Actor({
      x: this.activeStrike.x,
      y: this.activeStrike.y,
      width: VISUAL_RADIUS * 2,
      height: VISUAL_RADIUS * 2,
      anchor: vec(0.5, 0.5),
    });
    const graphic = new Circle({
      radius: VISUAL_RADIUS,
      color: Color.fromRGB(0, 0, 0, 0),
      strokeColor: Color.fromRGB(250, 204, 21, 1),
      lineWidth: 1,
    });
    graphic.origin = vec(VISUAL_RADIUS, VISUAL_RADIUS);
    circle.graphics.use(graphic);
    circle.body.collisionType = CollisionType.PreventCollision;
    this.addFlashingOutline(circle, graphic, 100);
    this.scene.add(circle);
    this.activeStrike.warningActor = circle;
  }

  /** Pulse the outline opacity for a flashing effect. */
  private addFlashingOutline(
    actor: Actor,
    graphic: Circle,
    periodMs: number
  ): void {
    actor.on("preupdate", () => {
      if (actor.isKilled()) return;
      const t = this.engine.clock.now() / periodMs;
      graphic.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
    });
  }

  private resolveStrike(roverX: number, roverY: number): void {
    if (!this.activeStrike) return;
    const { x, y } = this.activeStrike;
    if (
      this.activeStrike.warningActor &&
      !this.activeStrike.warningActor.isKilled()
    ) {
      this.activeStrike.warningActor.kill();
    }

    const dx = roverX - x;
    const dy = roverY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inDamageZone = dist <= LIGHTNING_STRIKE_RADIUS_PX;
    if (inDamageZone) {
      this.rover.takeDamage(LIGHTNING_DAMAGE, "lightning");
      recordHazardHit("lightning");
    }

    const maxDist = 400;
    const normalizedDist = Math.min(1, dist / maxDist);
    const flashIntensity = 1 - normalizedDist * 0.4;
    this.showFlash(flashIntensity);
    this.engine.currentScene.camera.shake(6, 6, 250);

    const thunderDelayMs = Math.floor(normalizedDist * 800);
    const thunderVolume = Math.max(0.15, 0.6 - normalizedDist * 0.5);
    playThunder(thunderDelayMs, thunderVolume);
  }

  private showFlash(intensity: number): void {
    const screen = this.scene.engine.screen;
    const w = screen.viewport.width;
    const h = screen.viewport.height;
    const cam = this.scene.camera;
    const flash = new Actor({
      x: cam.x,
      y: cam.y,
      width: w + 100,
      height: h + 100,
      anchor: vec(0.5, 0.5),
    });
    const graphic = new Circle({
      radius: w,
      color: Color.fromRGB(255, 255, 255, intensity * 0.5),
    });
    graphic.origin = vec(w, w);
    flash.graphics.use(graphic);
    flash.body.collisionType = CollisionType.PreventCollision;
    flash.z = 10000;
    this.scene.add(flash);
    let life = 200;
    flash.on("preupdate", () => {
      life -= this.engine.clock.elapsed();
      if (life <= 0) {
        flash.kill();
      } else {
        flash.graphics.opacity = (life / 200) * intensity * 0.5;
      }
    });
  }

  dispose(): void {
    if (
      this.activeStrike?.warningActor &&
      !this.activeStrike.warningActor.isKilled()
    ) {
      this.activeStrike.warningActor.kill();
    }
    this.activeStrike = null;
    this.nextStrikeAtByStorm.clear();
  }
}
