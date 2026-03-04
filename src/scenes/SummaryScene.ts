import { Engine, Scene, Label, Color, Font, FontUnit, vec } from "excalibur";
import { Button } from "../ui/Button";
import { GameState } from "../state/GameState";
import { getBank } from "../state/Progress";
import { getGoalResults } from "../state/RunGoals";
import { playClick } from "../audio/sounds";

export class SummaryScene extends Scene {
  private statsLabel!: Label;
  private goalResultLabel!: Label;

  constructor(_engine: Engine) {
    super();
  }

  onInitialize() {
    const title = new Label({
      text: "Mission Summary",
      pos: vec(this.engine.drawWidth / 2, this.engine.drawHeight / 2 - 150),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 40,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    this.goalResultLabel = new Label({
      text: "",
      pos: vec(this.engine.drawWidth / 2, this.engine.drawHeight / 2 - 110),
      color: Color.fromHex("#fbbf24"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
    });
    this.goalResultLabel.anchor.setTo(0.5, 0.5);

    this.statsLabel = new Label({
      text: "",
      pos: vec(this.engine.drawWidth / 2, this.engine.drawHeight / 2 - 20),
      color: Color.fromHex("#e5e7eb"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
    });
    this.statsLabel.anchor.setTo(0.5, 0.5);

    const cx = this.engine.drawWidth / 2;

    const menuButton = new Button({
      pos: vec(cx, this.engine.drawHeight / 2 + 100),
      width: 220,
      height: 56,
      text: "Back to Menu",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 24,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.engine.goToScene("planetRunMenu");
      },
    });

    this.add(title);
    this.add(this.goalResultLabel);
    this.add(this.statsLabel);
    this.add(menuButton);
  }

  onActivate(): void {
    const run = GameState.lastRun;
    if (!run) {
      this.statsLabel.text = "No mission data yet.\nExplore a planet first!";
      this.goalResultLabel.text = "";
      return;
    }

    const results = getGoalResults();
    if (results.length > 0) {
      const lines = results.map(
        (r) =>
          (r.met ? "✓ " : "○ ") +
          r.goal.label +
          (r.met ? ` (+${r.bonusAmount} ${r.bonusResource})` : "")
      );
      const bonusTotal: Record<string, number> = {
        iron: 0,
        crystal: 0,
        gas: 0,
      };
      for (const r of results) {
        if (r.met && r.bonusAmount > 0)
          bonusTotal[r.bonusResource] += r.bonusAmount;
      }
      const bonusParts = (["iron", "crystal", "gas"] as const)
        .filter((id) => bonusTotal[id] > 0)
        .map((id) => `+${bonusTotal[id]} ${id}`);
      this.goalResultLabel.text =
        lines.join("\n") +
        (bonusParts.length > 0 ? "\n\nBonus: " + bonusParts.join(", ") : "");
      this.goalResultLabel.color = Color.fromHex("#fbbf24");
    } else {
      this.goalResultLabel.text = "";
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
