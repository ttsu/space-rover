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
import { createSave, type Difficulty } from "../state/Saves";

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
];

export class DifficultySelectScene extends Scene {
  private engineRef: Engine;

  constructor(engine: Engine) {
    super();
    this.engineRef = engine;
  }

  onInitialize() {
    const cx = this.engineRef.drawWidth / 2;

    const title = new Label({
      text: "Choose difficulty",
      pos: vec(cx, this.engineRef.drawHeight / 2 - 120),
      color: Color.White,
      font: new Font({
        family: "system-ui, sans-serif",
        size: 36,
        unit: FontUnit.Px,
      }),
    });
    title.anchor.setTo(0.5, 0.5);

    const startY = this.engineRef.drawHeight / 2 - 40;
    const spacing = 56;

    DIFFICULTIES.forEach((d, i) => {
      const btn = new Actor({
        pos: vec(cx, startY + i * spacing),
        width: 200,
        height: 48,
        color: Color.fromHex("#3b82f6"),
      });
      btn.anchor.setTo(0.5, 0.5);
      const label = new Label({
        text: d.label,
        pos: btn.pos.clone(),
        color: Color.White,
        font: new Font({
          family: "system-ui, sans-serif",
          size: 22,
          unit: FontUnit.Px,
        }),
      });
      label.anchor.setTo(0.5, 0.5);
      btn.on("pointerup", () => {
        createSave(d.id);
        this.engineRef.goToScene("planetRunMenu");
      });
      this.add(btn);
      this.add(label);
    });

    this.add(title);
  }
}
