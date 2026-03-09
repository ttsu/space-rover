import {
  ScreenElement,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  Engine,
  Actor,
  Polygon,
} from "excalibur";
import type { CargoCounts } from "../entities/Rover";
import type { HazardKind } from "../state/GameState";
import {
  getCurrentGoals,
  isGoalSatisfied,
  type GoalLiveState,
} from "../state/RunGoals";
import type { EdgeIndicator } from "../utils/edgeIndicator";
import { onSceneEvent, type HudSnapshotEvent } from "../events/GameEvents";

/** @deprecated Use EdgeIndicator from utils/edgeIndicator. Kept for compatibility. */
export type BaseIndicator = EdgeIndicator;

export class Hud extends ScreenElement {
  private engineRef: Engine;
  private snapshot: {
    health: number;
    battery: number;
    usedCapacity: number;
    maxCapacity: number;
    cargo: CargoCounts;
  } = {
    health: 0,
    battery: 0,
    usedCapacity: 0,
    maxCapacity: 0,
    cargo: { iron: 0, crystal: 0, gas: 0 },
  };

  private healthLabel!: Label;
  private batteryLabel!: Label;
  private capacityLabel!: Label;
  private cargoLabel!: Label;
  private totalLabel!: Label;
  private goalLabels: Label[] = [];
  private baseHintLabel!: Label;
  private baseArrowActor!: Actor;

  constructor(engine: Engine) {
    super({ x: 0, y: 0 });
    this.engineRef = engine;
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

    this.batteryLabel = new Label({
      text: "",
      pos: vec(16, 48),
      color: Color.fromHex("#fcd34d"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    this.capacityLabel = new Label({
      text: "",
      pos: vec(16, 64),
      color: Color.fromHex("#bbf7d0"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    this.cargoLabel = new Label({
      text: "",
      pos: vec(16, 88),
      color: Color.fromHex("#e5e7eb"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });

    this.totalLabel = new Label({
      text: "",
      pos: vec(16, 112),
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
        pos: vec(16, 136 + i * 20),
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

    const arrowSize = 14;
    const arrowGraphic = new Polygon({
      points: [
        vec(arrowSize, 0),
        vec(-arrowSize, -arrowSize * 0.7),
        vec(-arrowSize, arrowSize * 0.7),
      ],
      color: Color.fromHex("#facc15"),
    });
    arrowGraphic.origin = vec(0, 0);
    this.baseArrowActor = new Actor({
      pos: vec(0, 0),
      width: arrowSize * 2,
      height: arrowSize * 2,
      anchor: vec(0.5, 0.5),
    });
    this.baseArrowActor.graphics.use(arrowGraphic);
    this.baseArrowActor.graphics.isVisible = false;

    this.addChild(this.healthLabel);
    this.addChild(this.batteryLabel);
    this.addChild(this.capacityLabel);
    this.addChild(this.cargoLabel);
    this.addChild(this.totalLabel);
    this.addChild(this.baseHintLabel);
    this.addChild(this.baseArrowActor);

    if (this.scene) {
      onSceneEvent<HudSnapshotEvent>(this.scene, "hud:update", (payload) => {
        this.snapshot = {
          health: payload.health,
          battery: payload.battery,
          usedCapacity: payload.usedCapacity,
          maxCapacity: payload.maxCapacity,
          cargo: payload.cargo,
        };
        this.updateFromState(
          payload.isNearBase,
          payload.hazardHits,
          payload.biomeName,
          payload.baseIndicator
        );
      });
    }
  }

  updateFromState(
    isNearBase: boolean,
    hazardHits: Record<HazardKind, number>,
    biomeName: string,
    baseIndicator: BaseIndicator | null = null
  ): void {
    const remainingCapacity = Math.max(
      0,
      this.snapshot.maxCapacity - this.snapshot.usedCapacity
    );
    this.healthLabel.text = `Health: ${this.snapshot.health}`;
    this.batteryLabel.text = `Battery: ${Math.ceil(this.snapshot.battery)}s`;
    this.capacityLabel.text = `Cargo: ${this.snapshot.usedCapacity}/${this.snapshot.maxCapacity} (left ${remainingCapacity})`;
    this.cargoLabel.text = `Iron: ${this.snapshot.cargo.iron}  Crystal: ${this.snapshot.cargo.crystal}  Gas: ${this.snapshot.cargo.gas}`;
    const totalPieces =
      this.snapshot.cargo.iron +
      this.snapshot.cargo.crystal +
      this.snapshot.cargo.gas;
    this.totalLabel.text = `${totalPieces} in cargo  |  ${this.snapshot.usedCapacity}/${this.snapshot.maxCapacity} slots  |  Biome: ${biomeName}`;

    const liveState: GoalLiveState = {
      cargo: this.snapshot.cargo,
      usedCapacity: this.snapshot.usedCapacity,
      maxCapacity: this.snapshot.maxCapacity,
      hazardHits,
    };
    const goals = getCurrentGoals();
    for (let i = 0; i < this.goalLabels.length; i++) {
      if (i < goals.length) {
        const goal = goals[i];
        const satisfied = isGoalSatisfied(goal, liveState);
        this.goalLabels[i].text = satisfied
          ? `✓ ${goal.label}`
          : `○ ${goal.label}`;
        this.goalLabels[i].color = satisfied
          ? Color.fromHex("#4ade80")
          : Color.fromHex("#9ca3af");
        this.goalLabels[i].graphics.isVisible = true;
      } else {
        this.goalLabels[i].graphics.isVisible = false;
      }
    }

    this.baseHintLabel.text = isNearBase ? "Press Enter to return to ship" : "";

    if (baseIndicator) {
      this.baseArrowActor.pos = vec(
        baseIndicator.screenX,
        baseIndicator.screenY
      );
      this.baseArrowActor.rotation = baseIndicator.angleRad;
      this.baseArrowActor.graphics.isVisible = true;
    } else {
      this.baseArrowActor.graphics.isVisible = false;
    }
  }
}
