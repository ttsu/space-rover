import { Actor, SpriteSheet, vec } from "excalibur";
import { Resources } from "../resources";

const BASE_SPRITE_SIZE = 128;

export class BaseLander extends Actor {
  constructor(x: number, y: number) {
    super({
      x,
      y,
      width: BASE_SPRITE_SIZE,
      height: BASE_SPRITE_SIZE,
      anchor: vec(0.5, 0.5),
      z: -1,
    });
    const spriteSheet = SpriteSheet.fromImageSource({
      image: Resources.BaseLanderSprite,
      grid: {
        rows: 1,
        columns: 1,
        spriteWidth: BASE_SPRITE_SIZE,
        spriteHeight: BASE_SPRITE_SIZE,
      },
    });
    const sprite = spriteSheet.getSprite(0, 0);
    if (sprite) this.graphics.use(sprite);
  }
}
