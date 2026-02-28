import "./style.css";
import { Engine, DisplayMode, Color } from "excalibur";
import { loader } from "./resources";
import { SplashScene } from "./scenes/SplashScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { DifficultySelectScene } from "./scenes/DifficultySelectScene";
import { PlanetRunMenuScene } from "./scenes/PlanetRunMenuScene";
import { PlanetScene } from "./scenes/PlanetScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { UpgradeScene } from "./scenes/UpgradeScene";

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

engine.add("splash", new SplashScene(engine));
engine.add("mainMenu", new MainMenuScene(engine));
engine.add("difficultySelect", new DifficultySelectScene(engine));
engine.add("planetRunMenu", new PlanetRunMenuScene(engine));
engine.add("planet", new PlanetScene(engine));
engine.add("summary", new SummaryScene(engine));
engine.add("upgrade", new UpgradeScene(engine));

engine.goToScene("splash");
engine.start(loader);
