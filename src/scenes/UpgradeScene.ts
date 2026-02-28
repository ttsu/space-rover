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
import { getBank, getAppliedUpgrades, applyUpgrade } from "../state/Progress";
import {
  canAffordAnyUpgrade,
  get3RandomAffordable,
  type UpgradeDef,
} from "../upgrades/UpgradeDefs";
import type { ResourceId } from "../resources/ResourceTypes";

export class UpgradeScene extends Scene {
  private engineRef: Engine;
  private chosenResource: ResourceId | null = null;
  private options: UpgradeDef[] = [];
  private titleLabel!: Label;
  private messageLabel!: Label;
  private optionLabels: Label[] = [];
  private optionActors: Actor[] = [];

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onActivate(): void {
    this.rebuildUI();
  }

  private rebuildUI(): void {
    this.optionLabels.forEach((l) => l.kill());
    this.optionActors.forEach((a) => a.kill());
    this.optionLabels = [];
    this.optionActors = [];

    const bank = getBank();
    const applied = getAppliedUpgrades();
    const canAfford = canAffordAnyUpgrade(bank, applied);
    const affordableResources = (["iron", "crystal", "gas"] as const).filter(
      (r) => canAfford[r]
    );

    if (affordableResources.length === 0) {
      this.titleLabel.text = "Upgrade Rover";
      this.messageLabel.text =
        "You don't have enough resources to buy any upgrade yet.\nCollect more and return to base!";
      return;
    }

    if (this.chosenResource === null) {
      this.titleLabel.text = "Choose resource to spend";
      const lines = affordableResources.map(
        (r) => `${r}: ${bank[r]} (tap to choose)`
      );
      this.messageLabel.text =
        lines.join("\n") +
        "\n\nClick a resource button below to see 3 upgrade choices.";
      this.showResourceButtons(affordableResources);
      return;
    }

    if (this.options.length === 0) {
      this.options = get3RandomAffordable(bank, this.chosenResource, applied);
      if (this.options.length === 0) {
        this.messageLabel.text = "No upgrades available for this resource.";
        return;
      }
    }

    this.titleLabel.text = `Spend ${this.chosenResource} – pick one`;
    this.messageLabel.text = this.options
      .map(
        (o, i) =>
          `${i + 1}. ${o.name} (${o.cost} ${this.chosenResource}): ${o.description}`
      )
      .join("\n");
    this.showOptionButtons();
  }

  private showResourceButtons(resources: ResourceId[]): void {
    const cx = this.engineRef.drawWidth / 2;
    const startY = this.engineRef.drawHeight / 2 + 40;
    const spacing = 56;
    resources.forEach((r, i) => {
      const btn = new Actor({
        pos: vec(cx, startY + i * spacing),
        width: 180,
        height: 44,
        color:
          r === "iron"
            ? Color.fromHex("#9ca3af")
            : r === "crystal"
              ? Color.fromHex("#a855f7")
              : Color.fromHex("#22c55e"),
      });
      btn.anchor.setTo(0.5, 0.5);
      const label = new Label({
        text: `Spend ${r}`,
        pos: btn.pos.clone(),
        color: Color.White,
        font: new Font({
          family: "system-ui, sans-serif",
          size: 18,
          unit: FontUnit.Px,
        }),
      });
      label.anchor.setTo(0.5, 0.5);
      const resource = r;
      btn.on("pointerup", () => {
        this.chosenResource = resource;
        this.rebuildUI();
      });
      this.add(btn);
      this.add(label);
      this.optionActors.push(btn);
      this.optionLabels.push(label);
    });
  }

  private showOptionButtons(): void {
    const cx = this.engineRef.drawWidth / 2;
    const startY = this.engineRef.drawHeight / 2 + 20;
    const spacing = 52;
    this.options.forEach((opt, i) => {
      const btn = new Actor({
        pos: vec(cx, startY + i * spacing),
        width: 320,
        height: 40,
        color: Color.fromHex("#3b82f6"),
      });
      btn.anchor.setTo(0.5, 0.5);
      const label = new Label({
        text: `${opt.name} – ${opt.cost} ${this.chosenResource}`,
        pos: btn.pos.clone(),
        color: Color.White,
        font: new Font({
          family: "system-ui, sans-serif",
          size: 16,
          unit: FontUnit.Px,
        }),
      });
      label.anchor.setTo(0.5, 0.5);
      const def = opt;
      btn.on("pointerup", () => {
        if (applyUpgrade(def)) {
          this.chosenResource = null;
          this.options = [];
          this.rebuildUI();
        }
      });
      this.add(btn);
      this.add(label);
      this.optionActors.push(btn);
      this.optionLabels.push(label);
    });
  }

  onInitialize(): void {
    const cx = this.engineRef.drawWidth / 2;

    this.titleLabel = new Label({
      text: "Upgrade Rover",
      pos: vec(cx, this.engineRef.drawHeight / 2 - 100),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 36,
        unit: FontUnit.Px,
      }),
    });
    this.titleLabel.anchor.setTo(0.5, 0.5);

    this.messageLabel = new Label({
      text: "",
      pos: vec(cx, this.engineRef.drawHeight / 2 - 40),
      color: Color.fromHex("#e5e7eb"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
    });
    this.messageLabel.anchor.setTo(0.5, 0.5);

    const backBtn = new Actor({
      pos: vec(cx, this.engineRef.drawHeight - 50),
      width: 200,
      height: 50,
      color: Color.fromHex("#6b7280"),
    });
    backBtn.anchor.setTo(0.5, 0.5);
    const backLabel = new Label({
      text: "Back to Menu",
      pos: backBtn.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
    });
    backLabel.anchor.setTo(0.5, 0.5);
    backBtn.on("pointerup", () => {
      this.chosenResource = null;
      this.options = [];
      this.engineRef.goToScene("mainMenu");
    });

    this.add(this.titleLabel);
    this.add(this.messageLabel);
    this.add(backBtn);
    this.add(backLabel);
  }
}
