import {
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  Keys,
} from "excalibur";
import { Button } from "../ui/Button";
import {
  getBank,
  getOwnedItems,
  getEquipped,
  isShipRepaired,
  canRepairShip,
  spendForShipRepair,
} from "../state/Progress";
import { canAffordAnyEquipment } from "../upgrades/UpgradeDefs";
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
import { getCurrentSave } from "../state/Saves";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";

export class PlanetRunMenuScene extends Scene {
  private bankLabel!: Label;
  private configureButton!: Button;
  private spaceshipButton?: Button;
  private repairShipButton?: Button;
  private touchToggleButton?: Button;

  private goalChoices: RunGoal[] = [];
  private goalLabels: Label[] = [];

  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    this.updateBankAndUpgradeButton();
    this.updateShipButtons();
    this.touchToggleButton && this.updateTouchToggleLabel();
    this.refreshGoalChoices();
    setCurrentGoals(this.goalChoices);
  }

  onPreUpdate(engine: Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.T)) {
      setTouchControlsEnabled(!getTouchControlsEnabled());
      this.updateTouchToggleLabel();
    }
  }

  private updateBankAndUpgradeButton(): void {
    const bank = getBank();
    this.bankLabel.text = `Bank: ${bank.iron} iron, ${bank.crystal} crystal, ${bank.gas} gas`;
    const ownedItems = getOwnedItems();
    const equipped = getEquipped();
    const anyAffordable = canAffordAnyEquipment(bank, ownedItems, equipped);
    this.configureButton.setHighlighted(anyAffordable);
  }

  private updateShipButtons(): void {
    const repaired = isShipRepaired();
    if (this.spaceshipButton) {
      this.spaceshipButton.graphics.isVisible = repaired;
    }
    if (this.repairShipButton) {
      this.repairShipButton.graphics.isVisible = !repaired && canRepairShip();
    }
  }

  private updateTouchToggleLabel(): void {
    if (this.touchToggleButton) {
      this.touchToggleButton.setText(
        getTouchControlsEnabled() ? "Touch controls: On" : "Touch controls: Off"
      );
    }
  }

  private refreshGoalChoices(): void {
    const save = getCurrentSave();
    this.goalChoices = generateGoalChoices(3, {
      biomePreset: save?.biomePreset ?? "mixed",
    });
    for (let i = 0; i < 3; i++) {
      if (i < this.goalChoices.length) {
        this.goalLabels[i].text = this.goalChoices[i].label;
        this.goalLabels[i].graphics.isVisible = true;
      } else {
        this.goalLabels[i].graphics.isVisible = false;
      }
    }
  }

  onInitialize() {
    const cx = this.engine.drawWidth / 2;
    const midY = this.engine.drawHeight / 2;

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

    const startRunButton = new Button({
      pos: vec(cx, midY + 50),
      width: 200,
      height: 56,
      text: "Start Run",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 24,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        setCurrentGoals(this.goalChoices);
        requestFullscreen().finally(() => {
          goToScene(this.engine, SCENE_KEYS.planet);
        });
      },
    });

    this.configureButton = new Button({
      pos: vec(cx, midY + 114),
      width: 200,
      height: 48,
      text: "Configure Rover",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        goToScene(this.engine, SCENE_KEYS.configureRover);
      },
    });

    this.spaceshipButton = new Button({
      pos: vec(cx, midY + 170),
      width: 200,
      height: 48,
      text: "Spaceship",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        goToScene(this.engine, SCENE_KEYS.spaceship);
      },
    });
    this.spaceshipButton.graphics.isVisible = isShipRepaired();
    this.add(this.spaceshipButton);

    this.repairShipButton = new Button({
      pos: vec(cx, midY + 170),
      width: 200,
      height: 48,
      text: "Repair ship",
      color: Color.fromHex("#fbbf24"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        if (spendForShipRepair()) {
          this.updateBankAndUpgradeButton();
          this.updateShipButtons();
        }
      },
    });
    this.repairShipButton.graphics.isVisible =
      !isShipRepaired() && canRepairShip();
    this.add(this.repairShipButton);

    const exitButton = new Button({
      pos: vec(cx, midY + 226),
      width: 200,
      height: 48,
      text: "Exit to Main Menu",
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        goToScene(this.engine, SCENE_KEYS.mainMenu);
      },
    });

    this.add(startRunButton);
    this.add(this.configureButton);
    this.add(exitButton);

    if (isTouchDeviceCapable()) {
      this.touchToggleButton = new Button({
        pos: vec(cx, midY + 282),
        width: 200,
        height: 40,
        text: getTouchControlsEnabled()
          ? "Touch controls: On"
          : "Touch controls: Off",
        color: Color.fromHex("#d1d5db"),
        font: new Font({
          family: "system-ui, sans-serif",
          size: 18,
          unit: FontUnit.Px,
        }),
        onClick: () => {
          playClick();
          setTouchControlsEnabled(!getTouchControlsEnabled());
          this.updateTouchToggleLabel();
        },
      });
      this.add(this.touchToggleButton);
    }
  }
}
