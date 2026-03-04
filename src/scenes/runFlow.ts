import { Color, Engine, Label, Scene, vec, Font, FontUnit } from "excalibur";
import type { Rover } from "../entities/Rover";
import type { Vector } from "excalibur";
import { finishRun } from "../state/GameState";
import { burst, risingBurst } from "../effects/Particles";
import { playDock, playDeath } from "../audio/sounds";

/**
 * Handles the "return to base" flow: effects, label, rover move, then finishRun and scene transition.
 * Caller should set runEnded = true before calling.
 */
export function triggerReturnToBase(
  scene: Scene,
  engine: Engine,
  rover: Rover,
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
  rover.actions.moveTo(roverTarget, 120);

  setTimeout(() => {
    bankedLabel.kill();
    finishRun(rover.cargo, rover.usedCapacity, rover.maxCapacity, rover.health);
    engine.goToScene("summary");
  }, 1200);
}

/**
 * Handles the death flow: effects, label, then finishRun and scene transition.
 * Caller should set runEnded = true before calling.
 */
export function triggerDeath(scene: Scene, engine: Engine, rover: Rover): void {
  playDeath();

  engine.currentScene.camera.shake(8, 8, 500);

  burst(scene, rover.pos.x, rover.pos.y, {
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

  setTimeout(() => {
    failLabel.kill();
    finishRun(rover.cargo, rover.usedCapacity, rover.maxCapacity, rover.health);
    engine.goToScene("summary");
  }, 1500);
}
