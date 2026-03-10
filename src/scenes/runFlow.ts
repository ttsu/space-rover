import {
  Color,
  Engine,
  Label,
  Scene,
  vec,
  Font,
  FontUnit,
  Timer,
  Vector,
} from "excalibur";
import type { CargoCounts } from "../entities/Rover";
import { finishRun } from "../state/GameState";
import { burst, risingBurst } from "../effects/Particles";
import { playDock, playDeath } from "../audio/sounds";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";

function runAfter(scene: Scene, delayMs: number, fn: () => void): void {
  const timer = new Timer({
    interval: delayMs,
    repeats: false,
    fcn: () => {
      fn();
      timer.cancel();
    },
  });
  scene.add(timer);
  timer.start();
}

export interface RunFlowSubject {
  cargo: CargoCounts;
  usedCapacity: number;
  maxCapacity: number;
  health: number;
  pos: Vector;
  moveTo?: (target: Vector, speed: number) => void;
}

/**
 * Handles the "return to base" flow: effects, label, rover move, then finishRun and scene transition.
 * Caller should set runEnded = true before calling.
 */
export function triggerReturnToBase(
  scene: Scene,
  engine: Engine,
  subject: RunFlowSubject,
  basePos: Vector
): void {
  playDock();

  risingBurst(scene, basePos.x, basePos.y, {
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
    pos: vec(engine.drawWidth / 2, engine.drawHeight / 2 - 40),
    color: Color.fromHex("#facc15"),
    font: new Font({
      family: "system-ui, sans-serif",
      size: 28,
      unit: FontUnit.Px,
    }),
  });
  bankedLabel.anchor.setTo(0.5, 0.5);
  scene.add(bankedLabel);

  const roverTarget = basePos.clone();
  subject.moveTo?.(roverTarget, 120);

  runAfter(scene, 1200, () => {
    bankedLabel.kill();
    finishRun(
      subject.cargo,
      subject.usedCapacity,
      subject.maxCapacity,
      subject.health
    );
    goToScene(engine, SCENE_KEYS.summary);
  });
}

/**
 * Handles the death flow: effects, label, then finishRun and scene transition.
 * Caller should set runEnded = true before calling.
 */
export function triggerDeath(
  scene: Scene,
  engine: Engine,
  subject: RunFlowSubject
): void {
  playDeath();

  engine.currentScene.camera.shake(8, 8, 500);

  burst(scene, subject.pos.x, subject.pos.y, {
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
    pos: vec(engine.drawWidth / 2, engine.drawHeight / 2 - 40),
    color: Color.fromHex("#ef4444"),
    font: new Font({
      family: "system-ui, sans-serif",
      size: 32,
      unit: FontUnit.Px,
    }),
  });
  failLabel.anchor.setTo(0.5, 0.5);
  scene.add(failLabel);

  runAfter(scene, 1500, () => {
    failLabel.kill();
    // On death (battery or health), cargo is lost; only bank when returning to base.
    const emptyCargo = { iron: 0, crystal: 0, gas: 0 };
    finishRun(emptyCargo, 0, subject.maxCapacity, subject.health);
    goToScene(engine, SCENE_KEYS.summary);
  });
}
