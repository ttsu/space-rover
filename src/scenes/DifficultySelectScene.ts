import {
  Engine,
  Scene,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  TextAlign,
  BaseAlign,
} from "excalibur";
import { createSave, type Difficulty } from "../state/Saves";
import { Button } from "../ui/Button";
import { playClick } from "../audio/sounds";
import { SCENE_KEYS, goToScene } from "../config/sceneKeys";

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
];

export class DifficultySelectScene extends Scene {
  constructor(_engine: Engine) {
    super();
  }

  onInitialize() {
    const cx = this.engine.drawWidth / 2;

    const title = new Label({
      text: "Choose difficulty",
      pos: vec(cx, this.engine.drawHeight / 2 - 120),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 36,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    const btnWidth = 200;
    const btnHeight = 48;
    const startY = this.engine.drawHeight / 2 - 40;
    const spacing = 56;

    DIFFICULTIES.forEach((d, i) => {
      const y = startY + i * spacing;
      const btn = new Button({
        pos: vec(cx, y),
        width: btnWidth,
        height: btnHeight,
        text: d.label,
        font: new Font({
          family: "system-ui, sans-serif",
          size: 22,
          unit: FontUnit.Px,
          textAlign: TextAlign.Center,
          baseAlign: BaseAlign.Middle,
        }),
        onClick: () => {
          playClick();
          createSave(d.id);
          goToScene(this.engine, SCENE_KEYS.planetRunMenu);
        },
      });
      this.add(btn);
    });

    this.add(title);
  }
}
