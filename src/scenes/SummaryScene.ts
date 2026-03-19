import { createElement } from "react";
import { Engine, Scene } from "excalibur";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";
import {
  mountReactOverlay,
  unmountReactOverlay,
} from "../ui/react/ReactOverlayManager";
import { SummaryView } from "../ui/react/views/SummaryView";

export class SummaryScene extends Scene {
  constructor(_engine: Engine) {
    super();
  }

  onActivate(): void {
    mountReactOverlay(
      createElement(SummaryView, {
        onBackToMenu: () => {
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
