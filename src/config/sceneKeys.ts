import type { Engine } from "excalibur";

export const SCENE_KEYS = {
  splash: "splash",
  mainMenu: "mainMenu",
  difficultySelect: "difficultySelect",
  planetRunMenu: "planetRunMenu",
  planet: "planet",
  summary: "summary",
  configureRover: "configureRover",
  spaceship: "spaceship",
  spaceNav: "spaceNav",
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export function goToScene(engine: Engine, scene: SceneKey): void {
  engine.goToScene(scene);
}
