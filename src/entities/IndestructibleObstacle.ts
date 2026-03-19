import { Actor, CollisionType, vec } from "excalibur";
import type { BiomeId } from "../config/biomeConfig";
import { TILE_SIZE, WORLD_OVERLAY_Z } from "../config/gameConfig";
import type { IndestructibleSize } from "../resources/terrainAssets";
import {
  applyIndestructibleSprite,
  applyIndestructibleBlobSprite,
  getIndestructiblePixelSize,
} from "../world/TerrainGraphics";

/**
 * Origin (gx, gy) is the top-left tile of the block. Position is center of the block.
 */
export class IndestructibleObstacle extends Actor {
  readonly originGx: number;
  readonly originGy: number;
  readonly size: IndestructibleSize;
  private readonly biomeId: BiomeId;
  private readonly spriteIndex: number;
  /** When set (and size===1), overrides the random sprite selection with a Wang-blob sprite. */
  blobMask?: number;

  constructor(
    originGx: number,
    originGy: number,
    size: IndestructibleSize,
    biomeId: BiomeId,
    spriteIndex: number
  ) {
    const pixelSize = getIndestructiblePixelSize(size);
    const centerX = originGx * TILE_SIZE + pixelSize / 2;
    const centerY = originGy * TILE_SIZE + pixelSize / 2;

    super({
      x: centerX,
      y: centerY,
      width: pixelSize,
      height: pixelSize,
      anchor: vec(0.5, 0.5),
    });
    this.body.collisionType = CollisionType.Fixed;
    this.originGx = originGx;
    this.originGy = originGy;
    this.size = size;
    this.biomeId = biomeId;
    this.spriteIndex = spriteIndex;
  }

  onInitialize(): void {
    this.z = WORLD_OVERLAY_Z;
    if (this.size === 1 && this.blobMask !== undefined) {
      const applied = applyIndestructibleBlobSprite(
        this,
        this.biomeId,
        this.blobMask
      );
      if (applied) return;
    }
    applyIndestructibleSprite(this, this.biomeId, this.size, this.spriteIndex);
  }
}
