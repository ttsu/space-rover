import {
  Actor,
  Color,
  CollisionType,
  Font,
  FontUnit,
  Label,
  SpriteSheet,
  vec,
} from "excalibur";
import type { IResourceCollector } from "./contracts";
import type { DroppedCargoEntry } from "../world/WorldState";
import { isCargoEmpty } from "../world/WorldState";
import { getResourceById } from "../resources/ResourceTypes";
import type { ResourceId } from "../resources/ResourceTypes";
import { risingBurst } from "../effects/Particles";
import { playPickup } from "../audio/sounds";
import { FogAffectedComponent } from "../world/FogOfWar";
import { MagneticResourceComponent } from "../world/components/MagneticResourceComponent";
import { Resources } from "../resources";

const PILE_SIZE = 32;
const CARGO_DROP_SPRITE_SIZE = 32;

/**
 * A pile of resources dropped when the rover died (battery or health).
 * Persisted in world state; on the next run the player can pick it up.
 */
export class DroppedCargoPile extends Actor {
  private entry: DroppedCargoEntry;
  private onEmpty: () => void;

  constructor(entry: DroppedCargoEntry, onEmpty: () => void) {
    super({
      x: entry.x,
      y: entry.y,
      width: PILE_SIZE,
      height: PILE_SIZE,
      anchor: vec(0.5, 0.5),
    });
    this.entry = entry;
    this.onEmpty = onEmpty;
  }

  onInitialize(): void {
    this.body.collisionType = CollisionType.Passive;
    this.addComponent(new MagneticResourceComponent());
    this.addComponent(new FogAffectedComponent());
    this.updateVisuals();

    this.on("collisionstart", (evt) => {
      const other = evt.other.owner;
      const collector = other as unknown as IResourceCollector;
      if (
        !collector ||
        typeof collector.canPick !== "function" ||
        typeof collector.addResource !== "function"
      ) {
        return;
      }

      const cargo = this.entry.cargo;
      const ids: ResourceId[] = ["iron", "crystal", "gas"];
      let transferred = false;

      for (const id of ids) {
        const def = getResourceById(id);
        while (cargo[id] >= def.size && collector.canPick(id, def.size)) {
          collector.addResource(id, def.size);
          cargo[id] -= def.size;
          transferred = true;
          if (this.scene) {
            risingBurst(this.scene, this.pos.x, this.pos.y, {
              color: def.color,
              count: 6,
              speedMin: 20,
              speedMax: 45,
              upwardBias: 0.7,
            });
          }
          playPickup();
          this.showPopup(`+${def.size} ${def.name}`);
        }
      }

      if (transferred) {
        this.updateVisuals();
        if (isCargoEmpty(cargo)) {
          this.onEmpty();
          this.kill();
        }
      }
    });
  }

  private updateVisuals(): void {
    const c = this.entry.cargo;
    const total = c.iron + c.crystal + c.gas;
    if (total <= 0) return;
    const spriteSheet = SpriteSheet.fromImageSource({
      image: Resources.CargoDropSprite,
      grid: {
        rows: 1,
        columns: 1,
        spriteWidth: CARGO_DROP_SPRITE_SIZE,
        spriteHeight: CARGO_DROP_SPRITE_SIZE,
      },
    });
    const sprite = spriteSheet.getSprite(0, 0, {
      scale: vec(
        PILE_SIZE / CARGO_DROP_SPRITE_SIZE,
        PILE_SIZE / CARGO_DROP_SPRITE_SIZE
      ),
    });
    if (sprite) this.graphics.use(sprite);
  }

  private showPopup(text: string): void {
    const scene = this.scene;
    if (!scene) return;
    const label = new Label({
      text,
      pos: this.pos.add(vec(0, -24)),
      color: Color.White,
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
      if (life <= 0) label.kill();
    });
  }
}
