import {
  ScreenElement,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  Engine,
} from "excalibur";
import type { Rover } from "../entities/Rover";

export class Hud extends ScreenElement {
  private engineRef: Engine;
  private rover: Rover;

  private healthLabel!: Label;
  private capacityLabel!: Label;
  private cargoLabel!: Label;
  private baseHintLabel!: Label;

  constructor(engine: Engine, rover: Rover) {
    super({ x: 0, y: 0 });
    this.engineRef = engine;
    this.rover = rover;
  }

  onInitialize(): void {
    this.healthLabel = new Label({
      text: "",
      pos: vec(16, 32),
      color: Color.fromHex("#fca5a5"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    this.capacityLabel = new Label({
      text: "",
      pos: vec(16, 56),
      color: Color.fromHex("#bbf7d0"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    this.cargoLabel = new Label({
      text: "",
      pos: vec(16, 80),
      color: Color.fromHex("#e5e7eb"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    this.baseHintLabel = new Label({
      text: "",
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight - 32),
      color: Color.fromHex("#facc15"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
    });
    this.baseHintLabel.anchor.setTo(0.5, 0.5);

    this.addChild(this.healthLabel);
    this.addChild(this.capacityLabel);
    this.addChild(this.cargoLabel);
    this.addChild(this.baseHintLabel);
  }

  updateFromState(isNearBase: boolean): void {
    this.healthLabel.text = `Health: ${this.rover.health}`;
    this.capacityLabel.text = `Cargo: ${this.rover.usedCapacity}/${this.rover.maxCapacity} (left ${this.rover.remainingCapacity()})`;
    this.cargoLabel.text = `Iron: ${this.rover.cargo.iron}  Crystal: ${this.rover.cargo.crystal}  Gas: ${this.rover.cargo.gas}`;
    this.baseHintLabel.text = isNearBase ? "Press Enter to return to ship" : "";
  }
}
