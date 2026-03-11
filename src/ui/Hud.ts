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
  NineSlice,
  NineSliceStretch,
  type Sprite,
} from "excalibur";
import type { CargoCounts } from "../entities/Rover";
import { Resources } from "../resources";
import type { HazardKind } from "../state/GameState";
import {
  getCurrentGoals,
  isGoalSatisfied,
  type GoalLiveState,
} from "../state/RunGoals";
import {
  onSceneEvent,
  type HudContextEvent,
  type RoverStateChangedEvent,
} from "../events/GameEvents";
import { Panel } from "./Panel";

export class Hud extends ScreenElement {
  private engineRef: Engine;
  private snapshot: {
    health: number;
    maxHealth: number;
    battery: number;
    maxBattery: number;
    usedCapacity: number;
    maxCapacity: number;
    cargo: CargoCounts;
  } = {
    health: 0,
    maxHealth: 10,
    battery: 0,
    maxBattery: 30,
    usedCapacity: 0,
    maxCapacity: 0,
    cargo: { iron: 0, crystal: 0, gas: 0 },
  };
  private context: HudContextEvent = {
    biomeName: "",
    isNearBase: false,
    baseIndicator: null,
    hazardHits: {
      lava: 0,
      rock: 0,
      lightning: 0,
      wind: 0,
      sandstorm: 0,
      quake: 0,
    },
  };

  private healthBarSegments: Actor[] = [];
  private readonly maxHealthSegments = 20;
  private readonly healthSegmentSize = 16;
  private readonly healthSegmentGap = 2;
  private segmentRemainingSprite!: Sprite;
  private segmentLostSprite!: Sprite;
  private batteryBarBackground!: Actor;
  private batteryBarFill!: Actor;
  private batteryBarFillGraphic!: NineSlice;
  /** Animated width for battery fill; lerped toward target each frame. */
  private displayedBatteryBarWidth = 0;
  /** Lerp speed: 1 - exp(-k * dt). Higher = bar tracks battery faster. */
  private static readonly BATTERY_BAR_LERP_K = 6;
  private static readonly BATTERY_BAR_WIDTH = 200;
  private static readonly BATTERY_BAR_HEIGHT = 32;
  /** Small square bar assets; slice margins for nine-slice. */
  private static readonly BAR_SLICE_SOURCE_SIZE = 32;
  private static readonly BAR_SLICE_MARGIN = 8;
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
    this.segmentLostSprite = Resources.BarSegmentLost.toSprite({
      scale: vec(0.5, 1),
    });
    this.segmentRemainingSprite = Resources.BarSegmentRemaining.toSprite({
      scale: vec(0.5, 1),
    });

    for (let i = 0; i < this.maxHealthSegments; i++) {
      const segment = new Actor({
        pos: vec(16 + i * (this.healthSegmentSize + this.healthSegmentGap), 32),
        width: this.healthSegmentSize,
        height: this.healthSegmentSize,
        anchor: vec(0, 0),
      });
      segment.graphics.use(this.segmentLostSprite.clone());
      segment.graphics.isVisible = false;
      this.healthBarSegments.push(segment);
    }

    const barW = Hud.BATTERY_BAR_WIDTH;
    const barH = Hud.BATTERY_BAR_HEIGHT;
    const src = Hud.BAR_SLICE_SOURCE_SIZE;
    const margin = Hud.BAR_SLICE_MARGIN;
    const sliceConfig = {
      width: src,
      height: src,
      leftMargin: margin,
      topMargin: margin,
      rightMargin: margin,
      bottomMargin: margin,
    };
    const destConfig = {
      drawCenter: true,
      horizontalStretch: NineSliceStretch.Stretch,
      verticalStretch: NineSliceStretch.Stretch,
    };

    const batteryBgGraphic = new NineSlice({
      width: barW,
      height: barH,
      source: Resources.BarSegmentLost,
      sourceConfig: sliceConfig,
      destinationConfig: destConfig,
    });
    this.batteryBarBackground = new Actor({
      pos: vec(16, 76),
      width: barW,
      height: barH,
      anchor: vec(0, 0),
    });
    this.batteryBarBackground.graphics.use(batteryBgGraphic);

    this.batteryBarFillGraphic = new NineSlice({
      width: barW,
      height: barH,
      source: Resources.BarGlossBattery,
      sourceConfig: sliceConfig,
      destinationConfig: destConfig,
    });
    this.batteryBarFill = new Actor({
      pos: vec(16, 76),
      width: barW,
      height: barH,
      anchor: vec(0, 0),
    });
    this.batteryBarFill.graphics.use(this.batteryBarFillGraphic);

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

    // add panels to the hud
    // 1. health panel - top left
    // 2. mission goals panel - top right
    // 3 cargo panel - bottom left

