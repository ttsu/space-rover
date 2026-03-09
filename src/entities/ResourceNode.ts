import {
  Actor,
  Color,
  Label,
  vec,
  Font,
  FontUnit,
} from "excalibur";
import type { ResourceTypeDef } from "../resources/ResourceTypes";
import { Rover } from "./Rover";
import { risingBurst } from "../effects/Particles";
import { playPickup } from "../audio/sounds";
import { onResourceCollectedAtWorldPos } from "../world/WorldState";
import { applyResourceSprite } from "../resources/ResourceGraphics";
import { MagneticResourceComponent } from "../world/components/MagneticResourceComponent";

export class ResourceNode extends Actor {
  resource: ResourceTypeDef;
  sizeUnits: number;
  private spriteIndex?: number;

  constructor(
    x: number,
    y: number,
    resource: ResourceTypeDef,
    spriteIndex?: number
  ) {
    const hasSprite = resource.id === "iron" || resource.id === "crystal";
    super({
      x,
      y,
      width: hasSprite ? 32 : 20,
      height: hasSprite ? 32 : 20,
      anchor: vec(0.5, 0.5),
      ...(hasSprite ? {} : { color: resource.color }),
    });
    this.resource = resource;
    this.sizeUnits = resource.size;
    this.spriteIndex = spriteIndex;
  }

  onInitialize(): void {
    this.applySpriteGraphicIfNeeded();
    this.addComponent(new MagneticResourceComponent());
    this.on("collisionstart", (evt) => {
      const other = evt.other.owner;
      if (other instanceof Rover) {
        if (other.canPick(this.resource.id, this.sizeUnits)) {
          other.addResource(this.resource.id, this.sizeUnits);
          const scene = this.scene;
          if (scene) {
            risingBurst(scene, this.pos.x, this.pos.y, {
              color: this.resource.color,
              count: 12,
              speedMin: 25,
              speedMax: 55,
              upwardBias: 0.8,
            });
          }
          playPickup();
          this.showPopup(`+${this.sizeUnits} ${this.resource.name}`);
          onResourceCollectedAtWorldPos(this.pos.x, this.pos.y);
          this.kill();
        } else {
          const shortage = this.sizeUnits - other.remainingCapacity();
          const shortageText = shortage > 0 ? `${shortage}` : "0";
          this.showPopup(
            `Not enough space.\nNeed ${this.sizeUnits}, short by ${shortageText}.`,
            Color.fromHex("#f87171")
          );
        }
      }
    });
  }

  private applySpriteGraphicIfNeeded(): void {
    applyResourceSprite(this, this.resource, "node", this.spriteIndex);
  }

  private showPopup(text: string, color = Color.White): void {
    const scene = this.scene;
    if (!scene) return;
    const label = new Label({
      text,
      pos: this.pos.add(vec(0, -20)),
      color,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    label.anchor.setTo(0.5, 0.5);
    scene.add(label);

    const clock = scene.engine.clock;
    let life = 800;
    label.on("preupdate", () => {
      life -= clock.elapsed();
      label.pos = label.pos.add(vec(0, -0.03 * clock.elapsed()));
      if (life <= 0) {
        label.kill();
      }
    });
  }
}
