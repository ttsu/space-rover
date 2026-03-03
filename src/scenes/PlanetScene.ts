import {
  Color,
  Engine,
  Label,
  Scene,
  vec,
  Font,
  FontUnit,
  Keys,
  ScreenElement,
  Actor,
  type ExcaliburGraphicsContext,
} from "excalibur";
import { Button } from "../ui/Button";
import { Rover } from "../entities/Rover";
import { BlasterProjectile } from "../entities/BlasterProjectile";
import { generatePlanet } from "../world/PlanetGenerator";
import {
  FogVisibilitySystem,
  FogOverlaySystem,
  drawFogOverlay,
} from "../world/FogOfWar";
import { TILE_SIZE, PLANET_WIDTH_TILES, PLANET_HEIGHT_TILES } from "../config/gameConfig";
import { resetRunTracking, finishRun, GameState } from "../state/GameState";
import { Hud } from "../ui/Hud";
import { TouchControls } from "../ui/TouchControls";
import {
  getTouchControlsEnabled,
  setTouchControlsEnabled,
} from "../input/TouchInputState";
import { getCurrentSave } from "../state/Saves";
import { getCargoLayout, getMaxCargoFromLayout } from "../state/Progress";
import { setSeed } from "../utils/seedRandom";
import { burst, risingBurst } from "../effects/Particles";
import { playBlaster, playDamage, playDock, playDeath } from "../audio/sounds";

const TOUCH_TOGGLE_KEY = Keys.T;

export class PlanetScene extends Scene {
  private engineRef: Engine;
  private rover!: Rover;
  private infoLabel!: Label;
  private hud!: Hud;
  private returnToShipBtn?: Button;
  private touchControlsOverlay?: TouchControls;
  private touchReturnContainer?: ScreenElement;
  private basePos = vec(0, 0);
  private worldActors: Actor[] = [];
  private quakeTimer = 0;
  private runEnded = false;

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onActivate() {
    resetRunTracking();
    const save = getCurrentSave();
    if (!save) {
      this.engineRef.goToScene("mainMenu");
      return;
    }
    for (const a of this.worldActors) a.kill();
    this.worldActors = [];
    setSeed(save.seed);
    const planet = generatePlanet(this, this.engineRef, this.rover, {
      difficulty: save.difficulty,
    });
    this.basePos = planet.base.pos.clone();
    this.worldActors = planet.actors;
    this.runEnded = false;
    if (this.rover) {
      this.rover.resetForNewMission();
      this.rover.pos.x = this.basePos.x;
      this.rover.pos.y = this.basePos.y - TILE_SIZE;
    }
  }

