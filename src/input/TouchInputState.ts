const TOUCH_CONTROLS_STORAGE_KEY = "starship-touch-controls";

export interface TouchInputState {
  /** Target direction in radians (Excalibur: 0 = right, π/2 = down). null when joystick released. */
  targetAngle: number | null;
  /** Magnitude 0–1 from joystick displacement; controls rover speed when using touch. */
  magnitude: number;
  /** World-space move target for hold-to-move touch navigation. */
  moveTargetWorld: { x: number; y: number } | null;
  /** True while touch navigation is actively holding a movement target. */
  isHoldingMove: boolean;
  fire: boolean;
  // Legacy fields (unused when targetAngle is used)
  turnLeft: boolean;
  turnRight: boolean;
  accelerate: boolean;
  brake: boolean;
}

const emptyState: TouchInputState = {
  targetAngle: null,
  magnitude: 0,
  moveTargetWorld: null,
  isHoldingMove: false,
  fire: false,
  turnLeft: false,
  turnRight: false,
  accelerate: false,
  brake: false,
};

let current: TouchInputState = { ...emptyState };

export function getTouchInput(): TouchInputState {
  return { ...current };
}

export function setTouchInput(state: Partial<TouchInputState>): void {
  current = { ...current, ...state };
}

export function clearTouchInput(): void {
  current = { ...emptyState };
}

function isTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints > 0;
}

export function getTouchControlsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!window.localStorage) return isTouchDevice();
    const raw = window.localStorage.getItem(TOUCH_CONTROLS_STORAGE_KEY);
    if (raw === null) return isTouchDevice();
    return raw === "true";
  } catch {
    return isTouchDevice();
  }
}

export function setTouchControlsEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(TOUCH_CONTROLS_STORAGE_KEY, String(enabled));
}

export function isTouchDeviceCapable(): boolean {
  return isTouchDevice();
}
