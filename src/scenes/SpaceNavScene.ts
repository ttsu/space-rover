import {
  Actor,
  Circle,
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  ScreenElement,
  Polygon,
  type ExcaliburGraphicsContext,
} from "excalibur";
import { getEdgeIndicatorFromScreen } from "../utils/edgeIndicator";
import { Button } from "../ui/Button";
import { playClick } from "../audio/sounds";
import { TouchControls } from "../ui/TouchControls";
import { SpaceBody } from "../entities/SpaceBody";
import {
  DEFAULT_SOLAR_SYSTEM,
  getHomePlanetId,
  LANDING_MARGIN_PX,
  getPlanetById,
  ASTEROID_DAMAGE,
  type PlanetDef,
  type MoonDef,
} from "../config/solarSystemConfig";
import { SpaceShip } from "../entities/SpaceShip";
import { Asteroid } from "../entities/Asteroid";
import {
  applyGravity,
  type GravitySource,
  type GravityReceiver,
} from "../space/GravitySystem";
import { getShipStats } from "../config/shipConfig";
import {
  getShipUpgrades,
  setCurrentPlanetId,
  setCurrentLocation,
} from "../state/Progress";
import {
  getTouchInput,
  getTouchControlsEnabled,
} from "../input/TouchInputState";
import { Keys } from "excalibur";

const STAR_COLOR = Color.fromHex("#fef08a");

/** Parallax star layer: speed factor for drift, and star list. */
interface ParallaxLayer {
  speed: number;
  offsetX: number;
  offsetY: number;
  stars: { x: number; y: number; size: number; alpha: number }[];
}

const PLANET_COLORS: Record<string, string> = {
  home: "#4ade80",
  desert: "#f97316",
  ice: "#7dd3fc",
};
const MOON_COLOR = Color.fromHex("#a3a3a3");

/** Thin orbit path line color (subtle so paths don't distract). */
const ORBIT_PATH_COLOR = Color.fromRGB(255, 255, 255, 0.22);

function planetColor(planetId: string): Color {
  return Color.fromHex(PLANET_COLORS[planetId] ?? "#94a3b8");
}

