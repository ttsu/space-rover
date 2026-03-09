import { Color, vec, type ExcaliburGraphicsContext } from "excalibur";

export interface ParallaxLayer {
  speed: number;
  offsetX: number;
  offsetY: number;
  stars: { x: number; y: number; size: number; alpha: number }[];
}

export class ParallaxStarField {
  private layers: ParallaxLayer[] = [];
  private wrapW = 0;
  private wrapH = 0;

  init(width: number, height: number): void {
    this.wrapW = width;
    this.wrapH = height;
    const random = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const layerConfigs = [
      {
        speed: 0.01,
        count: 80,
        sizeMin: 0.5,
        sizeMax: 1,
        alphaMin: 0.3,
        alphaMax: 0.6,
      },
      {
        speed: 0.03,
        count: 50,
        sizeMin: 1,
        sizeMax: 1.8,
        alphaMin: 0.5,
        alphaMax: 0.9,
      },
      {
        speed: 0.08,
        count: 30,
        sizeMin: 1.2,
        sizeMax: 2.2,
        alphaMin: 0.6,
        alphaMax: 1,
      },
    ];

    this.layers = layerConfigs.map((cfg) => ({
      speed: cfg.speed,
      offsetX: 0,
      offsetY: 0,
      stars: Array.from({ length: cfg.count }, () => ({
        x: random(0, width),
        y: random(0, height),
        size: random(cfg.sizeMin, cfg.sizeMax),
        alpha: random(cfg.alphaMin, cfg.alphaMax),
      })),
    }));
  }

  updateOffsets(vx: number, vy: number, dt: number): void {
    if (this.layers.length === 0) return;
    for (const layer of this.layers) {
      layer.offsetX += vx * dt * layer.speed;
      layer.offsetY += vy * dt * layer.speed;
      layer.offsetX = ((layer.offsetX % this.wrapW) + this.wrapW) % this.wrapW;
      layer.offsetY = ((layer.offsetY % this.wrapH) + this.wrapH) % this.wrapH;
    }
  }

  draw(ctx: ExcaliburGraphicsContext): void {
    if (this.layers.length === 0 || this.wrapW <= 0 || this.wrapH <= 0) return;
    ctx.save();
    ctx.z = -1000;
    for (const layer of this.layers) {
      const ox = layer.offsetX;
      const oy = layer.offsetY;
      for (const s of layer.stars) {
        const sx = (((s.x - ox) % this.wrapW) + this.wrapW) % this.wrapW;
        const sy = (((s.y - oy) % this.wrapH) + this.wrapH) % this.wrapH;
        ctx.drawCircle(vec(sx, sy), s.size, Color.fromRGB(255, 255, 255, s.alpha));
      }
    }
    ctx.restore();
  }
}