    const healthPanel = new Panel({
      pos: vec(16, 32),
      width: 300,
      height: 200,
      // futuristic blue tint
      tint: Color.fromHex("#007bff"),
    });
    this.addChild(healthPanel);
    for (const segment of this.healthBarSegments) {
      healthPanel.addChild(segment);
    }
    healthPanel.addChild(this.batteryBarBackground);
    healthPanel.addChild(this.batteryBarFill);

    const missionGoalsPanel = new Panel({
      pos: vec(this.engineRef.screen.width - 300 - 32, 32),
      width: 300,
      height: 200,
    });
    this.addChild(missionGoalsPanel);
    for (const goalLabel of this.goalLabels) {
      missionGoalsPanel.addChild(goalLabel);
    }

    const cargoPanel = new Panel({
      pos: vec(32, this.engineRef.screen.height - 200 - 32),
      width: 300,
      height: 200,
    });
    this.addChild(cargoPanel);
    cargoPanel.addChild(this.cargoLabel);
    cargoPanel.addChild(this.capacityLabel);
    cargoPanel.addChild(this.totalLabel);

    this.addChild(this.baseHintLabel);
    this.addChild(this.baseArrowActor);

    if (this.scene) {
      onSceneEvent<RoverStateChangedEvent>(
        this.scene,
        "hud:state",
        (payload) => {
          this.snapshot = {
            health: payload.health,
            maxHealth: payload.maxHealth,
            battery: payload.battery,
            maxBattery: payload.maxBattery,
            usedCapacity: payload.usedCapacity,
            maxCapacity: payload.maxCapacity,
            cargo: payload.cargo,
          };
          this.updateFromState();
        }
      );
      onSceneEvent<HudContextEvent>(this.scene, "hud:context", (payload) => {
        this.context = payload;
        this.updateFromState();
      });
    }
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    const maxBatt = Math.max(1, this.snapshot.maxBattery);
    const targetWidth = Math.max(
      0,
      (this.snapshot.battery / maxBatt) * Hud.BATTERY_BAR_WIDTH
    );
    const deltaSec = delta / 1000;
    const t = 1 - Math.exp(-Hud.BATTERY_BAR_LERP_K * deltaSec);
    this.displayedBatteryBarWidth +=
      (targetWidth - this.displayedBatteryBarWidth) * t;
    this.batteryBarFillGraphic.width = Math.max(
      0,
      this.displayedBatteryBarWidth
    );
    this.batteryBarFill.scale.setTo(this.displayedBatteryBarWidth / Hud.BATTERY_BAR_WIDTH, 1);
  }

  updateFromState(): void {
    const remainingCapacity = Math.max(
      0,
      this.snapshot.maxCapacity - this.snapshot.usedCapacity
    );
    const maxH = Math.min(this.snapshot.maxHealth, this.maxHealthSegments);
    const health = Math.max(0, Math.min(this.snapshot.health, maxH));
    for (let i = 0; i < this.maxHealthSegments; i++) {
      const segment = this.healthBarSegments[i];
      if (i < maxH) {
        segment.graphics.isVisible = true;
        segment.graphics.use(
          (i < health
            ? this.segmentRemainingSprite
            : this.segmentLostSprite
          ).clone()
        );
      } else {
        segment.graphics.isVisible = false;
      }
    }
    this.capacityLabel.text = `Cargo: ${this.snapshot.usedCapacity}/${this.snapshot.maxCapacity} (left ${remainingCapacity})`;
    this.cargoLabel.text = `Iron: ${this.snapshot.cargo.iron}  Crystal: ${this.snapshot.cargo.crystal}  Gas: ${this.snapshot.cargo.gas}`;
    const totalPieces =
      this.snapshot.cargo.iron +
      this.snapshot.cargo.crystal +
      this.snapshot.cargo.gas;
    this.totalLabel.text = `${totalPieces} in cargo  |  ${this.snapshot.usedCapacity}/${this.snapshot.maxCapacity} slots  |  Biome: ${this.context.biomeName}`;

    const liveState: GoalLiveState = {
      cargo: this.snapshot.cargo,
      usedCapacity: this.snapshot.usedCapacity,
      maxCapacity: this.snapshot.maxCapacity,
      hazardHits: this.context.hazardHits as Record<HazardKind, number>,
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

    this.baseHintLabel.text = this.context.isNearBase
      ? "Press Enter to return to ship"
      : "";

    if (this.context.baseIndicator) {
      this.baseArrowActor.pos = vec(
        this.context.baseIndicator.screenX,
        this.context.baseIndicator.screenY
      );
      this.baseArrowActor.rotation = this.context.baseIndicator.angleRad;
      this.baseArrowActor.graphics.isVisible = true;
    } else {
      this.baseArrowActor.graphics.isVisible = false;
    }
  }
}