/** Space navigation scene: pilot ship in 2D with gravity. Star, planets, moons from config. */
export class SpaceNavScene extends Scene {
  private star: SpaceBody | null = null;
  private planets: SpaceBody[] = [];
  private moons: SpaceBody[] = [];
  private ship: SpaceShip | null = null;
  private backButtonActor: ScreenElement | null = null;
  private landingButton: Button | null = null;
  private goToButtons: Map<string, Button> = new Map();
  private autopilotLabel: Label | null = null;
  private autopilotPlanetId: string | null = null;
  private uiContainer: ScreenElement | null = null;
  private asteroids: Asteroid[] = [];
  private gameOverOverlay: ScreenElement | null = null;
  private hullLabel: Label | null = null;
  private touchControlsOverlay: TouchControls | null = null;
  /** Smoothed zoom to avoid jitter from nearest-body flipping and small position changes. */
  private smoothedZoom: number = 1;
  /** Hysteresis: only switch nearest body if new one is this much closer (px). */
  private static readonly NEAREST_BODY_HYSTERESIS_PX = 40;
  private lastNearestBody: SpaceBody | null = null;
  private lastNearestDist: number = Infinity;
  /** Parallax star layers (far, mid, near) for motion sense. */
  private parallaxLayers: ParallaxLayer[] = [];
  private parallaxWrapW: number = 0;
  private parallaxWrapH: number = 0;
  /** Off-screen planet direction arrows (one per planet, same order as config). */
  private planetIndicatorContainer: ScreenElement | null = null;
  private planetArrowActors: Actor[] = [];
  /** Labels showing planet name next to each edge arrow. */
  private planetIndicatorLabels: Label[] = [];
  /** Thin circle actors for planet/moon orbit paths; moon entries need position sync each frame. */
  private orbitPathActors: Actor[] = [];
  private moonOrbitBindings: { actor: Actor; moon: SpaceBody }[] = [];

  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    setCurrentLocation("orbit");
    this.lastNearestBody = null;
    this.lastNearestDist = Infinity;
    this.smoothedZoom = 1;
    this.initParallaxStars();
    this.spawnBodies();
  }

  onDeactivate(): void {
    this.touchControlsOverlay?.kill();
    this.touchControlsOverlay = null;
    this.star = null;
    this.planets = [];
    this.moons = [];
    this.ship = null;
  }

  onPreDraw(ctx: ExcaliburGraphicsContext): void {
    this.drawParallaxStars(ctx);
  }

  onPostUpdate(): void {
    for (const { actor, moon } of this.moonOrbitBindings) {
      const center = moon.getOrbitCenter();
      actor.pos.x = center.x;
      actor.pos.y = center.y;
    }

    if (!this.ship || this.ship.isDestroyed()) return;
    // Zoom so the nearest planet stays in view: zoom in as we approach, zoom out when far.
    // Use resolution (viewport pixels), not drawWidth/drawHeight (which are resolution/zoom).
    const viewSize = Math.min(
      this.engine.screen.resolution.width,
      this.engine.screen.resolution.height
    );
    const margin = 200;
    const zoomMin = 0.1;
    const zoomMax = 1.4;
    const zoomLerp = 0.12; // smooth zoom changes to avoid jitter

    const bodies = this.getGravityBodies();
    let nearestBody: SpaceBody | null = null;
    let nearestDist = Infinity;
    const distByBody = new Map<SpaceBody, number>();
    for (const body of bodies) {
      const d = this.ship.pos.distance(body.pos);
      distByBody.set(body, d);
      if (d < nearestDist) {
        nearestDist = d;
        nearestBody = body;
      }
    }

    // Hysteresis: only switch to a different nearest body if it's meaningfully closer
    const hysteresis = SpaceNavScene.NEAREST_BODY_HYSTERESIS_PX;
    const trueNearestBody = nearestBody;
    const trueNearestDist = nearestDist;
    if (
      this.lastNearestBody != null &&
      nearestBody !== this.lastNearestBody &&
      nearestDist > this.lastNearestDist - hysteresis
    ) {
      nearestBody = this.lastNearestBody;
      nearestDist = this.ship.pos.distance(nearestBody.pos);
    }
    this.lastNearestBody = nearestBody;
    this.lastNearestDist = nearestDist;

    // Radius to fit the body we're "tracking" (after hysteresis)
    const nearestRadius = nearestBody?.radiusPx ?? 0;
    let radiusToFit = nearestDist + nearestRadius + margin;
    // When hysteresis kept a different body, also fit the true nearest so it stays in view
    if (trueNearestBody != null && trueNearestBody !== nearestBody) {
      const trueDist = distByBody.get(trueNearestBody) ?? trueNearestDist;
      const trueRadius = trueNearestBody.radiusPx;
      const trueRadiusToFit = trueDist + trueRadius + margin;
      radiusToFit = Math.max(radiusToFit, trueRadiusToFit);
    }
    const targetZoom =
      radiusToFit <= 0 ? zoomMax : viewSize / (2 * radiusToFit);
    const clampedTarget = Math.max(zoomMin, Math.min(zoomMax, targetZoom));
    this.smoothedZoom += (clampedTarget - this.smoothedZoom) * zoomLerp;
    this.camera.zoom = this.smoothedZoom;

    // Update off-screen planet direction arrows. Use resolution (pixel) dimensions,
    // not drawWidth/drawHeight (which are resolution/zoom and wrong for screen space).
    const w = this.engine.screen.resolution.width;
    const h = this.engine.screen.resolution.height;
    this.planets.forEach((planet, i) => {
      const arrow = this.planetArrowActors[i];
      const label = this.planetIndicatorLabels[i];
      if (!arrow) return;
      const screenPos = this.engine.worldToScreenCoordinates(planet.pos);
      const ind = getEdgeIndicatorFromScreen(screenPos.x, screenPos.y, w, h);
      if (ind) {
        arrow.pos = vec(ind.screenX, ind.screenY);
        arrow.rotation = ind.angleRad;
        arrow.graphics.isVisible = true;
        if (label) {
          const labelOffset = 22;
          label.pos.x = ind.screenX - labelOffset * Math.cos(ind.angleRad);
          label.pos.y = ind.screenY - labelOffset * Math.sin(ind.angleRad);
          label.graphics.isVisible = true;
        }
      } else {
        arrow.graphics.isVisible = false;
        if (label) label.graphics.isVisible = false;
      }
    });
  }

  onPreUpdate(engine: Engine, delta: number): void {
    const dt = delta / 1000;

    // Update parallax star offsets from ship velocity for sense of motion
    if (
      this.ship &&
      !this.ship.isDestroyed() &&
      this.parallaxLayers.length > 0
    ) {
      const v = this.ship.vel;
      for (const layer of this.parallaxLayers) {
        layer.offsetX += v.x * dt * layer.speed;
        layer.offsetY += v.y * dt * layer.speed;
        layer.offsetX =
          ((layer.offsetX % this.parallaxWrapW) + this.parallaxWrapW) %
          this.parallaxWrapW;
        layer.offsetY =
          ((layer.offsetY % this.parallaxWrapH) + this.parallaxWrapH) %
          this.parallaxWrapH;
      }
    }

    if (!this.ship) return;

    // Apply gravity via dedicated system (before ship/asteroid onPreUpdate).
    const bodies = this.getGravityBodies();
    const sources: GravitySource[] = bodies.map((b) => ({
      pos: b.pos,
      mass: b.mass,
      radiusPx: b.radiusPx,
    }));
    const receivers: GravityReceiver[] = [];
    if (!this.ship.isDestroyed()) {
      receivers.push({ pos: this.ship.pos, vel: this.ship.vel });
    }
    for (const ast of this.asteroids) {
      if (!ast.isKilled()) receivers.push({ pos: ast.pos, vel: ast.vel });
    }
    applyGravity(sources, receivers, dt);

    if (!this.ship.isDestroyed()) {
      // Asteroid collision
      const shipRadius = 16;
      for (const ast of this.asteroids) {
        if (ast.isKilled()) continue;
        const d = this.ship.pos.distance(ast.pos);
        if (d < shipRadius + ast.radius) {
          this.ship.takeDamage(ASTEROID_DAMAGE, 0);
          ast.kill();
        }
      }
      // Sun heat
      const star = this.getStar();
      if (star && DEFAULT_SOLAR_SYSTEM.star.heatDamageRadius != null) {
        const dist = this.ship.pos.distance(star.pos);
        if (dist < DEFAULT_SOLAR_SYSTEM.star.heatDamageRadius!) {
          const rate = DEFAULT_SOLAR_SYSTEM.star.heatDamagePerSecond ?? 5;
          this.ship.takeDamage(rate * dt, this.ship.shipStats.heatShielding);
        }
      }
    }

    // Movement input cancels autopilot
    const input = engine.input.keyboard;
    const hasKeyInput =
      input.isHeld(Keys.Left) ||
      input.isHeld(Keys.A) ||
      input.isHeld(Keys.Right) ||
      input.isHeld(Keys.D) ||
      input.isHeld(Keys.Up) ||
      input.isHeld(Keys.W) ||
      input.isHeld(Keys.Down) ||
      input.isHeld(Keys.S);
    const touch = getTouchControlsEnabled() ? getTouchInput() : null;
    const hasTouchInput =
      touch &&
      (touch.targetAngle !== null ||
        touch.accelerate ||
        touch.brake ||
        touch.turnLeft ||
        touch.turnRight);
    if (hasKeyInput || hasTouchInput) {
      this.ship.autopilotOn = false;
      this.autopilotPlanetId = null;
    }

    // Update autopilot target from planet position
    if (this.ship.autopilotOn && this.autopilotPlanetId) {
      const planet = this.planets.find(
        (p) => p.bodyId === this.autopilotPlanetId
      );
      if (planet) {
        this.ship.autopilotTarget = planet.pos.clone();
        const dist = this.ship.pos.distance(planet.pos);
        const landingRadius = planet.radiusPx + LANDING_MARGIN_PX;
        if (dist <= landingRadius) {
          this.doLand(this.autopilotPlanetId);
          return;
        }
      }
    }

    // Update landing button visibility
    const inRange = this.getPlanetInLandingRange();
    if (this.landingButton) {
      if (inRange) {
        const planetDef = getPlanetById(DEFAULT_SOLAR_SYSTEM, inRange);
        this.landingButton.setText(
          planetDef ? `Land on ${planetDef.name}` : "Land"
        );
        this.landingButton.graphics.isVisible = true;
      } else {
        this.landingButton.graphics.isVisible = false;
      }
    }
    if (this.autopilotLabel) {
      this.autopilotLabel.graphics.isVisible = this.ship.autopilotOn;
    }
    if (this.hullLabel && this.ship && !this.ship.isDestroyed()) {
      this.hullLabel.text = `Hull: ${Math.max(0, Math.ceil(this.ship.hull))} / ${this.ship.shipStats.hull}`;
      this.hullLabel.graphics.isVisible = true;
    } else if (this.hullLabel) {
      this.hullLabel.graphics.isVisible = false;
    }
  }

  private initParallaxStars(): void {
    const w = this.engine.drawWidth;
    const h = this.engine.drawHeight;
    this.parallaxWrapW = w;
    this.parallaxWrapH = h;

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

    this.parallaxLayers = layerConfigs.map((cfg) => ({
      speed: cfg.speed,
      offsetX: 0,
      offsetY: 0,
      stars: Array.from({ length: cfg.count }, () => ({
        x: random(0, w),
        y: random(0, h),
        size: random(cfg.sizeMin, cfg.sizeMax),
        alpha: random(cfg.alphaMin, cfg.alphaMax),
      })),
    }));
  }

  private drawParallaxStars(ctx: ExcaliburGraphicsContext): void {
    const w = this.engine.drawWidth;
    const h = this.engine.drawHeight;
    if (this.parallaxLayers.length === 0 || w <= 0 || h <= 0) return;

    ctx.save();
    ctx.z = -1000;

    for (const layer of this.parallaxLayers) {
      const ox = layer.offsetX;
      const oy = layer.offsetY;
      for (const s of layer.stars) {
        const sx =
          (((s.x - ox) % this.parallaxWrapW) + this.parallaxWrapW) %
          this.parallaxWrapW;
        const sy =
          (((s.y - oy) % this.parallaxWrapH) + this.parallaxWrapH) %
          this.parallaxWrapH;
        const starColor = Color.fromRGB(255, 255, 255, s.alpha);
        ctx.drawCircle(vec(sx, sy), s.size, starColor);
      }
    }

    ctx.restore();
  }

  private getPlanetInLandingRange(): string | null {
    if (!this.ship) return null;
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const p of this.planets) {
      if (!p.bodyId) continue;
      const dist = this.ship.pos.distance(p.pos);
      const threshold = p.radiusPx + LANDING_MARGIN_PX;
      if (dist <= threshold && dist < closestDist) {
        closestDist = dist;
        closest = p.bodyId;
      }
    }
    return closest;
  }

  private doLand(planetId: string): void {
    setCurrentPlanetId(planetId);
    setCurrentLocation("planet");
    this.engine.goToScene("planetRunMenu");
  }

  private spawnBodies(): void {
    this.star?.kill();
    this.planets.forEach((p) => p.kill());
    this.moons.forEach((m) => m.kill());
    this.orbitPathActors.forEach((a) => a.kill());
    this.orbitPathActors = [];
    this.moonOrbitBindings = [];
    this.planets = [];
    this.moons = [];

    const config = DEFAULT_SOLAR_SYSTEM;
    const starDef = config.star;

    this.star = new SpaceBody({
      x: 0,
      y: 0,
      mass: starDef.mass,
      radiusPx: starDef.radiusPx,
      color: STAR_COLOR,
      kind: "star",
    });
    this.add(this.star);

    for (const pDef of config.planets) {
      const planet = this.spawnPlanet(pDef);
      this.planets.push(planet);
      this.add(planet);
      for (const mDef of pDef.moons) {
        const moon = this.spawnMoon(mDef, planet);
        this.moons.push(moon);
        this.add(moon);
      }
    }

    // commenting this out for now to avoid the performance hit
    // this.spawnOrbitPaths(config);

    // Spawn ship near home planet
    const homeId = getHomePlanetId(config);
    const homePlanet = config.planets.find((p) => p.id === homeId);
    const spawnRadius = homePlanet ? homePlanet.orbitRadius + 60 : 460;
    const stats = getShipStats(getShipUpgrades());
    this.ship = new SpaceShip(spawnRadius, 0, stats);
    this.ship.onDestroyed = () => this.showGameOver();
    this.add(this.ship);

    this.spawnAsteroids(config);
    this.ensureBackButton();
    this.ensureSpaceUI();
    if (this.ship) this.camera.strategy.lockToActor(this.ship);
    if (getTouchControlsEnabled()) {
      this.touchControlsOverlay = new TouchControls(this.engine);
      this.add(this.touchControlsOverlay);
    }
  }

  private spawnAsteroids(config: typeof DEFAULT_SOLAR_SYSTEM): void {
    this.asteroids.forEach((a) => a.kill());
    this.asteroids = [];
    const belt = config.asteroidBelt;
    if (!belt) return;
    for (let i = 0; i < belt.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r =
        belt.innerRadius +
        Math.random() * (belt.outerRadius - belt.innerRadius);
      const size = belt.sizeMin + Math.random() * (belt.sizeMax - belt.sizeMin);
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      const orbitalSpeed = 80 + Math.random() * 40;
      const tangentX = -Math.sin(angle) * orbitalSpeed;
      const tangentY = Math.cos(angle) * orbitalSpeed;
      const ast = new Asteroid({
        x,
        y,
        radius: size,
        vx: tangentX,
        vy: tangentY,
      });
      this.add(ast);
      this.asteroids.push(ast);
    }
  }

  private showGameOver(): void {
    if (this.gameOverOverlay) return;
    const w = this.engine.drawWidth;
    const h = this.engine.drawHeight;
    const overlay = new ScreenElement({ x: 0, y: 0, anchor: vec(0, 0) });
    const bg = new Actor({
      x: w / 2,
      y: h / 2,
      width: w,
      height: h,
      color: Color.fromRGB(0, 0, 0, 0.7),
      anchor: vec(0.5, 0.5),
    });
    overlay.addChild(bg);
    const label = new Label({
      text: "Game Over",
      pos: vec(w / 2, h / 2 - 40),
      color: Color.fromHex("#ef4444"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 36,
        unit: FontUnit.Px,
      }),
    });
    label.anchor.setTo(0.5, 0.5);
    overlay.addChild(label);
    const backBtn = new Button({
      pos: vec(w / 2, h / 2 + 20),
      width: 180,
      height: 44,
      text: "Back to base",
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.gameOverOverlay?.kill();
        this.gameOverOverlay = null;
        this.engine.goToScene("planetRunMenu");
      },
    });
    overlay.addChild(backBtn);
    const menuBtn = new Button({
      pos: vec(w / 2, h / 2 + 76),
      width: 180,
      height: 44,
      text: "Main Menu",
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.gameOverOverlay?.kill();
        this.gameOverOverlay = null;
        this.engine.goToScene("mainMenu");
      },
    });
    overlay.addChild(menuBtn);
    this.add(overlay);
    this.gameOverOverlay = overlay;
  }

  private ensureSpaceUI(): void {
    if (this.uiContainer) return;
    const w = this.engine.drawWidth;
    const h = this.engine.drawHeight;
    this.uiContainer = new ScreenElement({ x: 0, y: 0, anchor: vec(0, 0) });

    this.landingButton = new Button({
      pos: vec(w / 2, h - 100),
      width: 220,
      height: 44,
      text: "Land",
      color: Color.fromHex("#22c55e"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 18,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        const planetId = this.getPlanetInLandingRange();
        if (planetId) this.doLand(planetId);
      },
    });
    this.landingButton.graphics.isVisible = false;
    this.uiContainer.addChild(this.landingButton);

    this.autopilotLabel = new Label({
      text: "Auto-pilot active",
      pos: vec(w / 2, 32),
      color: Color.fromHex("#fbbf24"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });
    this.autopilotLabel.anchor.setTo(0.5, 0.5);
    this.autopilotLabel.graphics.isVisible = false;
    this.uiContainer.addChild(this.autopilotLabel);

    this.hullLabel = new Label({
      text: "Hull: —",
      pos: vec(24, 24),
      color: Color.fromHex("#e2e8f0"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 14,
        unit: FontUnit.Px,
      }),
    });
    this.hullLabel.anchor.setTo(0, 0);
    this.uiContainer.addChild(this.hullLabel);

    const config = DEFAULT_SOLAR_SYSTEM;
    const font = new Font({
      family: "system-ui, sans-serif",
      size: 14,
      unit: FontUnit.Px,
    });
    config.planets.forEach((pDef, i) => {
      const btn = new Button({
        pos: vec(w - 100, 80 + i * 36),
        width: 160,
        height: 28,
        text: `Go to ${pDef.name}`,
        color: Color.fromHex("#e2e8f0"),
        font,
        onClick: () => {
          playClick();
          if (this.ship) {
            this.ship.autopilotOn = true;
            this.autopilotPlanetId = pDef.id;
            const planet = this.planets.find((p) => p.bodyId === pDef.id);
            if (planet) this.ship.autopilotTarget = planet.pos.clone();
          }
        },
      });
      this.uiContainer!.addChild(btn);
      this.goToButtons.set(pDef.id, btn);
    });

    this.add(this.uiContainer);

    // Off-screen planet direction arrows (one per planet); high z so they draw on top
    this.planetIndicatorContainer = new ScreenElement({
      x: 0,
      y: 0,
      anchor: vec(0, 0),
    });
    this.planetIndicatorContainer.z = 2000;
    const arrowSize = 12;
    const indicatorFont = new Font({
      family: "system-ui, sans-serif",
      size: 12,
      unit: FontUnit.Px,
    });
    for (const pDef of config.planets) {
      const color = planetColor(pDef.id);
      const graphic = new Polygon({
        points: [
          vec(arrowSize, 0),
          vec(-arrowSize, -arrowSize * 0.7),
          vec(-arrowSize, arrowSize * 0.7),
        ],
        color,
      });
      graphic.origin = vec(0, 0);
      const arrow = new Actor({
        pos: vec(0, 0),
        width: arrowSize * 2,
        height: arrowSize * 2,
        anchor: vec(0.5, 0.5),
      });
      arrow.graphics.use(graphic);
      arrow.graphics.isVisible = false;
      this.planetIndicatorContainer.addChild(arrow);
      this.planetArrowActors.push(arrow);

      const nameLabel = new Label({
        text: pDef.name,
        pos: vec(0, 0),
        font: indicatorFont,
      });
      nameLabel.anchor.setTo(0.5, 0.5);
      nameLabel.color = Color.White;
      nameLabel.graphics.isVisible = false;
      this.planetIndicatorContainer.addChild(nameLabel);
      this.planetIndicatorLabels.push(nameLabel);
    }
    this.add(this.planetIndicatorContainer);
  }

  private spawnPlanet(def: PlanetDef): SpaceBody {
    return new SpaceBody({
      x: def.orbitRadius,
      y: 0,
      mass: def.mass,
      radiusPx: def.radiusPx,
      color: planetColor(def.id),
      kind: "planet",
      bodyId: def.id,
      orbitRadius: def.orbitRadius,
      orbitPeriod: def.orbitPeriod,
      orbitPhase: 0,
    });
  }

  private spawnMoon(def: MoonDef, parent: SpaceBody): SpaceBody {
    return new SpaceBody({
      x: parent.pos.x + def.orbitRadius,
      y: parent.pos.y,
      mass: def.mass,
      radiusPx: def.radiusPx,
      color: MOON_COLOR,
      kind: "moon",
      bodyId: def.id,
      orbitRadius: def.orbitRadius,
      orbitPeriod: def.orbitPeriod,
      orbitPhase: 0,
      orbitParent: parent,
    });
  }

  /** Optional orbit path circles; enable by uncommenting this.spawnOrbitPaths(config) in initUI. */
  // @ts-expect-error TS6133 - kept for optional use, not currently called
  private spawnOrbitPaths(config: typeof DEFAULT_SOLAR_SYSTEM): void {
    const z = -500;
    for (const pDef of config.planets) {
      const r = pDef.orbitRadius;
      const orbitCircle = new Circle({
        radius: r,
        color: Color.Transparent,
        strokeColor: ORBIT_PATH_COLOR,
        lineWidth: 1,
      });
      orbitCircle.origin = vec(r, r);
      const actor = new Actor({
        x: 0,
        y: 0,
        width: r * 2,
        height: r * 2,
        anchor: vec(0.5, 0.5),
      });
      actor.graphics.use(orbitCircle);
      actor.z = z;
      this.orbitPathActors.push(actor);
      this.add(actor);
    }
    for (const moon of this.moons) {
      const r = moon.orbitRadius;
      const orbitCircle = new Circle({
        radius: r,
        color: Color.Transparent,
        strokeColor: ORBIT_PATH_COLOR,
        lineWidth: 1,
      });
      orbitCircle.origin = vec(r, r);
      const center = moon.getOrbitCenter();
      const actor = new Actor({
        x: center.x,
        y: center.y,
        width: r * 2,
        height: r * 2,
        anchor: vec(0.5, 0.5),
      });
      actor.graphics.use(orbitCircle);
      actor.z = z;
      this.orbitPathActors.push(actor);
      this.moonOrbitBindings.push({ actor, moon });
      this.add(actor);
    }
  }

  private ensureBackButton(): void {
    if (this.backButtonActor) return;
    const cx = this.engine.drawWidth / 2;
    const bottom = this.engine.drawHeight - 40;
    const container = new ScreenElement({
      x: 0,
      y: 0,
      anchor: vec(0, 0),
    });
    const backButton = new Button({
      pos: vec(cx, bottom),
      width: 200,
      height: 48,
      text: "Back to ship",
      color: Color.fromHex("#d1d5db"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 20,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        playClick();
        this.engine.goToScene("spaceship");
      },
    });
    container.addChild(backButton);
    this.add(container);
    this.backButtonActor = container;
  }

  onInitialize(): void {
    this.ensureBackButton();
  }

  /** All gravity sources (star + planets + moons) for the ship. */
  getGravityBodies(): SpaceBody[] {
    const out: SpaceBody[] = [];
    if (this.star) out.push(this.star);
    out.push(...this.planets, ...this.moons);
    return out;
  }

  getStar(): SpaceBody | null {
    return this.star;
  }

  getPlanets(): SpaceBody[] {
    return this.planets;
  }
}
