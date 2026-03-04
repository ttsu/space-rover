import {
  Actor,
  Color,
  Engine,
  vec,
  Font,
  FontUnit,
  Label,
  CollisionType,
} from "excalibur";
import type { IHazardTarget } from "../entities/Rover";
import { recordHazardHit, type HazardKind } from "../state/GameState";
import { LAVA_SLOW_FACTOR } from "../config/gameConfig";
import { random } from "../utils/seedRandom";
import { createAmbientEmitter } from "../effects/Particles";

abstract class HazardBase extends Actor {
  protected target: IHazardTarget;
  protected kind: HazardKind;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    target: IHazardTarget,
    kind: HazardKind
  ) {
    super({ x, y, width, height, color });
    this.target = target;
    this.kind = kind;
  }

  protected hit(amount: number, fromLava?: boolean) {
    this.target.takeDamage(amount, fromLava ?? false);
    recordHazardHit(this.kind);
  }
}

export class LavaPool extends HazardBase {
  private tickTimer = 0;
  private roverInLava = false;

  onInitialize(): void {
    this.body.collisionType = CollisionType.Passive;
    this.on("collisionstart", (evt) => {
      if (evt.other.owner === this.target.getActor()) this.roverInLava = true;
    });
    this.on("collisionend", (evt) => {
      if (evt.other.owner === this.target.getActor()) {
        this.roverInLava = false;
        this.tickTimer = 0;
      }
    });
    const lavaEmitter = createAmbientEmitter({
      color: Color.fromHex("#ea580c"),
      emitRate: 12,
      lifetimeMs: 700,
      minSpeed: 20,
      maxSpeed: 55,
      minSize: 2,
      maxSize: 5,
      minAngle: -Math.PI / 2 - 0.4,
      maxAngle: -Math.PI / 2 + 0.4,
      acc: { x: 0, y: -20 },
      width: this.width,
      height: this.height,
    });
    lavaEmitter.pos = vec(0, 0);
    this.addChild(lavaEmitter);
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    if (this.roverInLava) {
      this.target.applySlow(LAVA_SLOW_FACTOR);
      this.tickTimer += delta;
      if (this.tickTimer >= 500) {
        this.tickTimer = 0;
        this.hit(1, true);
      }
    }
  }
}

export class RockObstacle extends HazardBase {
  onInitialize(): void {
    this.body.collisionType = CollisionType.Fixed;
  }
}

export class WindZone extends HazardBase {
  private direction = vec(1, 0);
  private roverInWind = false;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    target: IHazardTarget,
    directionAngle: number
  ) {
    super(x, y, width, height, Color.fromHex("#0ea5e930"), target, "wind");
    this.direction = vec(Math.cos(directionAngle), Math.sin(directionAngle));
  }

  onInitialize(): void {
    this.body.collisionType = CollisionType.Passive;
    this.on("collisionstart", (evt) => {
      if (evt.other.owner === this.target.getActor()) this.roverInWind = true;
    });
    this.on("collisionend", (evt) => {
      if (evt.other.owner === this.target.getActor()) this.roverInWind = false;
    });
    const windAngle = Math.atan2(this.direction.y, this.direction.x);
    const windEmitter = createAmbientEmitter({
      color: Color.fromHex("#94a3b8"),
      emitRate: 10,
      lifetimeMs: 500,
      minSpeed: 40,
      maxSpeed: 90,
      minSize: 1.5,
      maxSize: 4,
      minAngle: windAngle - 0.35,
      maxAngle: windAngle + 0.35,
      width: this.width,
      height: this.height,
    });
    windEmitter.pos = vec(0, 0);
    this.addChild(windEmitter);
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    if (this.roverInWind) {
      const actor = this.target.getActor();
      const pushStrength =
        (random() * 200 + 500) * (1 - this.target.getWindResist());
      actor.vel = actor.vel.add(
        this.direction.scale(pushStrength * (delta / 1000))
      );
    }
    this.transform.rotation += random() * 0.1 + 0.1;
  }
}

export class LightningZone extends HazardBase {
  private warningTime = 800;
  private strikeTime = 200;
  private elapsed = 0;
  private hasStruck = false;
  private roverInZone = false;

  constructor(x: number, y: number, target: IHazardTarget) {
    super(x, y, 40, 40, Color.fromHex("#facc15"), target, "lightning");
  }

  onInitialize(): void {
    this.body.collisionType = CollisionType.Passive;
    this.on("collisionstart", (evt) => {
      if (evt.other.owner === this.target.getActor()) this.roverInZone = true;
    });
    this.on("collisionend", (evt) => {
      if (evt.other.owner === this.target.getActor()) this.roverInZone = false;
    });
  }

  onPreUpdate(engine: Engine, delta: number): void {
    this.elapsed += delta;

    if (!this.hasStruck && this.elapsed >= this.warningTime) {
      this.color = Color.fromHex("#e5e7eb");
      if (this.roverInZone) {
        this.hit(1);
      }
      this.showStrikeFlash(engine);
      this.hasStruck = true;
    }

    if (this.elapsed >= this.warningTime + this.strikeTime) {
      this.kill();
    }
  }

  private showStrikeFlash(engine: Engine) {
    const flash = new Label({
      text: "⚡",
      pos: this.pos.clone(),
      color: Color.fromHex("#eab308"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 32,
        unit: FontUnit.Px,
      }),
    });
    flash.anchor.setTo(0.5, 0.5);
    engine.currentScene.add(flash);

    let life = 300;
    flash.on("preupdate", () => {
      life -= engine.clock.elapsed();
      if (life <= 0) flash.kill();
    });
  }
}
