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
import { Button } from "../ui/Button";
import { getCurrentGoals } from "../state/RunGoals";
import {
  getEquipped,
  getOwnedItems,
  setEquipped,
  getCargoLayout,
  setCargoLayout,
  getCargoRows,
  setCargoRows,
  getBank,
  purchaseEquipment,
  spendFromBank,
} from "../state/Progress";
import { requestFullscreen } from "../fullscreen";
import { playClick } from "../audio/sounds";
import type { SlotId } from "../types/roverConfig";
import { ALL_SLOT_IDS } from "../types/roverConfig";
import {
  getUpgradeById,
  getCatalogDefs,
  canAffordCost,
  formatCost,
} from "../upgrades/UpgradeDefs";
import { saveCurrentSave } from "../state/Saves";
import { CARGO_MAX_ROWS, DEFAULT_EQUIPPED_IDS } from "../types/roverConfig";
import type { CargoSlotContentSave } from "../state/Saves";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";

const SLOT_COLORS: Record<SlotId, string> = {
  battery: "#facc15",
  engine: "#f97316",
  control: "#22d3ee",
  shielding: "#f43f5e",
  radar: "#3b82f6",
  blaster: "#a855f7",
};

const SLOT_LABELS: Record<SlotId, string> = {
  battery: "Battery",
  engine: "Engine",
  control: "Control",
  shielding: "Shielding",
  radar: "Radar",
  blaster: "Blaster",
};

export class ConfigureRoverScene extends Scene {
  private goalLabels: Label[] = [];
  private equipmentContainer: Actor[] = [];
  private cargoContainer: Actor[] = [];
  private shopContainer: Actor[] = [];
  private tooltipLabel!: Label;
  private draggingItemId: string | null = null;
  private draggingSlotType: SlotId | null = null;

