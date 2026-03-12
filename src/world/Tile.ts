import { Actor, Color } from "excalibur";
import { TILE_SIZE } from "../config/gameConfig";
import type { BiomeId } from "../config/biomeConfig";
import { applyGroundSprite } from "./TerrainGraphics";

export type TileKind =
  | "ground"
  | "lava"
  | "rockField"
  | "storm"
  | "base"
  | "ice";

export interface TileOptions {
  kind: TileKind;
  /** When set with ground kind, a sprite from the biome's ground sheet is used. */
  biomeId?: BiomeId;
  /** Deterministic sprite index for ground (and biomeId). */
  groundSpriteIndex?: number;
}

export class Tile extends Actor {
  readonly gridX: number;
  readonly gridY: number;
  kind: TileKind;
  private biomeId?: BiomeId;
  private groundSpriteIndex?: number;

  constructor(
    gridX: number,
    gridY: number,
    kindOrOptions: TileKind | TileOptions
  ) {
    const options: TileOptions =
      typeof kindOrOptions === "string"
        ? { kind: kindOrOptions }
        : kindOrOptions;
    const kind = options.kind;
    const x = gridX * TILE_SIZE + TILE_SIZE / 2;
    const y = gridY * TILE_SIZE + TILE_SIZE / 2;

    super({
      x,
      y,
      width: TILE_SIZE,
      height: TILE_SIZE,
      color: colorForKind(kind),
    });

    this.gridX = gridX;
    this.gridY = gridY;
    this.kind = kind;
    this.biomeId = options.biomeId;
    this.groundSpriteIndex = options.groundSpriteIndex;
    this.z = -10;
  }

  onInitialize(): void {
    if (
      this.kind === "ground" &&
      this.biomeId !== undefined &&
      this.groundSpriteIndex !== undefined
    ) {
      applyGroundSprite(this, this.biomeId, this.groundSpriteIndex);
    }
  }
}

function colorForKind(kind: TileKind): Color {
  switch (kind) {
    case "ground":
      return Color.fromHex("#0f172a");
    case "lava":
      return Color.fromHex("#b91c1c");
    case "rockField":
      return Color.fromHex("#4b5563");
    case "storm":
      return Color.fromHex("#1e293b");
    case "base":
      return Color.fromHex("#0369a1");
    case "ice":
      return Color.fromHex("#1d4ed8");
    default:
      return Color.Gray;
  }
}
