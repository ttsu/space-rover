import { DefaultLoader } from "excalibur";
import { requestFullscreen } from "./fullscreen";

const BACKGROUND = "#050816";
const TITLE_COLOR = "#f8fafc";
const BAR_BG = "#1e293b";
const BAR_FILL = "#3b82f6";

type Star = { x: number; y: number; size: number; alpha: number };
type StarLayer = {
  speed: number;
  offsetX: number;
  offsetY: number;
  stars: Star[];
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash2D(ix: number, iy: number, seed: number): number {
  // Deterministic 0..1 hash from integer coordinates (fast, not crypto).
  // Keep everything 32-bit for predictable JS behavior.
  let h =
    Math.imul(ix, 374761393) ^
    Math.imul(iy, 668265263) ^
    Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

function valueNoise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const u = smoothstep(fx);
  const v = smoothstep(fy);

  const a = hash2D(x0, y0, seed);
  const b = hash2D(x0 + 1, y0, seed);
  const c = hash2D(x0, y0 + 1, seed);
  const d = hash2D(x0 + 1, y0 + 1, seed);

  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm2D(x: number, y: number, seed: number): number {
  // Fractal Brownian Motion (sum of octave noises).
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < 5; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 101);
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Custom loader that replaces the splash screen: shows "Starship Rover",
 * a progress bar, and a Start button (unlocks audio, optionally fullscreen).
 */
export class GameLoader extends DefaultLoader {
  private _userActionResolve: (() => void) | null = null;

  // Starfield (animated while the loader is visible).
  private _starLayers: StarLayer[] = [];
  private _starWrapW = 0;
  private _starWrapH = 0;
  private _lastDrawMs: number | null = null;
  private _starfieldStartMs: number | null = null;

  // Planet horizon texture (procedurally generated on first draw).
  private _planetTexture: HTMLCanvasElement | null = null;
  private _planetTextureSeed = 424242;

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

    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this._starfieldStartMs === null) this._starfieldStartMs = now;
    const last = this._lastDrawMs ?? now;
    this._lastDrawMs = now;
    const dtSeconds = Math.min(0.05, Math.max(0, (now - last) / 1000));
    const tSeconds = (now - (this._starfieldStartMs ?? now)) / 1000;

    this.ensureStarfield(w, h);
    this.updateStarfield(dtSeconds, tSeconds);

    // Sky background (slight gradient for depth).
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#03040f");
    sky.addColorStop(0.5, BACKGROUND);
    sky.addColorStop(1, "#020617");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars (parallax, drifting bottom-left).
    this.drawStarfield(ctx, w, h);

    // Planet horizon (textured arc at the bottom).
    this.ensurePlanetTexture();
    this.drawPlanetHorizon(ctx, w, h, tSeconds);

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

  private ensureStarfield(w: number, h: number): void {
    if (
      this._starLayers.length > 0 &&
      this._starWrapW === w &&
      this._starWrapH === h
    )
      return;

    this._starWrapW = w;
    this._starWrapH = h;

    const rand = mulberry32(1337);
    const layerConfigs: {
      speed: number;
      count: number;
      sizeMin: number;
      sizeMax: number;
      alphaMin: number;
      alphaMax: number;
    }[] = [
      {
        speed: 0.08,
        count: 310,
        sizeMin: 0.5,
        sizeMax: 1.1,
        alphaMin: 0.25,
        alphaMax: 0.55,
      },
      {
        speed: 0.07,
        count: 170,
        sizeMin: 0.8,
        sizeMax: 1.8,
        alphaMin: 0.35,
        alphaMax: 0.75,
      },
      {
        speed: 0.06,
        count: 40,
        sizeMin: 1.1,
        sizeMax: 2.6,
        alphaMin: 0.5,
        alphaMax: 1,
      },
    ];

    this._starLayers = layerConfigs.map((cfg) => ({
      speed: cfg.speed,
      offsetX: 0,
      offsetY: 0,
      stars: Array.from({ length: cfg.count }, () => ({
        x: rand() * w,
        y: rand() * h,
        size: lerp(cfg.sizeMin, cfg.sizeMax, rand()),
        alpha: lerp(cfg.alphaMin, cfg.alphaMax, rand()),
      })),
    }));
  }

  private updateStarfield(dtSeconds: number, tSeconds: number): void {
    if (this._starLayers.length === 0) return;

    // "Slowing" factor: gradually reduces drift speed as time passes.
    const slow = 1 / Math.pow(1 + tSeconds * 0.12, 0.7);
    const w = this._starWrapW;
    const h = this._starWrapH;
    const cx = w / 2;

    for (const layer of this._starLayers) {
      // Move stars toward the top, with a slight radial divergence away from
      // screen center (left side drifts left, right side drifts right).
      const dy = dtSeconds * layer.speed * slow * h;
      const angleFactor = 0.15; // small -> "very slight" angled motion

      for (const s of layer.stars) {
        const nx = (s.x - cx) / w; // -0.5..0.5-ish
        const dx = dy * nx * angleFactor;

        s.x += dx;
        s.y -= dy;

        // Wrap.
        s.x = ((s.x % w) + w) % w;
        s.y = ((s.y % h) + h) % h;
      }
    }
  }

  private drawStarfield(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {
    if (this._starLayers.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const layer of this._starLayers) {
      for (const s of layer.stars) {
        const sx = ((s.x % w) + w) % w;
        const sy = ((s.y % h) + h) % h;
        const a = clamp01(s.alpha);

        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private ensurePlanetTexture(): void {
    if (this._planetTexture) return;

    // Higher resolution reduces visible pixelation when the texture is
    // scaled up to the large planet limb.
    const texW = 1024;
    const texH = 512;

    const canvas = document.createElement("canvas");
    canvas.width = texW;
    canvas.height = texH;
    const c = canvas.getContext("2d");
    if (!c) return;

    const image = c.createImageData(texW, texH);
    const data = image.data;
    const seed = this._planetTextureSeed;

    // Generate a simple but convincing "planet map":
    // - elevation + ridged mountains
    // - moisture + latitude for ocean/land/ice colors.
    for (let y = 0; y < texH; y++) {
      const v = y / (texH - 1);
      const lat = (v - 0.5) * 2; // -1..1
      const absLat = Math.abs(lat);

      for (let x = 0; x < texW; x++) {
        const u = x / (texW - 1);

        // Elevation field.
        const nx = u * 3.2;
        const ny = v * 3.2;
        let elev = fbm2D(nx + 12.3, ny - 7.7, seed);
        elev += 0.35 * fbm2D(nx * 2.1 - 3.1, ny * 2.1 + 4.9, seed + 17);
        elev = clamp01(elev / 1.35);

        // Moisture field (for where land is wet vs dry).
        const moisture = clamp01(
          fbm2D(u * 5.5 + 44.2, v * 5.5 - 13.1, seed + 101) / 1.15
        );

        const seaLevel = 0.52;
        const temperature = clamp01(1 - absLat * 1.65);

        // Mountains via ridged noise (adds contrast).
        const mountains =
          1 -
          Math.abs(2 * fbm2D(nx * 1.8 + 5.6, ny * 1.8 - 2.1, seed + 303) - 1);
        const mountainBoost = Math.pow(mountains, 2.8);

        // Push elevation with mountains and keep in 0..1.
        const height = clamp01(elev + 0.18 * (mountainBoost - 0.5));

        // Seamless wrapping: when the planet texture scrolls, we want the
        // edges to always be ocean so land/ice don't produce visible seams.
        const seamBand = 0.14;
        const uSeam = Math.min(u, 1 - u);
        const vSeam = Math.min(v, 1 - v);
        const uInfluence = 1 - smoothstep(uSeam / seamBand);
        const vInfluence = 1 - smoothstep(vSeam / seamBand);
        const seamInfluence = Math.max(uInfluence, vInfluence);

        // Force a shallow-to-deep ocean near wrap edges.
        const seamOceanTarget = seaLevel - 0.18;
        const heightSeamed = clamp01(
          lerp(height, seamOceanTarget, seamInfluence)
        );
        const moistureSeamed = clamp01(lerp(moisture, 0.78, seamInfluence));

        let r = 0;
        let g = 0;
        let b = 0;

        if (heightSeamed < seaLevel) {
          // Ocean: deeper water is darker; shallows are brighter/teal.
          const depth = clamp01((seaLevel - heightSeamed) / seaLevel);
          const shallow = 1 - depth;

          r = lerp(6, 20, shallow);
          g = lerp(25, 120, shallow);
          b = lerp(70, 190, shallow);

          // Subtle ocean variation / swells.
          const swell = fbm2D(u * 14 + 2.1, v * 14 - 3.2, seed + 707);
          const swellT = clamp01(swell / 1.2);
          r *= lerp(0.95, 1.07, swellT);
          g *= lerp(0.95, 1.08, swellT);
          b *= lerp(0.92, 1.1, swellT);
        } else {
          // Land.
          const hLand = clamp01((heightSeamed - seaLevel) / (1 - seaLevel));

          // Ice caps at poles.
          if (temperature < 0.25 && absLat > 0.55) {
            const ice = clamp01(1 - temperature / 0.25);
            r = lerp(155, 235, ice);
            g = lerp(170, 245, ice);
            b = lerp(190, 255, ice);
          } else {
            // Biome via moisture + height.
            const forest = clamp01((moistureSeamed - 0.35) / 0.6);
            const desert = clamp01((0.6 - moistureSeamed) / 0.6);

            // Base tones (desert -> sandy browns, wet -> greener).
            const baseR = lerp(110, 55, desert);
            const baseG = lerp(170, 120, desert);
            const baseB = lerp(70, 85, desert);

            const rock = clamp01((hLand - 0.45) / 0.55);
            const snow = clamp01((hLand - 0.82) / 0.18);

            r = baseR * (1 - 0.35 * rock) + 210 * rock + 240 * snow;
            g = baseG * (1 - 0.3 * rock) + 200 * rock + 245 * snow;
            b = baseB * (1 - 0.3 * rock) + 190 * rock + 255 * snow;

            // Forest overlay.
            const forestT = clamp01(forest * (1 - desert) * 0.9);
            r = lerp(r, 30, forestT);
            g = lerp(g, 95, forestT);
            b = lerp(b, 45, forestT);

            // Subtle variation.
            const micro = fbm2D(u * 18 + 9, v * 18 - 8, seed + 909) / 1.15;
            const microT = clamp01(micro);
            r *= lerp(0.94, 1.06, microT);
            g *= lerp(0.94, 1.06, microT);
            b *= lerp(0.94, 1.06, microT);

            // Coastal highlight to make oceans/land read better.
            const coast = clamp01(
              (heightSeamed - seaLevel) / 0.06 +
                (1 - absLat) * 0.06 -
                Math.abs((moistureSeamed - 0.5) * 2) * 0.12
            );
            r = lerp(r, 240, coast * 0.06);
            g = lerp(g, 245, coast * 0.06);
            b = lerp(b, 255, coast * 0.06);
          }
        }

        // Clouds: higher-frequency noise over both ocean and land, stronger near
        // mid-latitudes and slightly biased toward wet/ocean regions.
        const cloudField =
          fbm2D(u * 9.5 + 120.3, v * 9.5 - 210.7, seed + 2000) * 0.65 +
          fbm2D(u * 20.0 - 50.5, v * 20.0 + 80.5, seed + 3000) * 0.35;
        // Lower the threshold and widen the transition for higher cloud cover.
        const cloudMask = clamp01((cloudField - 0.48) / 0.3);
        const oceanT = clamp01((seaLevel - heightSeamed) / seaLevel);
        const landT = clamp01((heightSeamed - seaLevel) / (1 - seaLevel));
        const cloudOceanBias = oceanT * 0.95 + landT * 0.35;
        const cloudLat = clamp01(1 - absLat * 0.9);
        const cloudStrength = Math.pow(
          cloudMask * cloudOceanBias * cloudLat,
          1.15
        );
        const brighten = cloudStrength * 0.95;
        r = lerp(r, 240, brighten);
        g = lerp(g, 248, brighten);
        b = lerp(b, 255, brighten);

        const i = (y * texW + x) * 4;
        data[i + 0] = Math.max(0, Math.min(255, Math.round(r)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
        data[i + 3] = 255;
      }
    }

    c.putImageData(image, 0, 0);
    this._planetTexture = canvas;
  }

  private drawPlanetHorizon(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tSeconds: number
  ): void {
    if (!this._planetTexture) return;

    const tex = this._planetTexture;

    // Sphere-to-horizon approximation: a big circle whose center sits slightly
    // below the screen so only the limb/curvature is visible.
    const cx = w / 2;
    const r = h * 1.42;
    const cy = h + r * 0.75;

    ctx.save();
    // Atmospheric haze/glow (drawn before clipping so it surrounds the limb).
    const glowCenterY = cy - r * 0.2;
    const glowRadius = r * 1.45;

    // Broad space glow behind the planet (extends slightly into space).
    // This sits underneath the clipped planet so it reads as atmospheric
    // scattering with depth.
    const spaceGlowCenterY = cy - r * 0.03;
    const spaceGlowRadius = r;
    const broadGlow = ctx.createRadialGradient(
      cx,
      spaceGlowCenterY,
      r * 0.02,
      cx,
      spaceGlowCenterY,
      spaceGlowRadius
    );
    broadGlow.addColorStop(0, "rgba(194, 236, 252,1)");
    broadGlow.addColorStop(0.95, "rgba(194, 236, 252, 0.9)");
    broadGlow.addColorStop(0.99, "rgba(194, 236, 252, 0.1)");
    broadGlow.addColorStop(1, "rgba(194, 236, 252,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = broadGlow;
    ctx.fillRect(
      cx - spaceGlowRadius,
      spaceGlowCenterY - spaceGlowRadius,
      spaceGlowRadius * 2,
      spaceGlowRadius * 2
    );

    const atmosGlow = ctx.createRadialGradient(
      cx,
      glowCenterY,
      r * 0.05,
      cx,
      glowCenterY,
      glowRadius
    );
    atmosGlow.addColorStop(0, "rgba(120,220,255,0.22)");
    atmosGlow.addColorStop(0.35, "rgba(90,170,255,0.10)");
    atmosGlow.addColorStop(1, "rgba(90,170,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = atmosGlow;
    ctx.fillRect(
      cx - glowRadius,
      glowCenterY - glowRadius,
      glowRadius * 2,
      glowRadius * 2
    );
    ctx.globalCompositeOperation = "source-over";

    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
    ctx.clip();

    const targetW = r * 2;
    const targetH = r * 2;
    const baseX = cx - r;
    const baseY = cy - r;

    // Rotate "towards the player" by scrolling the texture north->south
    // (features drift downward on the limb).
    // 50% slower than before for a calmer orbit feel.
    const rot = (tSeconds * 0.01) % 1; // 0..1 (50% slower)
    const shiftY = rot * targetH;

    // Wrap vertically by drawing twice.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex, baseX, baseY + shiftY - targetH, targetW, targetH);
    ctx.drawImage(tex, baseX, baseY + shiftY, targetW, targetH);

    // Lighting: stronger highlights + much more dramatic shadow/terminator.
    // Do it in two passes using blending modes for punch.
    ctx.save();

    // Bright rimward highlight.
    ctx.globalCompositeOperation = "screen";
    const highlight = ctx.createLinearGradient(
      0,
      baseY + targetH * 0.05,
      0,
      baseY + targetH * 0.65
    );
    highlight.addColorStop(0, "rgba(255,255,255,0.44)");
    highlight.addColorStop(0.35, "rgba(255,255,255,0.20)");
    highlight.addColorStop(0.7, "rgba(255,255,255,0.06)");
    highlight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = highlight;
    ctx.fillRect(baseX - 2, baseY - 2, targetW + 4, targetH + 4);

    // Soft elliptical night-side darkness (no hard clip):
    // draw a radial alpha gradient so the terminator fades smoothly.
    const shadowShiftY = r * 0.05;
    const shadowRx = r * 1.3;
    const shadowRy = r * 1.02;

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.translate(cx, cy + shadowShiftY);
    // Transform ellipse into a circle for an easy radial gradient.
    ctx.scale(1, shadowRy / shadowRx);

    const outer = shadowRx;
    const inner = outer * 0.5;
    const night = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
    night.addColorStop(0, "rgba(5, 8, 22, 1)");
    night.addColorStop(0.8, "rgba(5, 8, 22, 0.5)");
    night.addColorStop(0.95, "rgba(5, 8, 22, 0.1)");
    night.addColorStop(0.99, "rgba(5, 8, 22, 0.01)");
    night.addColorStop(1, "rgba(5, 8, 22, 0)");
    ctx.fillStyle = night;

    // Draw a big rect in transformed space to cover the ellipse.
    const pad = 14;
    ctx.fillRect(
      -outer - pad,
      -outer - pad,
      (outer + pad) * 2,
      (outer + pad) * 2
    );

    ctx.restore();

    ctx.restore();

    // Atmospheric rim glow near the limb.
    const rimGlow = ctx.createRadialGradient(
      cx,
      cy - r * 0.9,
      r * 0.05,
      cx,
      cy - r * 0.85,
      r
    );
    rimGlow.addColorStop(0, "rgba(155,220,255,0.68)");
    rimGlow.addColorStop(0.35, "rgba(90,170,255,0.24)");
    rimGlow.addColorStop(1, "rgba(90,170,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = rimGlow;
    ctx.fillRect(baseX - 2, baseY - 2, targetW + 4, targetH + 4);

    ctx.restore();

    // Rim stroke (top of the planet limb).
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(140, 220, 255, 0.35)";
    ctx.lineWidth = Math.max(1.5, r * 0.02);
    ctx.shadowColor = "rgba(130, 210, 255, 0.35)";
    ctx.shadowBlur = Math.max(6, r * 0.06);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();

    // Horizon haze to blend planet with sky.
    ctx.save();
    const haze = ctx.createLinearGradient(0, h * 0.62, 0, h);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(0.6, "rgba(8,24,60,0.22)");
    haze.addColorStop(1, "rgba(2,6,23,0.72)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);
    ctx.restore();
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
