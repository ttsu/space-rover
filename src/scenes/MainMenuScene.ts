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
import {
  listSaves,
  loadSave,
  deleteSave,
  getLastPlayedSaveId,
  type SaveIndexEntry,
} from "../state/Saves";
import { playClick } from "../audio/sounds";

function formatTotalResources(
  t: SaveIndexEntry["totalResourcesCollected"]
): string {
  const total = t.iron + t.crystal + t.gas;
  return `${total} total (${t.iron} iron, ${t.crystal} crystal, ${t.gas} gas)`;
}

export class MainMenuScene extends Scene {
  private saveListActors: Actor[] = [];
  private saveListLabels: Label[] = [];

  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    this.refreshSaveList();
  }

  private refreshSaveList(): void {
    for (const a of this.saveListActors) a.kill();
    for (const l of this.saveListLabels) l.kill();
    this.saveListActors = [];
    this.saveListLabels = [];

    const saves = listSaves();
    const lastPlayedId = getLastPlayedSaveId();
    const cx = this.engine.drawWidth / 2;
    const listStartY = this.engine.drawHeight / 2 - 20;
    const rowHeight = 44;
    const col1X = cx - 180;
    const loadX = cx + 20;
    const deleteX = cx + 100;

    saves.forEach((entry, i) => {
      const y = listStartY + i * rowHeight;
      const desc = `${entry.difficulty} · ${formatTotalResources(entry.totalResourcesCollected)}`;
      const isLastPlayed = entry.id === lastPlayedId;

      const descLabel = new Label({
        text: isLastPlayed ? `★ ${desc}` : desc,
        pos: vec(col1X, y),
        color: isLastPlayed
          ? Color.fromHex("#fbbf24")
          : Color.fromHex("#e5e7eb"),
        font: new Font({
          family: "system-ui, sans-serif",
          size: 14,
          unit: FontUnit.Px,
        }),
      });
      descLabel.anchor.setTo(0, 0.5);

      const loadBtn = new Button({
        pos: vec(loadX, y),
        width: 56,
        height: 32,
        text: "Load",
        color: Color.White,
        font: new Font({
          family: "system-ui, sans-serif",
          size: 14,
          unit: FontUnit.Px,
        }),
        onClick: () => {
          playClick();
          loadSave(entry.id);
          this.engine.goToScene("planetRunMenu");
        },
      });

      const deleteBtn = new Button({
        pos: vec(deleteX, y),
        width: 56,
        height: 32,
        text: "Delete",
        color: Color.White,
        font: new Font({
          family: "system-ui, sans-serif",
          size: 12,
          unit: FontUnit.Px,
        }),
        onClick: () => {
          const confirmed =
            typeof window !== "undefined" &&
            window.confirm("Are you sure you want to delete this save?");
          if (confirmed) {
            deleteSave(entry.id);
            this.refreshSaveList();
          }
        },
      });

      this.add(descLabel);
      this.add(loadBtn);
      this.add(deleteBtn);
      this.saveListLabels.push(descLabel);
      this.saveListActors.push(loadBtn, deleteBtn);
    });
  }

  onInitialize() {
    const cx = this.engine.drawWidth / 2;

    const title = new Label({
      text: "Starship Rover",
      pos: vec(cx, this.engine.drawHeight / 2 - 140),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 40,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    const newGameButton = new Button({
      pos: vec(cx, this.engine.drawHeight / 2 - 80),
      width: 200,
      height: 48,
      text: "New Game",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.engine.goToScene("difficultySelect");
      },
    });

    const savesTitle = new Label({
      text: "Saved games",
      pos: vec(cx, this.engine.drawHeight / 2 - 48),
      color: Color.fromHex("#9ca3af"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });
    savesTitle.anchor.setTo(0.5, 0.5);

    this.add(title);
    this.add(newGameButton);
    this.add(savesTitle);
  }
}
