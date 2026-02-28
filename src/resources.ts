import { ImageSource, Loader } from "excalibur";

export const Resources = {
  RoverSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/rover_sprite.png`
  ),
} as const;

export const loader = new Loader();
for (const res of Object.values(Resources)) {
  loader.addResource(res);
}
