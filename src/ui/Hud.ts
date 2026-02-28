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
import { getCurrentGoals, isGoalSatisfied, type GoalLiveState } from "../state/RunGoals";

export class Hud extends ScreenElement {
  private engineRef: Engine;
  private rover: Rover;

  private healthLabel!: Label;
  private capacityLabel!: Label;
  private cargoLabel!: Label;
  private totalLabel!: Label;
  private goalLabels: Label[] = [];
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

    this.totalLabel = new Label({
      text: "",
      pos: vec(16, 104),
      color: Color.fromHex("#93c5fd"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    const goalFont = new Font({
      family: "system-ui, sans-serif",
      size: 14,
      unit: FontUnit.Px,
    });
    for (let i = 0; i < 3; i++) {
      const lbl = new Label({
        text: "",
        pos: vec(16, 128 + i * 20),
        color: Color.fromHex("#9ca3af"),
        font: goalFont,
      });
      this.goalLabels.push(lbl);
      this.addChild(lbl);
    }

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
    this.addChild(this.totalLabel);
    this.addChild(this.baseHintLabel);
  }

  updateFromState(isNearBase: boolean, lavaHits: number): void {
    this.healthLabel.text = `Health: ${this.rover.health}`;
    this.capacityLabel.text = `Cargo: ${this.rover.usedCapacity}/${this.rover.maxCapacity} (left ${this.rover.remainingCapacity()})`;
    this.cargoLabel.text = `Iron: ${this.rover.cargo.iron}  Crystal: ${this.rover.cargo.crystal}  Gas: ${this.rover.cargo.gas}`;
    const totalPieces =
      this.rover.cargo.iron + this.rover.cargo.crystal + this.rover.cargo.gas;
    this.totalLabel.text = `${totalPieces} in cargo  |  ${this.rover.usedCapacity}/${this.rover.maxCapacity} slots`;

    const liveState: GoalLiveState = {
      cargo: this.rover.cargo,
      usedCapacity: this.rover.usedCapacity,
      maxCapacity: this.rover.maxCapacity,
      lavaHits,
    };
    const goals = getCurrentGoals();
    for (let i = 0; i < this.goalLabels.length; i++) {
      if (i < goals.length) {
        const goal = goals[i];
        const satisfied = isGoalSatisfied(goal, liveState);
        this.goalLabels[i].text = satisfied ? `✓ ${goal.label}` : `○ ${goal.label}`;
        this.goalLabels[i].color = satisfied
          ? Color.fromHex("#4ade80")
          : Color.fromHex("#9ca3af");
        this.goalLabels[i].graphics.visible = true;
      } else {
        this.goalLabels[i].graphics.visible = false;
      }
    }

    this.baseHintLabel.text = isNearBase ? "Press Enter to return to ship" : "";
  }
}
