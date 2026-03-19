import { Actor, Color, CollisionType, vec } from "excalibur";
import type { IBlasterTarget } from "./BlasterProjectile";
import { burst } from "../effects/Particles";
import { onDepositDestroyedAtWorldPos } from "../world/WorldState";
import {
  applyDestructibleBlobSprite,
  applyDestructibleSprite,
} from "../world/TerrainGraphics";
import type { BiomeId } from "../config/biomeConfig";
import { TILE_SIZE, WORLD_OVERLAY_Z } from "../config/gameConfig";

const DEFAULT_HP = 4;

export class DestructibleObstacle extends Actor implements IBlasterTarget {
  private hp: number;
  private breaking = false;
  private readonly biomeId: BiomeId;
  private readonly spriteIndex: number;
  /** When set, overrides the random sprite selection with a Wang-blob sprite. */
  blobMask?: number;

  constructor(
    x: number,
    y: number,
    biomeId: BiomeId,
    spriteIndex: number,
    hp = DEFAULT_HP
  ) {
    super({
      x,
      y,
      width: TILE_SIZE,
      height: TILE_SIZE,
      anchor: vec(0.5, 0.5),
    });
    this.body.collisionType = CollisionType.Fixed;
    this.hp = hp;
    this.biomeId = biomeId;
    this.spriteIndex = spriteIndex;
  }

  onInitialize(): void {
    this.z = WORLD_OVERLAY_Z;
    if (this.blobMask !== undefined) {
      const applied = applyDestructibleBlobSprite(
        this,
        this.biomeId,
        this.blobMask
      );
      if (applied) return;
    }
    applyDestructibleSprite(this, this.biomeId, this.spriteIndex);
  }

  takeBlasterDamage(amount: number): void {
    if (this.breaking || this.isKilled()) return;
    const scene = this.scene;
    if (scene) {
      burst(scene, this.pos.x, this.pos.y, {
        color: Color.fromHex("#6b7280"),
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
      this.playBreakAndKill();
    }
  }

  private playBreakAndKill(): void {
    const scene = this.scene;
    if (!scene) return;
    burst(scene, this.pos.x, this.pos.y, {
      color: Color.fromHex("#6b7280"),
      count: 8,
      speedMin: 30,
      speedMax: 100,
      lifetimeMs: 300,
      sizeMin: 3,
      sizeMax: 8,
    });
    this.actions.delay(150).callMethod(() => {
      this.kill();
    });
  }
}
