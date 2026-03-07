import {
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  TextAlign,
  vec,
} from "excalibur";
import { Button } from "../ui/Button";
import {
  getBank,
  getShipUpgrades,
  setShipUpgrade,
  getCurrentPlanetId,
  spendFromBank,
} from "../state/Progress";
import { playClick } from "../audio/sounds";
import {
  getShipStats,
  getShipUpgradeCost,
  type ShipUpgradeId,
  SHIP_UPGRADE_IDS,
} from "../config/shipConfig";
import {
  DEFAULT_SOLAR_SYSTEM,
  getPlanetById,
} from "../config/solarSystemConfig";

const UPGRADE_LABELS: Record<ShipUpgradeId, string> = {
  thrust: "Thrust",
  turnSpeed: "Turn",
  maxSpeed: "Max speed",
  hull: "Hull",
  heatShielding: "Heat shield",
};

export class SpaceshipScene extends Scene {
  private statsLabel!: Label;
  private locationLabel!: Label;
  private upgradeButtons: Map<ShipUpgradeId, Button> = new Map();

  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    this.refreshStats();
    this.refreshUpgradeButtons();
  }

  private refreshStats(): void {
    const upgrades = getShipUpgrades();
    const stats = getShipStats(upgrades);
    this.statsLabel.text = [
      `Thrust: ${Math.round(stats.thrust)}`,
      `Turn: ${stats.turnSpeed.toFixed(1)}`,
      `Max speed: ${Math.round(stats.maxSpeed)}`,
      `Hull: ${Math.round(stats.hull)}`,
      `Heat shield: ${(stats.heatShielding * 100).toFixed(0)}%`,
    ].join("  |  ");
    const planetId = getCurrentPlanetId();
    const planet = getPlanetById(DEFAULT_SOLAR_SYSTEM, planetId);
    this.locationLabel.text = planet
      ? `Current location: ${planet.name}`
      : `Current location: ${planetId}`;
  }

  private refreshUpgradeButtons(): void {
    const bank = getBank();
    const upgrades = getShipUpgrades();
    for (const id of SHIP_UPGRADE_IDS) {
      const btn = this.upgradeButtons.get(id);
      if (!btn) continue;
      const level = upgrades[id] ?? 0;
      const cost = getShipUpgradeCost(id, level);
      const canAfford =
        bank.iron >= cost.iron &&
        bank.crystal >= cost.crystal &&
        bank.gas >= cost.gas;
      btn.graphics.isVisible = true;
      btn.setText(
        `${UPGRADE_LABELS[id]} (${level}) — ${cost.iron}i ${cost.crystal}c ${cost.gas}g`
      );
      btn.setHighlighted(canAfford);
    }
  }

  onInitialize(): void {
    const cx = this.engine.drawWidth / 2;
    const midY = this.engine.drawHeight / 2;

    const title = new Label({
      text: "Spaceship",
      pos: vec(cx, midY - 200),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 36,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);
    this.add(title);

    this.locationLabel = new Label({
      text: "Current location: —",
      pos: vec(cx, midY - 160),
      color: Color.fromHex("#9ca3af"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });
    this.locationLabel.anchor.setTo(0.5, 0.5);
    this.add(this.locationLabel);

    this.statsLabel = new Label({
      text: "",
      pos: vec(cx, midY - 125),
      color: Color.fromHex("#e2e8f0"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    this.statsLabel.anchor.setTo(0.5, 0.5);
    this.statsLabel.font!.textAlign = TextAlign.Center;
    this.add(this.statsLabel);

    const smallFont = new Font({
      family: "system-ui, sans-serif",
      size: 14,
      unit: FontUnit.Px,
    });

    let row = 0;
    for (const id of SHIP_UPGRADE_IDS) {
      const y = midY - 85 + row * 32;
      const btn = new Button({
        pos: vec(cx, y),
        width: 380,
        height: 28,
        text: `${UPGRADE_LABELS[id]} (0)`,
        color: Color.fromHex("#e2e8f0"),
        font: smallFont,
        onClick: () => {
          playClick();
          const upgrades = getShipUpgrades();
          const level = upgrades[id] ?? 0;
          const cost = getShipUpgradeCost(id, level);
          if (spendFromBank(cost)) {
            setShipUpgrade(id, level + 1);
            this.refreshStats();
            this.refreshUpgradeButtons();
          }
        },
      });
      this.add(btn);
      this.upgradeButtons.set(id, btn);
      row++;
    }

    const launchButton = new Button({
      pos: vec(cx, midY + 80),
      width: 220,
      height: 52,
      text: "Launch to orbit",
      color: Color.fromHex("#22c55e"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.engine.goToScene("spaceNav");
      },
    });
    this.add(launchButton);

    const backButton = new Button({
      pos: vec(cx, midY + 148),
      width: 200,
      height: 48,
      text: "Back to base",
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.engine.goToScene("planetRunMenu");
      },
    });
    this.add(backButton);
  }
}