  private static readonly CARGO_CYCLE: CargoSlotContentSave[] = [
    "empty",
    "gas",
    "crystal",
    "iron",
  ];
  private static CARGO_NEXT(
    current: CargoSlotContentSave
  ): CargoSlotContentSave {
    const i = ConfigureRoverScene.CARGO_CYCLE.indexOf(current) + 1;
    return ConfigureRoverScene.CARGO_CYCLE[
      i % ConfigureRoverScene.CARGO_CYCLE.length
    ]!;
  }

  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    this.refreshGoalLabels();
    this.rebuildEquipmentUI();
    this.rebuildCargoUI();
    this.rebuildShopUI();
  }

  private refreshGoalLabels(): void {
    const goals = getCurrentGoals();
    for (let i = 0; i < 3; i++) {
      if (i < goals.length) {
        this.goalLabels[i].text = goals[i].label;
        this.goalLabels[i].graphics.isVisible = true;
      } else {
        this.goalLabels[i].graphics.isVisible = false;
      }
    }
  }

  private rebuildEquipmentUI(): void {
    this.equipmentContainer.forEach((a) => a.kill());
    this.equipmentContainer = [];
    const equipped = getEquipped();
    const ownedItems = getOwnedItems();
    const bank = getBank();
    const startX = 24;
    const startY = 188;
    const gap = 8;
    const smallFont = new Font({
      family: "system-ui, sans-serif",
      size: 11,
      unit: FontUnit.Px,
    });

    const slotBoxW = 220;
    const slotBoxH = 36;
    ALL_SLOT_IDS.forEach((slotId, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (slotBoxW + gap);
      const y = startY + row * (slotBoxH + gap);
      const color = Color.fromHex(SLOT_COLORS[slotId]);
      const itemId = equipped[slotId];
      const def = itemId ? getUpgradeById(itemId) : null;
      const displayName = def?.isBase ? "Base" : (def?.name ?? "Base");
      const level = itemId ? (ownedItems[itemId] ?? 0) : 0;
      const maxStack = def?.maxStack ?? 1;
      const canLevelUp =
        def && level < maxStack && canAffordCost(bank, def.cost);

      const box = new Actor({
        x: x + slotBoxW / 2,
        y: y + slotBoxH / 2,
        width: slotBoxW,
        height: slotBoxH,
        color: Color.fromHex("#1e293b"),
      });
      box.anchor.setTo(0.5, 0.5);
      box.z = 5;
      const lbl = new Label({
        text: `${SLOT_LABELS[slotId]}: ${displayName} (${level})`,
        pos: vec(x + 8, y + slotBoxH / 2),
        color,
        font: smallFont,
      });
      lbl.anchor.setTo(0, 0.5);
      lbl.z = 6;
      box.on("pointerup", () => {
        if (this.draggingItemId && this.draggingSlotType === slotId) {
          setEquipped(slotId, this.draggingItemId);
          saveCurrentSave();
          playClick();
          this.draggingItemId = null;
          this.draggingSlotType = null;
          this.rebuildEquipmentUI();
        } else if (!this.draggingItemId) {
          setEquipped(slotId, DEFAULT_EQUIPPED_IDS[slotId]);
          saveCurrentSave();
          playClick();
          this.rebuildEquipmentUI();
        }
      });
      box.on("pointerenter", () => {
        if (this.draggingItemId && this.draggingSlotType === slotId) {
          box.color = Color.fromHex("#334155");
        }
      });
      box.on("pointerleave", () => {
        box.color = Color.fromHex("#1e293b");
      });
      this.add(box);
      this.add(lbl);
      this.equipmentContainer.push(box, lbl);

      if (canLevelUp && def) {
        const levelUpBtn = new Button({
          pos: vec(x + slotBoxW - 52, y + slotBoxH / 2),
          width: 88,
          height: 26,
          text: `Level up (${formatCost(def.cost)})`,
          color: Color.White,
          font: new Font({
            family: "system-ui, sans-serif",
            size: 9,
            unit: FontUnit.Px,
          }),
          onClick: () => {
            if (!purchaseEquipment(def)) return;
            playClick();
            this.rebuildEquipmentUI();
            this.rebuildShopUI();
          },
        });
        levelUpBtn.z = 6;
        this.add(levelUpBtn);
        this.equipmentContainer.push(levelUpBtn);
      }
    });

    const invStartY = startY + 3 * (slotBoxH + gap) + 20;
    const invLabel = new Label({
      text: "Inventory (drag to slot):",
      pos: vec(startX, invStartY - 16),
      color: Color.fromHex("#94a3b8"),
      font: smallFont,
    });
    this.add(invLabel);
    this.equipmentContainer.push(invLabel);

    let ix = 0;
    for (const [itemId, level] of Object.entries(ownedItems)) {
      if (level <= 0) continue;
      const def = getUpgradeById(itemId);
      if (!def) continue;
      const col = ix % 6;
      const invRow = Math.floor(ix / 6);
      const invX = startX + col * (78 + 4);
      const invY = invStartY + invRow * 28;
      const chip = new Actor({
        x: invX + 39,
        y: invY + 14,
        width: 78,
        height: 26,
        color: Color.fromHex(SLOT_COLORS[def.slotType]),
      });
      chip.anchor.setTo(0.5, 0.5);
      chip.z = 5;
      const chipLbl = new Label({
        text: `${def.name} (${level})`,
        pos: chip.pos.clone(),
        color: Color.White,
        font: smallFont,
      });
      chipLbl.anchor.setTo(0.5, 0.5);
      chipLbl.z = 6;
      chip.on("pointerdown", () => {
        this.draggingItemId = itemId;
        this.draggingSlotType = def.slotType;
        playClick();
      });
      chip.on("pointerenter", () => {
        this.tooltipLabel.text = `${def.name}\n${def.description}`;
        this.tooltipLabel.pos = vec(chip.pos.x, chip.pos.y - 24);
        this.tooltipLabel.graphics.isVisible = true;
      });
      chip.on("pointerleave", () => {
        this.tooltipLabel.graphics.isVisible = false;
      });
      this.add(chip);
      this.add(chipLbl);
      this.equipmentContainer.push(chip, chipLbl);
      ix++;
    }
  }

  private rebuildCargoUI(): void {
    this.cargoContainer.forEach((a) => a.kill());
    this.cargoContainer = [];
    const layout = getCargoLayout();
    const rows = getCargoRows();
    const cols = 4;
    const cellSize = 44;
    const gap = 4;
    const startX = 24;
    const startY = 328;
    const contentColors: Record<CargoSlotContentSave, string> = {
      empty: "#374151",
      gas: "#22c55e",
      crystal: "#a855f7",
      iron: "#9ca3af",
    };
    const contentLabels: Record<CargoSlotContentSave, string> = {
      empty: "—",
      gas: "Gas Canister",
      crystal: "Crystal Crate",
      iron: "Iron Hopper",
    };
    const smallFont = new Font({
      family: "system-ui, sans-serif",
      size: 10,
      unit: FontUnit.Px,
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const content = layout[idx] ?? "empty";
        const x = startX + c * (cellSize + gap);
        const y = startY + r * (cellSize + gap);
        const cell = new Actor({
          x: x + cellSize / 2,
          y: y + cellSize / 2,
          width: cellSize,
          height: cellSize,
          color: Color.fromHex(contentColors[content]),
        });
        cell.anchor.setTo(0.5, 0.5);
        cell.z = 5;
        const lbl = new Label({
          text: contentLabels[content],
          pos: cell.pos.clone(),
          color: Color.White,
          font: smallFont,
        });
        lbl.anchor.setTo(0.5, 0.5);
        lbl.z = 6;
        cell.on("pointerup", () => {
          const next = ConfigureRoverScene.CARGO_NEXT(content);
          const newLayout = [...layout];
          newLayout[idx] = next;
          setCargoLayout(newLayout);
          saveCurrentSave();
          playClick();
          this.rebuildCargoUI();
        });
        this.add(cell);
        this.add(lbl);
        this.cargoContainer.push(cell, lbl);
      }
    }
  }

  private rebuildShopUI(): void {
    this.shopContainer.forEach((a) => a.kill());
    this.shopContainer = [];
    const bank = getBank();
    const ownedItems = getOwnedItems();
    const startX = 24;
    const startY = 448;
    const rowH = 32;
    const gap = 6;
    const smallFont = new Font({
      family: "system-ui, sans-serif",
      size: 11,
      unit: FontUnit.Px,
    });

    const catalog = getCatalogDefs(ownedItems);
    let y = startY;

    const bankLabel = new Label({
      text: `Bank: ${bank.iron} iron, ${bank.crystal} crystal, ${bank.gas} gas`,
      pos: vec(startX, y),
      color: Color.fromHex("#94a3b8"),
      font: smallFont,
    });
    this.add(bankLabel);
    this.shopContainer.push(bankLabel);
    y += rowH + 4;

    const rows = getCargoRows();
    const canBuyRow = rows < CARGO_MAX_ROWS && bank.crystal >= 8;
    if (canBuyRow) {
      const rowBtn = new Button({
        pos: vec(startX + 70, y + 16),
        width: 140,
        height: 28,
        text: "+1 Cargo Row (8 crystal)",
        color: Color.Black,
        font: smallFont,
        onClick: () => {
          if (!spendFromBank({ crystal: 8 })) return;
          setCargoRows(rows + 1);
          saveCurrentSave();
          playClick();
          this.rebuildCargoUI();
          this.rebuildShopUI();
        },
      });
      this.add(rowBtn);
      this.shopContainer.push(rowBtn);
      y += rowH + gap;
    }

    const catalogTitle = new Label({
      text: "Buy new equipment (level 0 → 1):",
      pos: vec(startX, y),
      color: Color.fromHex("#fcd34d"),
      font: smallFont,
    });
    this.add(catalogTitle);
    this.shopContainer.push(catalogTitle);
    y += rowH + 2;

    for (const def of catalog) {
      const affordable = canAffordCost(bank, def.cost);
      const rowBg = new Actor({
        x: startX + 200,
        y: y + rowH / 2,
        width: 380,
        height: rowH,
        color: Color.fromHex("#1e293b"),
      });
      rowBg.anchor.setTo(0.5, 0.5);
      rowBg.z = 5;
      const nameLbl = new Label({
        text: `${def.name} — ${def.description}`,
        pos: vec(startX + 8, y + 4),
        color: Color.fromHex("#e2e8f0"),
        font: smallFont,
      });
      const costLbl = new Label({
        text: formatCost(def.cost),
        pos: vec(startX + 8, y + 16),
        color: Color.fromHex("#94a3b8"),
        font: new Font({
          family: "system-ui, sans-serif",
          size: 10,
          unit: FontUnit.Px,
        }),
      });
      const purchaseBtn = new Button({
        pos: vec(startX + 340, y + rowH / 2),
        width: 72,
        height: 24,
        text: "Purchase",
        color: Color.White,
        font: smallFont,
        onClick: () => {
          if (!purchaseEquipment(def)) return;
          playClick();
          this.rebuildEquipmentUI();
          this.rebuildShopUI();
        },
      });
      purchaseBtn.z = 6;
      if (!affordable) purchaseBtn.setHighlighted(false);
      this.add(rowBg);
      this.add(nameLbl);
      this.add(costLbl);
      this.add(purchaseBtn);
      this.shopContainer.push(rowBg, nameLbl, costLbl, purchaseBtn);
      y += rowH + gap;
    }
  }

  onInitialize(): void {
    const cx = this.engine.drawWidth / 2;
    const h = this.engine.drawHeight;

    this.tooltipLabel = new Label({
      text: "",
      pos: vec(0, 0),
      color: Color.fromHex("#e2e8f0"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 12,
        unit: FontUnit.Px,
      }),
    });
    this.tooltipLabel.anchor.setTo(0.5, 0.5);
    this.tooltipLabel.graphics.isVisible = false;
    this.tooltipLabel.z = 100;
    this.add(this.tooltipLabel);

    const cancelDragArea = new Actor({
      x: cx,
      y: h / 2,
      width: this.engine.drawWidth,
      height: this.engine.drawHeight,
      color: Color.Transparent,
    });
    cancelDragArea.anchor.setTo(0.5, 0.5);
    cancelDragArea.z = -1;
    cancelDragArea.on("pointerup", () => {
      this.draggingItemId = null;
      this.draggingSlotType = null;
    });
    this.add(cancelDragArea);

    const title = new Label({
      text: "Configure Rover",
      pos: vec(cx, 32),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 28,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);
    this.add(title);

    const goalTitle = new Label({
      text: "Mission goals:",
      pos: vec(cx, 68),
      color: Color.fromHex("#fbbf24"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    goalTitle.anchor.setTo(0.5, 0.5);
    this.add(goalTitle);

    const goalFont = new Font({
      family: "system-ui, sans-serif",
      size: 13,
      unit: FontUnit.Px,
    });
    for (let i = 0; i < 3; i++) {
      const lbl = new Label({
        text: "",
        pos: vec(cx, 92 + i * 22),
        color: Color.fromHex("#e2e8f0"),
        font: goalFont,
      });
      lbl.anchor.setTo(0.5, 0.5);
      this.goalLabels.push(lbl);
      this.add(lbl);
    }

    const equipmentTitle = new Label({
      text: "Equipment (slots & inventory)",
      pos: vec(24, 168),
      color: Color.fromHex("#a5b4fc"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    this.add(equipmentTitle);

    const cargoTitle = new Label({
      text: "Cargo layout",
      pos: vec(24, 318),
      color: Color.fromHex("#86efac"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    this.add(cargoTitle);

    const shopTitle = new Label({
      text: "Buy upgrades",
      pos: vec(24, 432),
      color: Color.fromHex("#fcd34d"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    this.add(shopTitle);

    const startBtn = new Button({
      pos: vec(cx, h - 100),
      width: 220,
      height: 52,
      text: "Start Mission",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        requestFullscreen().finally(() => {
          goToScene(this.engine, SCENE_KEYS.planet);
        });
      },
    });

    const backBtn = new Button({
      pos: vec(cx, h - 44),
      width: 180,
      height: 40,
      text: "Back",
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        goToScene(this.engine, SCENE_KEYS.planetRunMenu);
      },
    });

    this.add(startBtn);
    this.add(backBtn);
  }
}
