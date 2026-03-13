import { SpriteSheet, vec, type Actor, type ImageSource } from "excalibur";
import type { ResourceTypeDef } from "./ResourceTypes";
import { Resources } from "../resources";
import { random } from "../utils/seedRandom";

function getResourceSpriteImage(
  resource: ResourceTypeDef,
  kind: "node" | "deposit"
): ImageSource | null {
  if (resource.id === "iron") {
    return kind === "deposit"
      ? Resources.IronDepositSprite
      : Resources.IronSprite;
  }
  if (resource.id === "crystal") {
    return kind === "deposit"
      ? Resources.CrystalDepositSprite
      : Resources.CrystalSprite;
  }
  if (resource.id === "gas" && kind === "node") {
    return Resources.GasVentSprite;
  }
  return null;
}

export function applyResourceSprite(
  actor: Actor,
  resource: ResourceTypeDef,
  kind: "node" | "deposit",
  spriteIndex?: number
): void {
  const image = getResourceSpriteImage(resource, kind);
  if (!image) return;
  const index = spriteIndex ?? Math.floor(random() * 4);
  const spriteSheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: 1,
      columns: 4,
      spriteWidth: 64,
      spriteHeight: 64,
    },
  });
  const sprite = spriteSheet.getSprite(index, 0, {
    scale: vec(0.5, 0.5),
  });
  if (sprite) {
    actor.graphics.use(sprite);
  }
}
