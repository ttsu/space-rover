const TOUCH_CONTROLS_STORAGE_KEY = "starship-touch-controls";

export interface TouchInputState {
  turnLeft: boolean;
  turnRight: boolean;
  accelerate: boolean;
  brake: boolean;
  fire: boolean;
}

const emptyState: TouchInputState = {
  turnLeft: false,
  turnRight: false,
  accelerate: false,
  brake: false,
  fire: false,
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
  if (typeof window === "undefined" || !window.localStorage) return false;
  const raw = window.localStorage.getItem(TOUCH_CONTROLS_STORAGE_KEY);
  if (raw === null) return isTouchDevice();
  return raw === "true";
}

export function setTouchControlsEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(TOUCH_CONTROLS_STORAGE_KEY, String(enabled));
}

export function isTouchDeviceCapable(): boolean {
  return isTouchDevice();
}
