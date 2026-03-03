import { ImageSource, Loader } from "excalibur";

export const Resources = {
  RoverSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/rover_sprite.png`
  ),
  ButtonSquareDepth: new ImageSource(
    `${import.meta.env.BASE_URL}assets/button_square_depth.png`
  ),
  ButtonSquare: new ImageSource(
    `${import.meta.env.BASE_URL}assets/button_square.png`
  ),
  BarSquare: new ImageSource(
    `${import.meta.env.BASE_URL}assets/bar_square_large_square.png`
  ),
} as const;

export const loader = new Loader();
for (const res of Object.values(Resources)) {
  loader.addResource(res);
}
