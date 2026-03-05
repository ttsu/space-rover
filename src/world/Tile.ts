import { Actor, Color } from "excalibur";
import { TILE_SIZE } from "../config/gameConfig";

export type TileKind =
  | "ground"
  | "lava"
  | "rockField"
  | "storm"
  | "base"
  | "ice";

export class Tile extends Actor {
  readonly gridX: number;
  readonly gridY: number;
  kind: TileKind;

  constructor(gridX: number, gridY: number, kind: TileKind) {
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
    this.z = -10;
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
