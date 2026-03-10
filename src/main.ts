import "./style.css";
import { Engine, DisplayMode, Color } from "excalibur";
import { loader } from "./resources";
import { SplashScene } from "./scenes/SplashScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { DifficultySelectScene } from "./scenes/DifficultySelectScene";
import { PlanetRunMenuScene } from "./scenes/PlanetRunMenuScene";
import { PlanetScene } from "./scenes/PlanetScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { ConfigureRoverScene } from "./scenes/ConfigureRoverScene";
import { SpaceshipScene } from "./scenes/SpaceshipScene";
import { SpaceNavScene } from "./scenes/SpaceNavScene";
import { SCENE_KEYS, goToScene } from "./config/sceneKeys";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error('Game canvas with id \"game\" not found');
}

const engine = new Engine({
  canvasElement: canvas,
  width: 800,
  height: 600,
  displayMode: DisplayMode.FillScreen,
  backgroundColor: Color.fromHex("#050816"),
});

engine.add(SCENE_KEYS.splash, new SplashScene(engine));
engine.add(SCENE_KEYS.mainMenu, new MainMenuScene(engine));
engine.add(SCENE_KEYS.difficultySelect, new DifficultySelectScene(engine));
engine.add(SCENE_KEYS.planetRunMenu, new PlanetRunMenuScene(engine));
engine.add(SCENE_KEYS.planet, new PlanetScene(engine));
engine.add(SCENE_KEYS.summary, new SummaryScene(engine));
engine.add(SCENE_KEYS.configureRover, new ConfigureRoverScene(engine));
engine.add(SCENE_KEYS.spaceship, new SpaceshipScene(engine));
engine.add(SCENE_KEYS.spaceNav, new SpaceNavScene(engine));

goToScene(engine, SCENE_KEYS.splash);
engine.start(loader);
