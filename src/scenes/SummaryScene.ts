import {
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  Actor,
} from "excalibur";
import { GameState } from "../state/GameState";
import { getBank } from "../state/Progress";

export class SummaryScene extends Scene {
  private engineRef: Engine;
  private statsLabel!: Label;

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onInitialize() {
    const title = new Label({
      text: "Mission Summary",
      pos: vec(
        this.engineRef.drawWidth / 2,
        this.engineRef.drawHeight / 2 - 120
      ),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 40,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    this.statsLabel = new Label({
      text: "",
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2),
      color: Color.fromHex("#e5e7eb"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
    });
    this.statsLabel.anchor.setTo(0.5, 0.5);

    const cx = this.engineRef.drawWidth / 2;

    const menuButton = new Actor({
      pos: vec(cx, this.engineRef.drawHeight / 2 + 100),
      width: 220,
      height: 56,
      color: Color.fromHex("#3b82f6"),
    });
    menuButton.anchor.setTo(0.5, 0.5);
    const menuLabel = new Label({
      text: "Back to Menu",
      pos: menuButton.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 24,
        unit: FontUnit.Px,
      }),
    });
    menuLabel.anchor.setTo(0.5, 0.5);
    menuButton.on("pointerup", () => {
      this.engineRef.goToScene("mainMenu");
    });

    const upgradeButton = new Actor({
      pos: vec(cx, this.engineRef.drawHeight / 2 + 168),
      width: 220,
      height: 48,
      color: Color.fromHex("#8b5cf6"),
    });
    upgradeButton.anchor.setTo(0.5, 0.5);
    const upgradeLabel = new Label({
      text: "Upgrade Rover",
      pos: upgradeButton.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
    });
    upgradeLabel.anchor.setTo(0.5, 0.5);
    upgradeButton.on("pointerup", () => {
      this.engineRef.goToScene("upgrade");
    });

    this.add(title);
    this.add(this.statsLabel);
    this.add(menuButton);
    this.add(menuLabel);
    this.add(upgradeButton);
    this.add(upgradeLabel);
  }

  onActivate(): void {
    const run = GameState.lastRun;
    if (!run) {
      this.statsLabel.text = "No mission data yet.\nExplore a planet first!";
      return;
    }

    const totalPieces = run.cargo.iron + run.cargo.crystal + run.cargo.gas;

    const failed = run.healthRemaining <= 0;
    const header = failed
      ? "Mission failed.\nRover powered down.\n\n"
      : "Mission complete!\n\n";
    if (!failed) {
      this.statsLabel.text =
        header +
        `You collected ${run.cargo.iron} iron, ${run.cargo.crystal} crystal,\n` +
        `and ${run.cargo.gas} gas. That is ${totalPieces} pieces in all.\n` +
        `Added to your bank! Capacity used: ${run.usedCapacity}/${run.maxCapacity}.\n\n`;
    } else {
      this.statsLabel.text =
        header +
        `You had ${run.cargo.iron} iron, ${run.cargo.crystal} crystal,\n` +
        `and ${run.cargo.gas} gas. (Return to base to save them.)\n` +
        `Capacity used: ${run.usedCapacity}/${run.maxCapacity}.\n\n`;
    }
    const bank = getBank();
    this.statsLabel.text +=
      `Bank: ${bank.iron} iron, ${bank.crystal} crystal, ${bank.gas} gas.\n` +
      `Best run so far: ${GameState.bestTotalCargo} pieces.`;
  }
}
