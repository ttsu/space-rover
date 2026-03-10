import {
  Actor,
  Color,
  CollisionType,
  Engine,
  Keys,
  SpriteSheet,
  vec,
  Shape,
} from "excalibur";
import type {
  RoverDamageEvent,
  RoverFireBlasterEvent,
  RoverStateChangedEvent,
} from "../events/GameEvents";
import type { ResourceId } from "../resources/ResourceTypes";
import { Resources } from "../resources";
import type { IHazardTarget, IResourceCollector } from "./contracts";
import {
  FogViewerComponent,
  MagnetismSourceComponent,
  PlayerTagComponent,
  WindReceiverComponent,
} from "../world/components/PlayerComponents";
import {
  getTouchInput,
  setTouchInput,
  getTouchControlsEnabled,
} from "../input/TouchInputState";
import {
  ROVER_SPRITE_COLUMNS,
  ROVER_SPRITE_HEIGHT,
  ROVER_SPRITE_ROWS,
  ROVER_SPRITE_WIDTH,
} from "../config/gameConfig";
import type { RoverStats } from "../upgrades/RoverStats";
import { getDamageReductionForType } from "../upgrades/RoverStats";
import type { DamageType } from "../types/DamageTypes";

export type CargoCounts = Record<ResourceId, number>;

export type BlasterSpawnFn = (
  x: number,
  y: number,
  angleRad: number,
  damage: number,
  speed: number,
  range: number
) => void;

/** Per-resource max capacity from cargo layout. If set, addResource/canPick enforce per-resource caps. */
export type CargoConfig = Record<ResourceId, number>;

export class Rover extends Actor implements IHazardTarget, IResourceCollector {
  maxCapacity: number;
  usedCapacity = 0;
  cargo: CargoCounts = {
    iron: 0,
    crystal: 0,
    gas: 0,
  };
  /** When set, each resource cannot exceed this (from cargo layout). */
  maxCargo?: CargoConfig;

  health: number;
  /** Current battery charge (seconds). When <= 0, rover is disabled. */
  battery: number;

  readonly roverStats: RoverStats;

  onDamaged?: (amount: number) => void;
  onFireBlaster?: BlasterSpawnFn;
  onBatteryDepleted?: () => void;

  private currentSpeed = 0;
  private blasterCooldown = 0;
  private isDisabled = false;
  private slowFactorThisFrame = 1;
  private accelerationScaleThisFrame = 1;
  private tractionScaleThisFrame = 1;
  private damageFlashTimer = 0;
  private readonly maxForwardSpeed: number;
  private readonly maxReverseSpeed: number;
  private readonly acceleration: number;
  private readonly brakeDeceleration = 600;
  private readonly naturalFriction = 200;
  private readonly turnSpeed: number;

  constructor(
    x: number,
    y: number,
    stats: RoverStats,
    cargoConfig?: CargoConfig
  ) {
    super({
      x,
      y,
      width: ROVER_SPRITE_WIDTH,
      height: ROVER_SPRITE_HEIGHT,
      color: Color.fromHex("#f97316"),
    });
    this.body.collisionType = CollisionType.Active;
    this.collider.set(
      Shape.Box(ROVER_SPRITE_WIDTH - 4, ROVER_SPRITE_HEIGHT - 12)
    );
    this.roverStats = stats;
    const s = this.roverStats;
    if (cargoConfig) {
      this.maxCargo = { ...cargoConfig };
      this.maxCapacity =
        cargoConfig.iron + cargoConfig.crystal + cargoConfig.gas;
    } else {
      this.maxCapacity = s.maxCapacity;
    }
    this.health = s.maxHealth;
    this.battery = s.maxBattery;
    this.maxForwardSpeed = s.maxSpeed;
    this.maxReverseSpeed = -s.maxSpeed * 0.5;
    this.acceleration = s.acceleration;
    this.turnSpeed = s.turnSpeed;

    const spriteSheet = SpriteSheet.fromImageSource({
      image: Resources.RoverSprite,
      grid: {
        rows: ROVER_SPRITE_ROWS,
        columns: ROVER_SPRITE_COLUMNS,
        spriteWidth: ROVER_SPRITE_WIDTH,
        spriteHeight: ROVER_SPRITE_HEIGHT,
      },
    });
    const sprite = spriteSheet.getSprite(0, 0);
    if (sprite) {
      this.graphics.use(sprite);
    }
  }

