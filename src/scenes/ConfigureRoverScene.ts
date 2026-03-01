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
  canAffordAnyUpgradeByOwned,
  get3RandomAffordableByOwned,
  type UpgradeDef,
} from "../upgrades/UpgradeDefs";
import type { ResourceId } from "../resources/ResourceTypes";
import { saveCurrentSave } from "../state/Saves";
import { CARGO_MAX_ROWS } from "../types/roverConfig";
import type { CargoSlotContentSave } from "../state/Saves";

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
  private engineRef: Engine;
  private goalLabels: Label[] = [];
  private equipmentContainer: Actor[] = [];
  private cargoContainer: Actor[] = [];
  private shopContainer: Actor[] = [];
  private tooltipLabel!: Label;
  private draggingItemId: string | null = null;
  private draggingSlotType: SlotId | null = null;
  private shopChosenResource: ResourceId | null = null;
  private shopOptions: UpgradeDef[] = [];

  private static readonly CARGO_CYCLE: CargoSlotContentSave[] = [
    "empty",
    "gas",
    "crystal",
    "iron",
  ];
  private static CARGO_NEXT(current: CargoSlotContentSave): CargoSlotContentSave {
    const i =
      ConfigureRoverScene.CARGO_CYCLE.indexOf(current) + 1;
    return ConfigureRoverScene.CARGO_CYCLE[
      i % ConfigureRoverScene.CARGO_CYCLE.length
    ]!;
  }

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
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
        this.goalLabels[i].graphics.visible = true;
      } else {
        this.goalLabels[i].graphics.visible = false;
      }
    }
  }

  private rebuildEquipmentUI(): void {
    this.equipmentContainer.forEach((a) => a.kill());
    this.equipmentContainer = [];
    const equipped = getEquipped();
    const ownedItems = getOwnedItems();
    const slotW = 100;
    const slotH = 36;
    const startX = 24;
    const startY = 188;
    const gap = 8;
    const smallFont = new Font({
      family: "system-ui, sans-serif",
      size: 11,
      unit: FontUnit.Px,
    });

    ALL_SLOT_IDS.forEach((slotId, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * (slotW + gap);
      const y = startY + row * (slotH + gap);
      const color = Color.fromHex(SLOT_COLORS[slotId]);
      const box = new Actor({
        x: x + slotW / 2,
        y: y + slotH / 2,
        width: slotW,
        height: slotH,
        color: Color.fromHex("#1e293b"),
      });
      box.anchor.setTo(0.5, 0.5);
      box.z = 5;
      const itemId = equipped[slotId];
      const def = itemId && itemId !== "base" ? getUpgradeById(itemId) : null;
      const name = def ? def.name : "Base";
      const lbl = new Label({
        text: `${SLOT_LABELS[slotId]}: ${name}`,
        pos: vec(box.pos.x, box.pos.y),
        color,
        font: smallFont,
      });
      lbl.anchor.setTo(0.5, 0.5);
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
          setEquipped(slotId, "base");
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
    });

    const invStartY = startY + 2 * (slotH + gap) + 20;
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
        this.tooltipLabel.graphics.visible = true;
      });
      chip.on("pointerleave", () => {
        this.tooltipLabel.graphics.visible = false;
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
    const btnW = 100;
    const btnH = 36;
    const gap = 8;
    const smallFont = new Font({
      family: "system-ui, sans-serif",
      size: 12,
      unit: FontUnit.Px,
    });

    if (this.shopChosenResource === null) {
      const canAfford = canAffordAnyUpgradeByOwned(bank, ownedItems);
      const rows = getCargoRows();
      const canBuyRow =
        rows < CARGO_MAX_ROWS && bank.crystal >= 8;
      if (canBuyRow) {
        const rowBtn = new Actor({
          x: startX + 1.5 * (btnW + gap) + btnW / 2,
          y: startY + btnH / 2 + 44,
          width: 140,
          height: 32,
          color: Color.fromHex("#86efac"),
        });
        rowBtn.anchor.setTo(0.5, 0.5);
        rowBtn.on("pointerup", () => {
          if (!spendFromBank({ crystal: 8 })) return;
          setCargoRows(rows + 1);
          saveCurrentSave();
          playClick();
          this.rebuildCargoUI();
          this.rebuildShopUI();
        });
        const rowLbl = new Label({
          text: "+1 Cargo Row (8 crystal)",
          pos: rowBtn.pos.clone(),
          color: Color.Black,
          font: smallFont,
        });
        rowLbl.anchor.setTo(0.5, 0.5);
        this.add(rowBtn);
        this.add(rowLbl);
        this.shopContainer.push(rowBtn, rowLbl);
      }
      const resources: ResourceId[] = ["iron", "crystal", "gas"];
      resources.forEach((r, i) => {
        const btn = new Actor({
          x: startX + i * (btnW + gap) + btnW / 2,
          y: startY + btnH / 2,
          width: btnW,
          height: btnH,
          color: canAfford[r]
            ? r === "iron"
              ? Color.fromHex("#9ca3af")
              : r === "crystal"
                ? Color.fromHex("#a855f7")
                : Color.fromHex("#22c55e")
            : Color.fromHex("#4b5563"),
        });
        btn.anchor.setTo(0.5, 0.5);
        btn.z = 5;
        const lbl = new Label({
          text: `${r}: ${bank[r]}`,
          pos: btn.pos.clone(),
          color: Color.White,
          font: smallFont,
        });
        lbl.anchor.setTo(0.5, 0.5);
        btn.on("pointerup", () => {
          if (!canAfford[r]) return;
          playClick();
          this.shopChosenResource = r;
          this.shopOptions = get3RandomAffordableByOwned(bank, r, ownedItems);
          this.rebuildShopUI();
        });
        this.add(btn);
        this.add(lbl);
        this.shopContainer.push(btn, lbl);
      });
    } else {
      const cancelBtn = new Actor({
        x: startX + btnW / 2,
        y: startY + btnH / 2,
        width: btnW,
        height: btnH,
        color: Color.fromHex("#6b7280"),
      });
      cancelBtn.anchor.setTo(0.5, 0.5);
      cancelBtn.on("pointerup", () => {
        playClick();
        this.shopChosenResource = null;
        this.shopOptions = [];
        this.rebuildShopUI();
      });
      const cancelLbl = new Label({
        text: "Cancel",
        pos: cancelBtn.pos.clone(),
        color: Color.White,
        font: smallFont,
      });
      cancelLbl.anchor.setTo(0.5, 0.5);
      this.add(cancelBtn);
      this.add(cancelLbl);
      this.shopContainer.push(cancelBtn, cancelLbl);

      this.shopOptions.forEach((def, i) => {
        const optBtn = new Actor({
          x: startX + (i + 1) * (btnW + gap) + btnW / 2,
          y: startY + btnH / 2,
          width: btnW + 40,
          height: btnH,
          color: Color.fromHex("#8b5cf6"),
        });
        optBtn.anchor.setTo(0.5, 0.5);
        optBtn.on("pointerup", () => {
          if (!purchaseEquipment(def)) return;
          playClick();
          this.shopChosenResource = null;
          this.shopOptions = [];
          this.rebuildEquipmentUI();
          this.rebuildShopUI();
        });
        const optLbl = new Label({
          text: `${def.name} (${def.cost})`,
          pos: optBtn.pos.clone(),
          color: Color.White,
          font: smallFont,
        });
        optLbl.anchor.setTo(0.5, 0.5);
        this.add(optBtn);
        this.add(optLbl);
        this.shopContainer.push(optBtn, optLbl);
      });
    }
  }

  onInitialize(): void {
    const cx = this.engineRef.drawWidth / 2;
    const h = this.engineRef.drawHeight;

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
    this.tooltipLabel.graphics.visible = false;
    this.tooltipLabel.z = 100;
    this.add(this.tooltipLabel);

    const cancelDragArea = new Actor({
      x: cx,
      y: h / 2,
      width: this.engineRef.drawWidth,
      height: this.engineRef.drawHeight,
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

    const startBtn = new Actor({
      pos: vec(cx, h - 100),
      width: 220,
      height: 52,
      color: Color.fromHex("#3b82f6"),
    });
    startBtn.anchor.setTo(0.5, 0.5);
    const startLabel = new Label({
      text: "Start Mission",
      pos: startBtn.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
    });
    startLabel.anchor.setTo(0.5, 0.5);
    startBtn.on("pointerup", () => {
      playClick();
      requestFullscreen().finally(() => {
        this.engineRef.goToScene("planet");
      });
    });

    const backBtn = new Actor({
      pos: vec(cx, h - 44),
      width: 180,
      height: 40,
      color: Color.fromHex("#4b5563"),
    });
    backBtn.anchor.setTo(0.5, 0.5);
    const backLabel = new Label({
      text: "Back",
      pos: backBtn.pos.clone(),
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
    });
    backLabel.anchor.setTo(0.5, 0.5);
    backBtn.on("pointerup", () => {
      playClick();
      this.engineRef.goToScene("planetRunMenu");
    });

    this.add(startBtn);
    this.add(startLabel);
    this.add(backBtn);
    this.add(backLabel);
  }
}
