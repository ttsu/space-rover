import { Actor, Engine, Keys, SpriteSheet, vec, type Vector } from "excalibur";
import { Resources } from "../resources";
import {
  getTouchInput,
  getTouchControlsEnabled,
} from "../input/TouchInputState";
import type { ShipStats } from "../config/shipConfig";
import { GravityReceiverComponent } from "../world/components/GravityComponents";

const SPACESHIP_SPRITE_SIZE = 128;

export class SpaceShip extends Actor {
  readonly shipStats: ShipStats;

  /** Current hull HP. When <= 0, ship is destroyed. */
  hull: number;

  /** Called when hull reaches 0 (ship destroyed). */
  onDestroyed?: () => void;

  /** When true, ship steers and thrusts toward autopilotTarget. */
  autopilotOn = false;
  /** Target position (e.g. planet) for autopilot. Scene updates each frame. */
  autopilotTarget: Vector = vec(0, 0);

  private currentThrust = 0; // -1 to 1 (backward to forward)

  constructor(x: number, y: number, stats: ShipStats) {
    super({
      x,
      y,
      width: SPACESHIP_SPRITE_SIZE,
      height: SPACESHIP_SPRITE_SIZE,
      anchor: vec(0.5, 0.5),
    });
    this.shipStats = stats;

    const spriteSheet = SpriteSheet.fromImageSource({
      image: Resources.SpaceshipSprite,
      grid: {
        rows: 1,
        columns: 1,
        spriteWidth: SPACESHIP_SPRITE_SIZE,
        spriteHeight: SPACESHIP_SPRITE_SIZE,
      },
    });
    const sprite = spriteSheet.getSprite(0, 0);
    if (sprite) this.graphics.use(sprite);
    this.hull = stats.hull;
    this.addComponent(new GravityReceiverComponent());
  }

  takeDamage(amount: number, heatShieldingFactor = 0): void {
    if (amount <= 0) return;
    const reduced = Math.max(0, Math.ceil(amount * (1 - heatShieldingFactor)));
    this.hull = Math.max(0, this.hull - reduced);
    if (this.hull <= 0) this.onDestroyed?.();
  }

  isDestroyed(): boolean {
    return this.hull <= 0;
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (this.hull <= 0) return;
    const dt = delta / 1000;

    if (this.autopilotOn) {
      const toTarget = this.autopilotTarget.clone().sub(this.pos);
      const dist = toTarget.distance();
      if (dist > 5) {
        const targetAngle = Math.atan2(toTarget.y, toTarget.x);
        let diff = targetAngle - this.rotation;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const maxTurn = this.shipStats.turnSpeed * dt;
        if (diff > maxTurn) this.rotation += maxTurn;
        else if (diff < -maxTurn) this.rotation -= maxTurn;
        else this.rotation = targetAngle;
        this.currentThrust = 1;
      } else {
        this.currentThrust = 0;
      }
    } else {
      // Input: turn and thrust (rover-like)
      const input = engine.input.keyboard;
      let turningLeft = input.isHeld(Keys.Left) || input.isHeld(Keys.A);
      let turningRight = input.isHeld(Keys.Right) || input.isHeld(Keys.D);
      let thrustForward = input.isHeld(Keys.Up) || input.isHeld(Keys.W);
      let thrustBack = input.isHeld(Keys.Down) || input.isHeld(Keys.S);
      const touch = getTouchControlsEnabled() ? getTouchInput() : null;
      const useTouch =
        touch && touch.targetAngle !== null && touch.targetAngle !== undefined;

      if (useTouch && touch) {
        const targetAngle = touch.targetAngle!;
        let diff = targetAngle - this.rotation;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const maxTurn = this.shipStats.turnSpeed * dt;
        if (diff > maxTurn) this.rotation += maxTurn;
        else if (diff < -maxTurn) this.rotation -= maxTurn;
        else this.rotation = targetAngle;
        this.currentThrust = touch.magnitude;
      } else {
        turningLeft = turningLeft || (touch?.turnLeft ?? false);
        turningRight = turningRight || (touch?.turnRight ?? false);
        thrustForward = thrustForward || (touch?.accelerate ?? false);
        thrustBack = thrustBack || (touch?.brake ?? false);
        if (turningLeft) this.rotation -= this.shipStats.turnSpeed * dt;
        if (turningRight) this.rotation += this.shipStats.turnSpeed * dt;
        if (thrustForward) this.currentThrust = 1;
        else if (thrustBack) this.currentThrust = -1;
        else this.currentThrust = 0;
      }
    }

    // Thrust acceleration
    const forward = vec(Math.cos(this.rotation), Math.sin(this.rotation));
    const thrustAccel = forward.scale(
      this.currentThrust * this.shipStats.thrust * dt
    );
    this.vel = this.vel.add(thrustAccel);

    // Gravity is applied by GravitySystem in SpaceNavScene before this runs.

    // Cap speed
    const speed = this.vel.distance();
    if (speed > this.shipStats.maxSpeed) {
      this.vel = this.vel.normalize().scale(this.shipStats.maxSpeed);
    }

    // Integrate position (ensure movement even if engine doesn't apply vel)
    this.pos = this.pos.add(this.vel.scale(dt));
  }
}
