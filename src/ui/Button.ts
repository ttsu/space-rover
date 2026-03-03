import {
  Actor,
  Label,
  Color,
  Font,
  FontUnit,
  vec,
  Vector,
  TextAlign,
  BaseAlign,
  NineSlice,
  NineSliceStretch,
} from "excalibur";
import { Resources } from "../resources";
import { playClick } from "../audio/sounds";

const BUTTON_SLICE_SOURCE_SIZE = 48;

export interface ButtonOptions {
  pos: Vector;
  width: number;
  height: number;
  text: string;
  color?: Color;
  font?: Font;
  tint?: Color;
  onClick: () => void;
}

const defaultFont = new Font({
  family: "system-ui, sans-serif",
  size: 28,
  unit: FontUnit.Px,
  baseAlign: BaseAlign.Middle,
  textAlign: TextAlign.Center,
});

/**
 * Button actor that encapsulates a nine-slice background, centered label, and pointerup handling.
 * Add to a scene with scene.add(button); the label is a child and moves with the button.
 */
export class Button extends Actor {
  private label: Label;
  private buttonUp: NineSlice;

  constructor(options: ButtonOptions) {
    const { pos, width, height, text, font, color, tint, onClick } = options;
    super({
      pos,
      width,
      height,
      color: Color.Transparent,
      anchor: vec(0.5, 0.5),
    });

    const buttonTint = tint ?? Color.White;

    this.buttonUp = new NineSlice({
      width,
      height,
      source: Resources.BarSquare,
      tint: buttonTint,
      sourceConfig: {
        width: BUTTON_SLICE_SOURCE_SIZE,
        height: BUTTON_SLICE_SOURCE_SIZE,
        leftMargin: 8,
        topMargin: 8,
        rightMargin: 8,
        bottomMargin: 8,
      },
      destinationConfig: {
        drawCenter: true,
        horizontalStretch: NineSliceStretch.Stretch,
        verticalStretch: NineSliceStretch.Stretch,
      },
    });
    const buttonDown = this.buttonUp.clone();
    buttonDown.tint = buttonTint.clone().darken(0.2);

    this.graphics.use(this.buttonUp);

    if (font) {
      font.baseAlign = BaseAlign.Middle;
      font.textAlign = TextAlign.Center;
    }
    this.label = new Label({
      text,
      pos: vec(0, -5),
      width: width,
      maxWidth: width,
      color: color ?? Color.fromHex("#777777"),
      font: font ?? defaultFont,
    });
    this.addChild(this.label);

    this.on("pointerup", () => {
      this.graphics.use(this.buttonUp);
      playClick();
      onClick();
    });
    this.on("pointerdown", () => {
      this.graphics.use(buttonDown);
    });
    this.on("pointerleave", () => {
      this.graphics.use(this.buttonUp);
    });
  }

  setText(text: string): void {
    this.label.text = text;
  }

  /** When false, dims the button (e.g. when action not affordable). */
  setHighlighted(highlighted: boolean): void {
    this.buttonUp.tint = highlighted ? undefined : Color.fromHex("#888888");
  }
}
