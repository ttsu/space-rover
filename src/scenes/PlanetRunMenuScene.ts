import { createElement } from "react";
import { Engine, Scene } from "excalibur";
import { requestFullscreen } from "../fullscreen";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";
import {
  mountReactOverlay,
  unmountReactOverlay,
} from "../ui/react/ReactOverlayManager";
import { PlanetRunMenuView } from "../ui/react/views/PlanetRunMenuView";

export class PlanetRunMenuScene extends Scene {
  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    mountReactOverlay(
      createElement(PlanetRunMenuView, {
        onStartRun: () => {
          void requestFullscreen().finally(() => {
            goToScene(this.engine, SCENE_KEYS.planet);
          });
        },
        onConfigureRover: () => {
          goToScene(this.engine, SCENE_KEYS.configureRover);
        },
        onSpaceship: () => {
          goToScene(this.engine, SCENE_KEYS.spaceship);
        },
        onExitToMainMenu: () => {
          goToScene(this.engine, SCENE_KEYS.mainMenu);
        },
      }),
      {
        width: this.engine.drawWidth,
        height: this.engine.drawHeight,
      }
    );
  }

  onDeactivate(): void {
    unmountReactOverlay();
  }
}
