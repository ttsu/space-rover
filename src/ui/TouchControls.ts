import {
  ScreenElement,
  Engine,
  Actor,
  Color,
  vec,
  Circle,
  type Vector,
} from "excalibur";
import { setTouchInput, clearTouchInput } from "../input/TouchInputState";

type TouchControlsMode = "classic" | "planet-simple";

const JOYSTICK_BASE_RADIUS = 70;
const JOYSTICK_STICK_RADIUS = 25;
const JOYSTICK_STICK_LIMIT = 40;
const FIRE_BUTTON_RADIUS = 58;
const UI_MARGIN = 90;
const MOVE_UI_DEADZONE_HEIGHT = 180;
const DESTINATION_MARKER_RADIUS = 28;

export class TouchControls extends ScreenElement {
  private engineRef: Engine;
  private mode: TouchControlsMode;
  private joystickActive = false;
  private stickOffset = vec(0, 0);
  private basePos = vec(0, 0);
  private firePos = vec(0, 0);
  private joystickStick!: Actor;
  private destinationMarker!: Actor;
  private destinationDot!: Actor;
  private holdingMove = false;
  private fireHeld = false;

  constructor(engine: Engine, mode: TouchControlsMode = "classic") {
    super({ x: 0, y: 0 });
    this.engineRef = engine;
    this.mode = mode;
  }

  onInitialize(): void {
    this.z = 1000;
    const canvas = this.engineRef.canvas;
    const w = this.engineRef.drawWidth || (canvas?.clientWidth ?? 0) || 800;
    const h = this.engineRef.drawHeight || (canvas?.clientHeight ?? 0) || 600;
    this.basePos = vec(
      UI_MARGIN + JOYSTICK_BASE_RADIUS,
      h - UI_MARGIN - JOYSTICK_BASE_RADIUS
    );
    this.firePos = vec(
      w - UI_MARGIN - FIRE_BUTTON_RADIUS,
      h - UI_MARGIN - FIRE_BUTTON_RADIUS
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

    this.destinationMarker = new Actor({
      pos: vec(-1000, -1000),
      width: DESTINATION_MARKER_RADIUS * 2,
      height: DESTINATION_MARKER_RADIUS * 2,
    });
    this.destinationMarker.anchor.setTo(0.5, 0.5);
    const markerRing = new Circle({
      radius: DESTINATION_MARKER_RADIUS,
      color: Color.fromRGB(14, 165, 233, 0.25),
      lineWidth: 3,
      strokeColor: Color.fromHex("#38bdf8"),
    });
    markerRing.origin = vec(
      DESTINATION_MARKER_RADIUS,
      DESTINATION_MARKER_RADIUS
    );
    this.destinationMarker.graphics.use(markerRing);
    this.destinationMarker.graphics.isVisible = false;

    this.destinationDot = new Actor({
      pos: vec(0, 0),
      width: 10,
      height: 10,
    });
    this.destinationDot.anchor.setTo(0.5, 0.5);
    const dot = new Circle({
      radius: 5,
      color: Color.fromHex("#bae6fd"),
    });
    dot.origin = vec(5, 5);
    this.destinationDot.graphics.use(dot);
    this.destinationMarker.addChild(this.destinationDot);

    if (this.mode === "classic") {
      this.addChild(joystickBase);
      this.addChild(this.joystickStick);
    } else {
      this.addChild(this.destinationMarker);
    }
    this.addChild(fireButton);

    const primary = this.engineRef.input.pointers.primary;
    primary.on("down", (e) => {
      const p = e.screenPos;
      const distToFire = Math.sqrt(
        (p.x - this.firePos.x) ** 2 + (p.y - this.firePos.y) ** 2
      );
      if (distToFire <= FIRE_BUTTON_RADIUS) {
        setTouchInput({ fire: true });
        this.fireHeld = true;
        return;
      }

      if (this.mode === "classic") {
        const dx = p.x - this.basePos.x;
        const dy = p.y - this.basePos.y;
        if (dx * dx + dy * dy <= JOYSTICK_BASE_RADIUS * JOYSTICK_BASE_RADIUS) {
          this.joystickActive = true;
        }
        return;
      }

      if (p.y >= this.engineRef.drawHeight - MOVE_UI_DEADZONE_HEIGHT) return;
      this.holdingMove = true;
      this.setMoveTargetFromScreen(p);
    });
    primary.on("move", (e) => {
      if (this.mode === "planet-simple") {
        if (!this.holdingMove) return;
        this.setMoveTargetFromScreen(e.screenPos);
        return;
      }
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
      this.fireHeld = false;
      if (this.mode === "planet-simple") {
        this.clearMoveTarget();
        return;
      }
      if (!this.joystickActive) return;
      this.joystickActive = false;
      this.stickOffset.x = 0;
      this.stickOffset.y = 0;
      setTouchInput({ targetAngle: null, magnitude: 0 });
      clearTouchInput();
    });
    primary.on("cancel", () => {
      this.fireHeld = false;
      if (this.mode === "planet-simple") {
        this.clearMoveTarget();
        return;
      }
      if (!this.joystickActive) return;
      this.joystickActive = false;
      this.stickOffset.x = 0;
      this.stickOffset.y = 0;
      setTouchInput({ targetAngle: null, magnitude: 0 });
      clearTouchInput();
    });
  }

  onPreUpdate(): void {
    if (this.mode === "classic") {
      this.joystickStick.pos = this.basePos.clone().add(this.stickOffset);
    }
    if (this.mode === "planet-simple" && this.fireHeld) {
      setTouchInput({ fire: true });
    }
  }

  private setMoveTargetFromScreen(screenPos: Vector): void {
    const worldPos = this.screenToWorld(screenPos);
    this.destinationMarker.pos = screenPos.clone();
    this.destinationMarker.graphics.isVisible = true;
    setTouchInput({
      isHoldingMove: true,
      moveTargetWorld: { x: worldPos.x, y: worldPos.y },
      targetAngle: null,
      magnitude: 0,
    });
  }

  private clearMoveTarget(): void {
    if (!this.holdingMove) return;
    this.holdingMove = false;
    this.destinationMarker.graphics.isVisible = false;
    setTouchInput({
      isHoldingMove: false,
      moveTargetWorld: null,
      targetAngle: null,
      magnitude: 0,
    });
  }

  private screenToWorld(screenPos: Vector): Vector {
    const engineAny = this.engineRef as unknown as {
      screenToWorldCoordinates?: (pos: Vector) => Vector;
      currentScene?: {
        camera?: {
          viewport?: { screenToWorldCoordinates?: (pos: Vector) => Vector };
        };
      };
    };
    if (typeof engineAny.screenToWorldCoordinates === "function") {
      return engineAny.screenToWorldCoordinates(screenPos);
    }
    const viewportConverter =
      engineAny.currentScene?.camera?.viewport?.screenToWorldCoordinates;
    if (typeof viewportConverter === "function") {
      return viewportConverter(screenPos);
    }
    return screenPos.clone();
  }
}
