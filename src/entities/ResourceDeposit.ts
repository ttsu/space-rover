import { Actor, CollisionType, vec } from "excalibur";
import type { ResourceTypeDef } from "../resources/ResourceTypes";
import { ResourceNode } from "./ResourceNode";
import type { IBlasterTarget } from "./BlasterProjectile";
import { burst } from "../effects/Particles";
import {
  onDepositDamagedAtWorldPos,
  onDepositDestroyedAtWorldPos,
} from "../world/WorldState";
import { applyResourceSprite } from "../resources/ResourceGraphics";
import { playDepositBreak } from "../audio/sounds";

const DEFAULT_HP = 8;

export class ResourceDeposit extends Actor implements IBlasterTarget {
  resource: ResourceTypeDef;
  sizeUnits: number;
  hp: number;
  private spriteIndex?: number;
  private breaking = false;

  constructor(
    x: number,
    y: number,
    resource: ResourceTypeDef,
    hp = DEFAULT_HP,
    spriteIndex?: number
  ) {
    const hasSprite = resource.id === "iron" || resource.id === "crystal";
    super({
      x,
      y,
      width: hasSprite ? 32 : 24,
      height: hasSprite ? 32 : 24,
      anchor: vec(0.5, 0.5),
      ...(hasSprite ? {} : { color: resource.color }),
    });
    this.body.collisionType = CollisionType.Fixed;
    this.resource = resource;
    this.sizeUnits = resource.size;
    this.hp = hp;
    this.spriteIndex = spriteIndex;
  }

  onInitialize(): void {
    this.applySpriteGraphicIfNeeded();
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
    playDepositBreak();
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

  private applySpriteGraphicIfNeeded(): void {
    applyResourceSprite(this, this.resource, "deposit", this.spriteIndex);
  }
}
