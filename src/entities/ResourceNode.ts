import {
  Actor,
  Color,
  Label,
  vec,
  Font,
  FontUnit,
  ParticleEmitter,
  EmitterType,
} from "excalibur";
import type { ResourceTypeDef } from "../resources/ResourceTypes";
import type { IResourceCollector } from "./contracts";
import { risingBurst } from "../effects/Particles";
import { playPickup } from "../audio/sounds";
import { onResourceCollectedAtWorldPos } from "../world/WorldState";
import { applyResourceSprite } from "../resources/ResourceGraphics";
import { MagneticResourceComponent } from "../world/components/MagneticResourceComponent";
import { FogAffectedComponent } from "../world/FogOfWar";

export class ResourceNode extends Actor {
  resource: ResourceTypeDef;
  sizeUnits: number;
  private spriteIndex?: number;
  private depleted = false;
  private gasEmitter: ParticleEmitter | null = null;

  constructor(
    x: number,
    y: number,
    resource: ResourceTypeDef,
    spriteIndex?: number
  ) {
    super({
      x,
      y,
      width: 32,
      height: 32,
      anchor: vec(0.5, 0.5),
      z: -1,
    });
    this.resource = resource;
    this.sizeUnits = resource.size;
    this.spriteIndex = spriteIndex;
  }

  onInitialize(): void {
    this.applySpriteGraphicIfNeeded();
    this.addComponent(new MagneticResourceComponent());
    if (this.resource.id === "gas") {
      const emitter = new ParticleEmitter({
        isEmitting: true,
        emitRate: 15,
        emitterType: EmitterType.Circle,
        particle: {
          minSpeed: 10,
          minSize: 5,
          maxSize: 10,
          acc: vec(0, -5),
          life: 4000,
          opacity: 0.75,
          fade: true,
          beginColor: this.resource.color,
          endColor: this.resource.color,
        },
      });
      emitter.addComponent(new FogAffectedComponent());
      this.addChild(emitter);
      this.gasEmitter = emitter;
    }
    this.on("collisionstart", (evt) => {
      if (this.depleted) return;
      const other = evt.other.owner;
      const collector = other as unknown as IResourceCollector;
      if (
        collector &&
        typeof collector.canPick === "function" &&
        typeof collector.addResource === "function"
      ) {
        if (collector.canPick(this.resource.id, this.sizeUnits)) {
          collector.addResource(this.resource.id, this.sizeUnits);
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
          if (this.resource.id === "gas") {
            this.gasEmitter?.kill();
            this.gasEmitter = null;
            this.depleted = true;
          } else {
            this.kill();
          }
        } else {
          const shortage = this.sizeUnits - collector.remainingCapacity();
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
