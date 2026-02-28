import { ScreenElement, Engine, Actor, Color, vec } from "excalibur";
import { setTouchInput, clearTouchInput } from "../input/TouchInputState";

const JOYSTICK_BASE_SIZE = 140;
const JOYSTICK_STICK_SIZE = 50;
const JOYSTICK_STICK_RADIUS = 40;
const JOYSTICK_DEADZONE = 12;
const FIRE_BUTTON_SIZE = 100;
const MARGIN = 90;

export class TouchControls extends ScreenElement {
  private engineRef: Engine;
  private joystickActive = false;
  private stickOffset = vec(0, 0);
  private basePos = vec(0, 0);
  private firePos = vec(0, 0);
  private joystickStick!: Actor;

  constructor(engine: Engine) {
    super({ x: 0, y: 0 });
    this.engineRef = engine;
  }

  onInitialize(): void {
    const w = this.engineRef.drawWidth;
    const h = this.engineRef.drawHeight;
    this.basePos = vec(
      MARGIN + JOYSTICK_BASE_SIZE / 2,
      h - MARGIN - JOYSTICK_BASE_SIZE / 2
    );
    this.firePos = vec(
      w - MARGIN - FIRE_BUTTON_SIZE / 2,
      h - MARGIN - FIRE_BUTTON_SIZE / 2
    );

    const baseColor = Color.fromRGB(255, 255, 255, 0.25);
    const stickColor = Color.fromRGB(255, 255, 255, 0.5);
    const fireColor = Color.fromRGB(239, 68, 68, 0.5);

    const joystickBase = new Actor({
      pos: this.basePos.clone(),
      width: JOYSTICK_BASE_SIZE,
      height: JOYSTICK_BASE_SIZE,
      color: baseColor,
    });
    joystickBase.anchor.setTo(0.5, 0.5);

    this.joystickStick = new Actor({
      pos: this.basePos.clone(),
      width: JOYSTICK_STICK_SIZE,
      height: JOYSTICK_STICK_SIZE,
      color: stickColor,
    });
    this.joystickStick.anchor.setTo(0.5, 0.5);

    const fireButton = new Actor({
      pos: this.firePos.clone(),
      width: FIRE_BUTTON_SIZE,
      height: FIRE_BUTTON_SIZE,
      color: fireColor,
    });
    fireButton.anchor.setTo(0.5, 0.5);
    fireButton.on("pointerdown", () => {
      setTouchInput({ fire: true });
    });

    this.addChild(joystickBase);
    this.addChild(this.joystickStick);
    this.addChild(fireButton);

    const primary = this.engineRef.input.pointers.primary;
    primary.on("down", (e) => {
      const p = e.screenPos;
      const dx = p.x - this.basePos.x;
      const dy = p.y - this.basePos.y;
      if (dx * dx + dy * dy <= (JOYSTICK_BASE_SIZE / 2) ** 2) {
        this.joystickActive = true;
      }
    });
    primary.on("move", (e) => {
      if (!this.joystickActive) return;
      const p = e.screenPos;
      let dx = p.x - this.basePos.x;
      let dy = p.y - this.basePos.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > JOYSTICK_STICK_RADIUS) {
        const s = JOYSTICK_STICK_RADIUS / len;
        dx *= s;
        dy *= s;
      }
      this.stickOffset.x = dx;
      this.stickOffset.y = dy;
      const dz = JOYSTICK_DEADZONE;
      setTouchInput({
        turnLeft: dx < -dz,
        turnRight: dx > dz,
        accelerate: dy < -dz,
        brake: dy > dz,
      });
    });
    primary.on("up", () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.stickOffset.x = 0;
        this.stickOffset.y = 0;
        clearTouchInput();
      }
    });
    primary.on("cancel", () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.stickOffset.x = 0;
        this.stickOffset.y = 0;
        clearTouchInput();
      }
    });
  }

  onPreUpdate(): void {
    this.joystickStick.pos = this.basePos.clone().add(this.stickOffset);
  }
}