  onInitialize() {
    this.engineRef.backgroundColor = Color.fromHex("#020617");

    const cargoConfig = getMaxCargoFromLayout(getCargoLayout());
    this.rover = new Rover(
      this.engineRef.drawWidth / 2,
      this.engineRef.drawHeight / 2,
      undefined,
      cargoConfig
    );
    this.add(this.rover);

    this.rover.onDamaged = (amount: number) => {
      playDamage();
      this.engineRef.currentScene.camera.shake(4, 4, 200);
      const r = this.rover.pos;
      burst(this, r.x, r.y, {
        color: Color.fromHex("#ef4444"),
        count: 5 + Math.min(amount, 3),
        speedMin: 30,
        speedMax: 90,
        lifetimeMs: 350,
        sizeMin: 3,
        sizeMax: 7,
      });
    };

    this.rover.onFireBlaster = (x, y, angle, damage, speed, range) => {
      playBlaster();
      const proj = new BlasterProjectile(x, y, angle, damage, speed, range);
      this.add(proj);
    };

    this.rover.onBatteryDepleted = () => {
      this.triggerDeath();
    };

    this.infoLabel = new Label({
      text: "W/S A/D drive. Space to fire. T = toggle touch controls. Return to base to finish.",
      pos: vec(16, 24),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 16,
        unit: FontUnit.Px,
      }),
    });
    this.infoLabel.z = 1000;
    this.add(this.infoLabel);

    this.hud = new Hud(this.engineRef, this.rover);
    this.hud.z = 1000;
    this.add(this.hud);

    if (getTouchControlsEnabled()) {
      this.addTouchControlsOverlay();
    }

    this.camera.strategy.lockToActor(this.rover);

    this.world.add(new FogVisibilitySystem(this.world, this.rover));
    this.world.add(new FogOverlaySystem(this.world, this.rover));

    this.engineRef.input.pointers.primary.on("down", (e) => {
      if (this.engineRef.currentScene !== this) return;
      if (!getTouchControlsEnabled() || !this.returnToShipBtn) return;
      if (!this.returnToShipBtn.graphics.isVisible || this.runEnded) return;
      const p = e.screenPos;
      const cx = this.engineRef.drawWidth / 2;
      const by = this.engineRef.drawHeight - 40;
      const w = PlanetScene.RETURN_BUTTON_WIDTH;
      const h = PlanetScene.RETURN_BUTTON_HEIGHT;
      if (
        p.x >= cx - w / 2 &&
        p.x <= cx + w / 2 &&
        p.y >= by - h / 2 &&
        p.y <= by + h / 2
      ) {
        this.triggerReturnToBase();
      }
    });
  }

  onPostDraw(ctx: ExcaliburGraphicsContext, _elapsed: number): void {
    drawFogOverlay(
      ctx,
      this.rover,
      this.camera,
      this.engineRef.drawWidth,
      this.engineRef.drawHeight,
      PLANET_WIDTH_TILES,
      PLANET_HEIGHT_TILES
    );
  }

  private static readonly RETURN_BUTTON_WIDTH = 220;
  private static readonly RETURN_BUTTON_HEIGHT = 52;

  private addTouchControlsOverlay(): void {
    const tc = new TouchControls(this.engineRef);
    this.touchControlsOverlay = tc;
    this.add(tc);
    const returnContainer = new ScreenElement({ x: 0, y: 0 });
    returnContainer.z = 1000;
    this.touchReturnContainer = returnContainer;
    const cx = this.engineRef.drawWidth / 2;
    const by = this.engineRef.drawHeight - 40;
    const returnBtn = new Button({
      pos: vec(cx, by),
      width: PlanetScene.RETURN_BUTTON_WIDTH,
      height: PlanetScene.RETURN_BUTTON_HEIGHT,
      text: "Return to ship",
      color: Color.fromHex("#1c1917"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 22,
        unit: FontUnit.Px,
      }),
      onClick: () => {
        if (this.runEnded) return;
        this.triggerReturnToBase();
      },
    });
    returnBtn.graphics.isVisible = false;
    this.returnToShipBtn = returnBtn;
    returnContainer.addChild(returnBtn);
    this.add(returnContainer);
  }

  private removeTouchControlsOverlay(): void {
    if (this.touchControlsOverlay) {
      this.touchControlsOverlay.kill();
      this.touchControlsOverlay = undefined;
    }
    if (this.touchReturnContainer) {
      this.returnToShipBtn = undefined;
      this.touchReturnContainer.kill();
      this.touchReturnContainer = undefined;
    }
  }

  private triggerReturnToBase(): void {
    this.runEnded = true;
    playDock();

    risingBurst(this, this.basePos.x, this.basePos.y, {
      color: Color.fromHex("#facc15"),
      count: 20,
      speedMin: 30,
      speedMax: 80,
      lifetimeMs: 600,
      sizeMin: 3,
      sizeMax: 8,
      upwardBias: 0.5,
    });

    const bankedLabel = new Label({
      text: "Cargo banked!",
      pos: vec(
        this.engineRef.drawWidth / 2,
        this.engineRef.drawHeight / 2 - 40
      ),
      color: Color.fromHex("#facc15"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 28,
        unit: FontUnit.Px,
      }),
    });
    bankedLabel.anchor.setTo(0.5, 0.5);
    this.add(bankedLabel);

    const roverTarget = this.basePos.clone();
    this.rover.actions.moveTo(roverTarget, 120);

    setTimeout(() => {
      bankedLabel.kill();
      finishRun(
        this.rover.cargo,
        this.rover.usedCapacity,
        this.rover.maxCapacity,
        this.rover.health
      );
      this.engineRef.goToScene("summary");
    }, 1200);
  }

  private triggerDeath(): void {
    this.runEnded = true;
    playDeath();

    this.engineRef.currentScene.camera.shake(8, 8, 500);

    burst(this, this.rover.pos.x, this.rover.pos.y, {
      color: Color.fromHex("#ef4444"),
      count: 20,
      speedMin: 40,
      speedMax: 120,
      lifetimeMs: 600,
      sizeMin: 4,
      sizeMax: 10,
    });

    const failLabel = new Label({
      text: "Mission failed",
      pos: vec(
        this.engineRef.drawWidth / 2,
        this.engineRef.drawHeight / 2 - 40
      ),
      color: Color.fromHex("#ef4444"),
      font: new Font({
        family: "system-ui, sans-serif",
        size: 32,
        unit: FontUnit.Px,
      }),
    });
    failLabel.anchor.setTo(0.5, 0.5);
    this.add(failLabel);

    setTimeout(() => {
      failLabel.kill();
      finishRun(
        this.rover.cargo,
        this.rover.usedCapacity,
        this.rover.maxCapacity,
        this.rover.health
      );
      this.engineRef.goToScene("summary");
    }, 1500);
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (engine.input.keyboard.wasPressed(TOUCH_TOGGLE_KEY)) {
      const next = !getTouchControlsEnabled();
      setTouchControlsEnabled(next);
      if (next) {
        this.addTouchControlsOverlay();
      } else {
        this.removeTouchControlsOverlay();
      }
    }

    if (!this.runEnded && this.rover.health <= 0) {
      this.triggerDeath();
      return;
    }

    const distanceToBase = this.rover.pos.distance(this.basePos);
    const closeToBase = distanceToBase < 80;

    if (!this.runEnded && closeToBase) {
      const keyboard = engine.input.keyboard;
      if (keyboard.wasPressed(Keys.Enter)) {
        this.triggerReturnToBase();
      }
    }

    this.quakeTimer += delta;
    if (this.quakeTimer > 15000) {
      this.quakeTimer = 0;
      this.engineRef.currentScene.camera.shake(5, 5, 500);
    }

    this.hud.updateFromState(closeToBase, GameState.currentHazardsHit.lava);

    if (this.returnToShipBtn) {
      this.returnToShipBtn.graphics.isVisible = !this.runEnded && closeToBase;
    }
  }
}
