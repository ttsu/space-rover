import { ScreenElement, Engine, Actor, Color, vec, Circle } from "excalibur";
import { setTouchInput, clearTouchInput } from "../input/TouchInputState";

const JOYSTICK_BASE_RADIUS = 70;
const JOYSTICK_STICK_RADIUS = 25;
const JOYSTICK_STICK_LIMIT = 40;
const FIRE_BUTTON_RADIUS = 50;
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
    this.z = 1000;
    const w = this.engineRef.drawWidth;
    const h = this.engineRef.drawHeight;
    this.basePos = vec(
      MARGIN + JOYSTICK_BASE_RADIUS,
      h - MARGIN - JOYSTICK_BASE_RADIUS
    );
    this.firePos = vec(
      w - MARGIN - FIRE_BUTTON_RADIUS,
      h - MARGIN - FIRE_BUTTON_RADIUS
    );

    const baseColor = Color.fromRGB(255, 255, 255, 0.25);
    const stickColor = Color.fromRGB(255, 255, 255, 0.5);
    const fireColor = Color.fromRGB(239, 68, 68, 0.5);

    const joystickBase = new Actor({
      pos: this.basePos.clone(),
      width: JOYSTICK_BASE_RADIUS * 2,
      height: JOYSTICK_BASE_RADIUS * 2,
    });
    joystickBase.anchor.setTo(0.5, 0.5);
    const baseCircle = new Circle({
      radius: JOYSTICK_BASE_RADIUS,
      color: baseColor,
    });
    baseCircle.origin = vec(JOYSTICK_BASE_RADIUS, JOYSTICK_BASE_RADIUS);
    joystickBase.graphics.use(baseCircle);

    this.joystickStick = new Actor({
      pos: this.basePos.clone(),
      width: JOYSTICK_STICK_RADIUS * 2,
      height: JOYSTICK_STICK_RADIUS * 2,
    });
    this.joystickStick.anchor.setTo(0.5, 0.5);
    const stickCircle = new Circle({
      radius: JOYSTICK_STICK_RADIUS,
      color: stickColor,
    });
    stickCircle.origin = vec(JOYSTICK_STICK_RADIUS, JOYSTICK_STICK_RADIUS);
    this.joystickStick.graphics.use(stickCircle);

    const fireButton = new Actor({
      pos: this.firePos.clone(),
      width: FIRE_BUTTON_RADIUS * 2,
      height: FIRE_BUTTON_RADIUS * 2,
    });
    fireButton.anchor.setTo(0.5, 0.5);
    fireButton.z = 1001;
    const fireCircle = new Circle({
      radius: FIRE_BUTTON_RADIUS,
      color: fireColor,
    });
    fireCircle.origin = vec(FIRE_BUTTON_RADIUS, FIRE_BUTTON_RADIUS);
    fireButton.graphics.use(fireCircle);

    this.addChild(joystickBase);
    this.addChild(this.joystickStick);
    this.addChild(fireButton);

    const primary = this.engineRef.input.pointers.primary;
    primary.on("down", (e) => {
      const p = e.screenPos;
      const distToFire = Math.sqrt(
        (p.x - this.firePos.x) ** 2 + (p.y - this.firePos.y) ** 2
      );
      if (distToFire <= FIRE_BUTTON_RADIUS) {
        setTouchInput({ fire: true });
        return;
      }
      const dx = p.x - this.basePos.x;
      const dy = p.y - this.basePos.y;
      if (dx * dx + dy * dy <= JOYSTICK_BASE_RADIUS * JOYSTICK_BASE_RADIUS) {
        this.joystickActive = true;
      }
    });
    primary.on("move", (e) => {
      if (!this.joystickActive) return;
      const p = e.screenPos;
      let dx = p.x - this.basePos.x;
      let dy = p.y - this.basePos.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > JOYSTICK_STICK_LIMIT) {
        const s = JOYSTICK_STICK_LIMIT / len;
        dx *= s;
        dy *= s;
      }
      this.stickOffset.x = dx;
      this.stickOffset.y = dy;
      const magnitude = len > 0 ? Math.min(1, len / JOYSTICK_STICK_LIMIT) : 0;
      const targetAngle = Math.atan2(dy, dx);
      setTouchInput({ targetAngle, magnitude });
    });
    primary.on("up", () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.stickOffset.x = 0;
        this.stickOffset.y = 0;
        setTouchInput({ targetAngle: null, magnitude: 0 });
        clearTouchInput();
      }
    });
    primary.on("cancel", () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.stickOffset.x = 0;
        this.stickOffset.y = 0;
        setTouchInput({ targetAngle: null, magnitude: 0 });
        clearTouchInput();
      }
    });
  }

  onPreUpdate(): void {
    this.joystickStick.pos = this.basePos.clone().add(this.stickOffset);
  }
}
