import {
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  Actor,
  vec,
} from "excalibur";
import { requestFullscreen } from "../fullscreen";

export class SplashScene extends Scene {
  private engineRef: Engine;

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onInitialize() {
    const cx = this.engineRef.drawWidth / 2;

    const title = new Label({
      text: "Starship Rover",
      pos: vec(cx, this.engineRef.drawHeight / 2 - 80),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 48,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    const startButton = new Actor({
      pos: vec(cx, this.engineRef.drawHeight / 2 + 20),
      width: 200,
      height: 56,
      color: Color.fromHex("#3b82f6"),
    });
    startButton.anchor.setTo(0.5, 0.5);
    const startLabel = new Label({
      text: "Start",
      pos: startButton.pos.clone(),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 28,
        unit: FontUnit.Px,
      }),
    });
    startLabel.anchor.setTo(0.5, 0.5);
    startButton.on("pointerup", () => {
      requestFullscreen().finally(() => {
        this.engineRef.goToScene("mainMenu");
      });
    });

    this.add(title);
    this.add(startButton);
    this.add(startLabel);
  }
}