  /** Reset rover state for starting a new mission (scene re-use). */
  resetForNewMission(): void {
    this.health = this.roverStats.maxHealth;
    this.battery = this.roverStats.maxBattery;
    this.isDisabled = false;
    this.cargo = { iron: 0, crystal: 0, gas: 0 };
    this.usedCapacity = 0;
    this.vel = vec(0, 0);
    this.currentSpeed = 0;
    this.blasterCooldown = 0;
    this.damageFlashTimer = 0;
    this.slowFactorThisFrame = 1;
    this.accelerationScaleThisFrame = 1;
    this.tractionScaleThisFrame = 1;
    this.setVisibilityRadiusMultiplier(1);
  }

  remainingCapacity(): number {
    return this.maxCapacity - this.usedCapacity;
  }

  /** Check if rover can pick up given amount of a resource (total + per-resource caps). */
  canPick(id: ResourceId, size: number): boolean {
    if (this.usedCapacity + size > this.maxCapacity) return false;
    if (this.maxCargo && this.cargo[id] + size > this.maxCargo[id])
      return false;
    return true;
  }

  addResource(id: ResourceId, size: number) {
    this.cargo[id] += size;
    this.usedCapacity += size;
    this.emitStateChanged();
  }

  takeDamage(amount: number, damageType: DamageType = "generic") {
    if (amount <= 0) return;
    const reduction = getDamageReductionForType(this.roverStats, damageType);
    let effective = Math.max(0, Math.ceil(amount - reduction));
    if (effective <= 0) return;

    this.health = Math.max(0, this.health - effective);
    this.damageFlashTimer = 150;

    this.events.emit("damage", { amount: effective } as RoverDamageEvent);
    this.onDamaged?.(effective);
    this.emitStateChanged();

    if (this.health <= 0) {
      this.isDisabled = true;
    }
  }

  applySlow(factor: number) {
    const effectiveFactor = factor * (1 - this.roverStats.lavaSlowResist);
    if (effectiveFactor < this.slowFactorThisFrame) {
      this.slowFactorThisFrame = effectiveFactor;
    }
  }

  getWindResist(): number {
    return this.roverStats.windResist;
  }

  getActor(): Actor {
    return this;
  }

  onInitialize(): void {
    this.addComponent(new PlayerTagComponent());
    this.addComponent(new FogViewerComponent(this.roverStats.visibilityRadius));
    this.addComponent(new MagnetismSourceComponent(this.roverStats.magnetism));
    this.addComponent(new WindReceiverComponent(this.getWindResist()));
  }

  setDriveModifiersThisFrame(accelerationScale: number, tractionScale: number) {
    this.accelerationScaleThisFrame = Math.max(0, accelerationScale);
    this.tractionScaleThisFrame = Math.max(0, tractionScale);
  }

  setVisibilityRadiusMultiplier(multiplier: number): void {
    const fogViewer = this.get(FogViewerComponent);
    if (fogViewer) {
      fogViewer.multiplier = Math.max(0.1, multiplier);
    }
  }

