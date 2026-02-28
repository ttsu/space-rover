import { Actor, CollisionType, Engine, vec } from "excalibur";
import type { ResourceTypeDef } from "../resources/ResourceTypes";
import { ResourceNode } from "./ResourceNode";
import type { IBlasterTarget } from "./BlasterProjectile";

const DEFAULT_HP = 4;

export class ResourceDeposit extends Actor implements IBlasterTarget {
  resource: ResourceTypeDef;
  sizeUnits: number;
  hp: number;
  private engineRef: Engine | null = null;
  private breaking = false;

  constructor(
    x: number,
    y: number,
    resource: ResourceTypeDef,
    hp = DEFAULT_HP
  ) {
    super({
      x,
      y,
      width: 24,
      height: 24,
      color: resource.color,
    });
    this.body.collisionType = CollisionType.Fixed;
    this.resource = resource;
    this.sizeUnits = resource.size;
    this.hp = hp;
  }

  takeBlasterDamage(amount: number): void {
    if (this.breaking || this.isKilled()) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0 && this.engineRef) {
      this.breaking = true;
      this.playBreakAndSpawn();
    }
  }

  onInitialize(engine: Engine): void {
    this.engineRef = engine;
  }

  private playBreakAndSpawn(): void {
    if (!this.engineRef?.currentScene) return;
    const scene = this.engineRef.currentScene;
    const x = this.pos.x;
    const y = this.pos.y;
    const resource = this.resource;

    this.playBreakParticles();

    this.actions.delay(250).callMethod(() => {
      const pickup = new ResourceNode(x, y, resource);
      scene.add(pickup);
      this.kill();
    });
  }

  private playBreakParticles(): void {
    if (!this.engineRef?.currentScene) return;
    const scene = this.engineRef.currentScene;
    const count = 6;
    const color = this.resource.color;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const vel = vec(Math.cos(angle), Math.sin(angle)).scale(
        40 + Math.random() * 40
      );
      const p = new Actor({
        x: this.pos.x,
        y: this.pos.y,
        width: 6,
        height: 6,
        color,
      });
      p.anchor.setTo(0.5, 0.5);
      scene.add(p);
      let life = 350;
      const eng = this.engineRef;
      p.on("preupdate", () => {
        if (!eng) return;
        const dt = eng.clock.elapsed();
        life -= dt;
        p.pos = p.pos.add(vel.scale(dt / 1000));
        if (life <= 0) p.kill();
      });
    }
  }
}
