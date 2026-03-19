import { createElement } from "react";
import { Engine, Scene } from "excalibur";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";
import {
  mountReactOverlay,
  unmountReactOverlay,
} from "../ui/react/ReactOverlayManager";
import { ConfigureRoverView } from "../ui/react/views/ConfigureRoverView";

export class ConfigureRoverScene extends Scene {
  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    mountReactOverlay(
      createElement(ConfigureRoverView, {
        onStartMission: () => {
          goToScene(this.engine, SCENE_KEYS.planet);
        },
        onBackToPlanetRunMenu: () => {
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
