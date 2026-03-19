import { DefaultLoader } from "excalibur";
import { requestFullscreen } from "./fullscreen";

const BACKGROUND = "#050816";
const TITLE_COLOR = "#f8fafc";
const BAR_BG = "#1e293b";
const BAR_FILL = "#3b82f6";

/**
 * Custom loader that replaces the splash screen: shows "Starship Rover",
 * a progress bar, and a Start button (unlocks audio, optionally fullscreen).
 */
export class GameLoader extends DefaultLoader {
  private _userActionResolve: (() => void) | null = null;

  constructor() {
    super();
    console.log("GameLoader constructor");
    this.on("beforeload", () => {
      console.log("beforeload");
    });
    this.on("afterload", () => {
      console.log("afterload");
    });
    this.on("useraction", () => {
      console.log("useraction");
    });
    this.on("loadresourcestart", () => {
      console.log("loadresourcestart");
    });
    this.on("loadresourceend", () => {
      if (this.progress === 1) {
        this._showPlayButton();
      }
    });
  }

  override onDraw(ctx: CanvasRenderingContext2D): void {
    const w = this.engine.drawWidth;
    const h = this.engine.drawHeight;
    const cx = w / 2;

    // Background
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = "48px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Starship Rover", cx, h / 2 - 80);

    // Progress bar (only while loading)
    const progress = this.progress;
    const barW = Math.max(200, w * 0.5);
    const barH = 12;
    const barX = cx - barW / 2;
    const barY = h / 2;

    ctx.fillStyle = BAR_BG;
    ctx.beginPath();
    ctx.roundRect(barX, barY - barH / 2, barW, barH, 6);
    ctx.fill();

    ctx.fillStyle = BAR_FILL;
    ctx.beginPath();
    ctx.roundRect(barX, barY - barH / 2, barW * progress, barH, 6);
    ctx.fill();
  }

  override async onAfterLoad(): Promise<void> {
    console.log("onAfterLoad");
    this._showPlayButton();
  }

  override onUserAction(): Promise<void> {
    return new Promise<void>((resolve) => {
      this._userActionResolve = resolve;
    });
  }

  private _showPlayButton(): void {
    const wrap = document.getElementById("game-wrap");
    if (!wrap) return;

    const root = document.createElement("div");
    root.className = "game-loader-button-root";
    root.innerHTML = `
      <button type="button" class="game-loader-button">Start</button>
    `;
    const btn = root.querySelector("button");
    if (btn) {
      btn.addEventListener("click", () => {
        requestFullscreen().finally(() => {
          this._userActionResolve?.();
          this._userActionResolve = null;
          root.remove();
          wrap.removeChild(root);
        });
      });
    }
    wrap.appendChild(root);
  }
}
