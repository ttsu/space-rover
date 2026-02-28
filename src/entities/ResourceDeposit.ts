import { Actor, CollisionType, Engine } from "excalibur";
import type { ResourceTypeDef } from "../resources/ResourceTypes";
import { ResourceNode } from "./ResourceNode";
import type { IBlasterTarget } from "./BlasterProjectile";
import { burst } from "../effects/Particles";

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
    const scene = this.engineRef?.currentScene;
    if (scene) {
      burst(scene, this.pos.x, this.pos.y, {
        color: this.resource.color,
        count: 4,
        speedMin: 20,
        speedMax: 70,
        lifetimeMs: 250,
        sizeMin: 2,
        sizeMax: 5,
      });
    }
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

    burst(scene, x, y, {
      color: this.resource.color,
      count: 12,
      speedMin: 40,
      speedMax: 120,
      lifetimeMs: 400,
      sizeMin: 4,
      sizeMax: 10,
    });

    this.actions.delay(250).callMethod(() => {
      const pickup = new ResourceNode(x, y, resource);
      scene.add(pickup);
      this.kill();
    });
  }
}
