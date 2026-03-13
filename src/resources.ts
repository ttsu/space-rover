import { ImageSource, Loader } from "excalibur";
import { getAllTerrainImageSources } from "./resources/terrainAssets";

export const Resources = {
  RoverSprite: new ImageSource(`${import.meta.env.BASE_URL}assets/rover.png`),
  IronSprite: new ImageSource(`${import.meta.env.BASE_URL}assets/iron.png`),
  CrystalSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/crystal.png`
  ),
  IronDepositSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/iron_deposit.png`
  ),
  CrystalDepositSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/crystal_deposit.png`
  ),
  GasVentSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/gas_vent.png`
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
  BarSegmentLost: new ImageSource(
    `${import.meta.env.BASE_URL}assets/bar_shadow_square_outline_small_square.png`
  ),
  BarSegmentRemaining: new ImageSource(
    `${import.meta.env.BASE_URL}assets/bar_square_gloss_small_square.png`
  ),
  BarGlossBattery: new ImageSource(
    `${import.meta.env.BASE_URL}assets/bar_square_gloss_small_square copy.png`
  ),
  SpaceshipSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/spaceship.png`
  ),
  BaseLanderSprite: new ImageSource(
    `${import.meta.env.BASE_URL}assets/base.png`
  ),
  PanelGlassNotches: new ImageSource(
    `${import.meta.env.BASE_URL}assets/panel_glass_notches.png`
  ),
} as const;

export const loader = new Loader();
for (const res of Object.values(Resources)) {
  loader.addResource(res);
}
for (const res of getAllTerrainImageSources()) {
  loader.addResource(res);
}