  getVisibilityRadiusTiles(): number {
    const fogViewer = this.get(FogViewerComponent);
    if (!fogViewer) return this.roverStats.visibilityRadius;
    return fogViewer.baseRadiusTiles * fogViewer.multiplier;
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (this.isDisabled) {
      this.vel = vec(0, 0);
      return;
    }

    const dt = delta / 1000;
    this.battery -= this.roverStats.batteryDrainPerSecond * dt;
    if (this.battery <= 0) {
      this.battery = 0;
      this.isDisabled = true;
      this.events.emit("batterydepleted", undefined);
      this.onBatteryDepleted?.();
      this.emitStateChanged();
      return;
    }

    const input = engine.input.keyboard;

    let turningLeft = input.isHeld(Keys.Left) || input.isHeld(Keys.A);
    let turningRight = input.isHeld(Keys.Right) || input.isHeld(Keys.D);
    let accelerating = input.isHeld(Keys.Up) || input.isHeld(Keys.W);
    let braking = input.isHeld(Keys.Down) || input.isHeld(Keys.S);
    const touch = getTouchControlsEnabled() ? getTouchInput() : null;
    const useTouchDrive =
      touch && touch.targetAngle !== null && touch.targetAngle !== undefined;

    if (useTouchDrive) {
      const targetAngle = touch!.targetAngle!;
      let diff = targetAngle - this.rotation;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const maxTurn = this.turnSpeed * dt;
      if (diff > maxTurn) {
        this.rotation += maxTurn;
      } else if (diff < -maxTurn) {
        this.rotation -= maxTurn;
      } else {
        this.rotation = targetAngle;
      }
      const targetSpeed = touch!.magnitude * this.maxForwardSpeed;
      const accelChange =
        this.acceleration * this.accelerationScaleThisFrame * dt;
      const speedDiff = targetSpeed - this.currentSpeed;
      if (Math.abs(speedDiff) <= accelChange) {
        this.currentSpeed = targetSpeed;
      } else {
        this.currentSpeed += Math.sign(speedDiff) * accelChange;
      }
    } else {
      turningLeft = turningLeft || (touch?.turnLeft ?? false);
      turningRight = turningRight || (touch?.turnRight ?? false);
      accelerating = accelerating || (touch?.accelerate ?? false);
      braking = braking || (touch?.brake ?? false);

      if (turningLeft) {
        this.rotation -= this.turnSpeed * dt;
      } else if (turningRight) {
        this.rotation += this.turnSpeed * dt;
      }

      if (accelerating) {
        this.currentSpeed +=
          this.acceleration * this.accelerationScaleThisFrame * dt;
        if (this.currentSpeed < 0) {
          this.currentSpeed +=
            this.brakeDeceleration * this.tractionScaleThisFrame * dt;
        }
      } else if (braking) {
        this.currentSpeed -=
          this.acceleration * this.accelerationScaleThisFrame * dt;
        if (this.currentSpeed > 0) {
          this.currentSpeed -=
            this.brakeDeceleration * this.tractionScaleThisFrame * dt;
        }
      } else {
        if (this.currentSpeed > 0) {
          this.currentSpeed = Math.max(
            0,
            this.currentSpeed -
              this.naturalFriction * this.tractionScaleThisFrame * dt
          );
        } else if (this.currentSpeed < 0) {
          this.currentSpeed = Math.min(
            0,
            this.currentSpeed +
              this.naturalFriction * this.tractionScaleThisFrame * dt
          );
        }
      }
    }

    if (this.currentSpeed > this.maxForwardSpeed) {
      this.currentSpeed = this.maxForwardSpeed;
    }
    if (this.currentSpeed < this.maxReverseSpeed) {
      this.currentSpeed = this.maxReverseSpeed;
    }

    const forward = vec(Math.cos(this.rotation), Math.sin(this.rotation));
    this.vel = forward.scale(this.currentSpeed * this.slowFactorThisFrame);
    const windReceiver = this.get(WindReceiverComponent);
    if (windReceiver) {
      this.vel = this.vel.add(windReceiver.velocityDelta);
      windReceiver.velocityDelta = vec(0, 0);
    }

    if (this.blasterCooldown > 0) {
      this.blasterCooldown -= delta;
    }
    let fireKey =
      input.wasPressed(Keys.Space) || input.wasPressed(Keys.ControlLeft);
    if (getTouchControlsEnabled()) {
      const touch = getTouchInput();
      if (touch.fire) {
        fireKey = true;
        setTouchInput({ fire: false });
      }
    }
    if (fireKey && this.blasterCooldown <= 0) {
      const msPerShot = 1000 / this.roverStats.blasterFireRate;
      this.blasterCooldown = msPerShot;
      const x = this.pos.x;
      const y = this.pos.y;
      const angle = this.rotation;
      const damage = this.roverStats.blasterDamage;
      const speed = 600;
      const range = this.roverStats.blasterRange;
      this.events.emit("fireblaster", {
        x,
        y,
        angle,
        damage,
        speed,
        range,
      } as RoverFireBlasterEvent);
      this.onFireBlaster?.(x, y, angle, damage, speed, range);
    }

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta;
      this.graphics.opacity =
        Math.floor(this.damageFlashTimer / 25) % 2 === 0 ? 1 : 0;
    } else {
      this.graphics.opacity = 1;
    }

    this.slowFactorThisFrame = 1;
    this.accelerationScaleThisFrame = 1;
    this.tractionScaleThisFrame = 1;
    this.emitStateChanged();
  }

  private emitStateChanged(): void {
    this.events.emit("statechanged", {
      health: this.health,
      battery: this.battery,
      usedCapacity: this.usedCapacity,
      maxCapacity: this.maxCapacity,
      cargo: { ...this.cargo },
    } as RoverStateChangedEvent);
  }
}
