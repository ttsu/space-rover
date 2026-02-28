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

export class MainMenuScene extends Scene {
  private engineRef: Engine;
  private bankLabel!: Label;
  private upgradeButton!: Actor;
  private touchToggleLabel?: Label;
  private touchToggleButton?: Actor;

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onActivate(): void {
    this.updateBankAndUpgradeButton();
    this.touchToggleLabel && this.updateTouchToggleLabel();
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

  onInitialize() {
    const cx = this.engineRef.drawWidth / 2;

    const title = new Label({
      text: "Starship Rover",
      pos: vec(cx, this.engineRef.drawHeight / 2 - 100),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 48,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    const subtitle = new Label({
      text: "Explore planets, collect resources,\nuse your math power!",
      pos: vec(cx, this.engineRef.drawHeight / 2 - 30),
      color: Color.fromHex("#c1d5ff"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
    });
    subtitle.anchor.setTo(0.5, 0.5);

    this.bankLabel = new Label({
      text: "Bank: 0 iron, 0 crystal, 0 gas",
      pos: vec(cx, this.engineRef.drawHeight / 2 + 30),
      color: Color.fromHex("#9ca3af"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
    });
    this.bankLabel.anchor.setTo(0.5, 0.5);

    const playButton = new Actor({
      pos: vec(cx, this.engineRef.drawHeight / 2 + 90),
      width: 200,
      height: 56,
      color: Color.fromHex("#3b82f6"),
    });
    playButton.anchor.setTo(0.5, 0.5);
    const playLabel = new Label({
      text: "Play",
      pos: playButton.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 28,
        unit: FontUnit.Px,
      }),
    });
    playLabel.anchor.setTo(0.5, 0.5);
    playButton.on("pointerup", () => {
      requestFullscreen().finally(() => {
        this.engineRef.goToScene("planet");
      });
    });

    this.upgradeButton = new Actor({
      pos: vec(cx, this.engineRef.drawHeight / 2 + 158),
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
      this.engineRef.goToScene("upgrade");
    });

    if (isTouchDeviceCapable()) {
      this.touchToggleButton = new Actor({
        pos: vec(cx, this.engineRef.drawHeight / 2 + 218),
        width: 200,
        height: 40,
        color: Color.fromHex("#4b5563"),
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
        setTouchControlsEnabled(!getTouchControlsEnabled());
        this.updateTouchToggleLabel();
      });
      this.add(this.touchToggleButton);
      this.add(this.touchToggleLabel);
    }

    this.add(title);
    this.add(subtitle);
    this.add(this.bankLabel);
    this.add(playButton);
    this.add(playLabel);
    this.add(this.upgradeButton);
    this.add(upgradeLabel);
  }
}
