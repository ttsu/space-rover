import { createElement } from "react";
import { Engine, Scene } from "excalibur";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";
import {
  mountReactOverlay,
  unmountReactOverlay,
} from "../ui/react/ReactOverlayManager";
import { MainMenuView } from "../ui/react/views/MainMenuView";

export class MainMenuScene extends Scene {
  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    mountReactOverlay(
      createElement(MainMenuView, {
        onNewGame: () => {
          goToScene(this.engine, SCENE_KEYS.difficultySelect);
        },
        onLoadSave: () => {
          goToScene(this.engine, SCENE_KEYS.planetRunMenu);
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
