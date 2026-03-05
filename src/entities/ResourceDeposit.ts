import { Actor, CollisionType } from "excalibur";
import type { ResourceTypeDef } from "../resources/ResourceTypes";
import { ResourceNode } from "./ResourceNode";
import type { IBlasterTarget } from "./BlasterProjectile";
import { burst } from "../effects/Particles";
import {
  onDepositDamagedAtWorldPos,
  onDepositDestroyedAtWorldPos,
} from "../world/WorldState";

const DEFAULT_HP = 8;

export class ResourceDeposit extends Actor implements IBlasterTarget {
  resource: ResourceTypeDef;
  sizeUnits: number;
  hp: number;
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
    const scene = this.scene;
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
    if (this.hp <= 0 && this.scene) {
      this.breaking = true;
      onDepositDestroyedAtWorldPos(this.pos.x, this.pos.y);
      this.playBreakAndSpawn();
    } else {
      onDepositDamagedAtWorldPos(
        this.pos.x,
        this.pos.y,
        this.resource.id,
        this.hp
      );
    }
  }

  private playBreakAndSpawn(): void {
    const scene = this.scene;
    if (!scene) return;
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
