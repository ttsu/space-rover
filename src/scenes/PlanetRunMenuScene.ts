import {
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  Actor,
  vec,
} from "excalibur";
import { getBank, getAppliedUpgrades } from "../state/Progress";
import { canAffordAnyUpgrade } from "../upgrades/UpgradeDefs";
import { requestFullscreen } from "../fullscreen";
import {
  getTouchControlsEnabled,
  setTouchControlsEnabled,
  isTouchDeviceCapable,
} from "../input/TouchInputState";
import {
  generateGoalChoices,
  setCurrentGoals,
  type RunGoal,
} from "../state/RunGoals";
import { playClick } from "../audio/sounds";

export class PlanetRunMenuScene extends Scene {
  private engineRef: Engine;
  private bankLabel!: Label;
  private upgradeButton!: Actor;
  private touchToggleLabel?: Label;
  private touchToggleButton?: Actor;

  private goalChoices: RunGoal[] = [];
  private goalLabels: Label[] = [];

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onActivate(): void {
    this.updateBankAndUpgradeButton();
    this.touchToggleLabel && this.updateTouchToggleLabel();
    this.refreshGoalChoices();
  }

  private updateBankAndUpgradeButton(): void {
    const bank = getBank();
    this.bankLabel.text = `Bank: ${bank.iron} iron, ${bank.crystal} crystal, ${bank.gas} gas`;
    const applied = getAppliedUpgrades();
    const canAfford = canAffordAnyUpgrade(bank, applied);
    const anyAffordable = canAfford.iron || canAfford.crystal || canAfford.gas;
    this.upgradeButton.color = anyAffordable
      ? Color.fromHex("#8b5cf6")
      : Color.fromHex("#6b7280");
  }

  private updateTouchToggleLabel(): void {
    if (this.touchToggleLabel) {
      this.touchToggleLabel.text = getTouchControlsEnabled()
        ? "Touch controls: On"
        : "Touch controls: Off";
    }
  }

  private refreshGoalChoices(): void {
    this.goalChoices = generateGoalChoices(3);
    for (let i = 0; i < 3; i++) {
      if (i < this.goalChoices.length) {
        this.goalLabels[i].text = this.goalChoices[i].label;
        this.goalLabels[i].graphics.visible = true;
      } else {
        this.goalLabels[i].graphics.visible = false;
      }
    }
  }

  onInitialize() {
    const cx = this.engineRef.drawWidth / 2;
    const midY = this.engineRef.drawHeight / 2;

    const title = new Label({
      text: "Planet base",
      pos: vec(cx, midY - 190),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 36,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    this.bankLabel = new Label({
      text: "Bank: 0 iron, 0 crystal, 0 gas",
      pos: vec(cx, midY - 145),
      color: Color.fromHex("#9ca3af"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
    });
    this.bankLabel.anchor.setTo(0.5, 0.5);

    const goalTitle = new Label({
      text: "Mission goals (complete any for bonus):",
      pos: vec(cx, midY - 110),
      color: Color.fromHex("#fbbf24"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });
    goalTitle.anchor.setTo(0.5, 0.5);

    this.add(title);
    this.add(this.bankLabel);
    this.add(goalTitle);

    const goalFont = new Font({
      family: "system-ui, sans-serif",
      size: 15,
      unit: FontUnit.Px,
    });

    for (let i = 0; i < 3; i++) {
      const yPos = midY - 80 + i * 28;
      const lbl = new Label({
        text: "",
        pos: vec(cx, yPos),
        color: Color.fromHex("#e2e8f0"),
        font: goalFont,
      });
      lbl.anchor.setTo(0.5, 0.5);
      this.goalLabels.push(lbl);
      this.add(lbl);
    }

    const startRunButton = new Actor({
      pos: vec(cx, midY + 50),
      width: 200,
      height: 56,
      color: Color.fromHex("#3b82f6"),
    });
    startRunButton.anchor.setTo(0.5, 0.5);
    const startRunLabel = new Label({
      text: "Start Run",
      pos: startRunButton.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 24,
        unit: FontUnit.Px,
      }),
    });
    startRunLabel.anchor.setTo(0.5, 0.5);
    startRunButton.on("pointerup", () => {
      playClick();
      setCurrentGoals(this.goalChoices);
      requestFullscreen().finally(() => {
        this.engineRef.goToScene("planet");
      });
    });

    this.upgradeButton = new Actor({
      pos: vec(cx, midY + 114),
      width: 200,
      height: 48,
      color: Color.fromHex("#8b5cf6"),
    });
    this.upgradeButton.anchor.setTo(0.5, 0.5);
    const upgradeLabel = new Label({
      text: "Upgrade Rover",
      pos: this.upgradeButton.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
    });
    upgradeLabel.anchor.setTo(0.5, 0.5);
    this.upgradeButton.on("pointerup", () => {
      playClick();
      this.engineRef.goToScene("upgrade");
    });

    const exitButton = new Actor({
      pos: vec(cx, midY + 170),
      width: 200,
      height: 48,
      color: Color.fromHex("#4b5563"),
    });
    exitButton.anchor.setTo(0.5, 0.5);
    const exitLabel = new Label({
      text: "Exit to Main Menu",
      pos: exitButton.pos.clone(),
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
    });
    exitLabel.anchor.setTo(0.5, 0.5);
    exitButton.on("pointerup", () => {
      playClick();
      this.engineRef.goToScene("mainMenu");
    });

    this.add(startRunButton);
    this.add(startRunLabel);
    this.add(this.upgradeButton);
    this.add(upgradeLabel);
    this.add(exitButton);
    this.add(exitLabel);

    if (isTouchDeviceCapable()) {
      this.touchToggleButton = new Actor({
        pos: vec(cx, midY + 226),
        width: 200,
        height: 40,
        color: Color.fromHex("#374151"),
      });
      this.touchToggleButton.anchor.setTo(0.5, 0.5);
      this.touchToggleLabel = new Label({
        text: getTouchControlsEnabled()
          ? "Touch controls: On"
          : "Touch controls: Off",
        pos: this.touchToggleButton.pos.clone(),
        color: Color.fromHex("#d1d5db"),
        font: new Font({
          family: "system-ui, sans-serif",
          size: 18,
          unit: FontUnit.Px,
        }),
      });
      this.touchToggleLabel.anchor.setTo(0.5, 0.5);
      this.touchToggleButton.on("pointerup", () => {
        playClick();
        setTouchControlsEnabled(!getTouchControlsEnabled());
        this.updateTouchToggleLabel();
      });
      this.add(this.touchToggleButton);
      this.add(this.touchToggleLabel);
    }
  }
}
