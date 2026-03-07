import type { Vector } from "excalibur";

export interface EdgeIndicator {
  screenX: number;
  screenY: number;
  angleRad: number;
}

export interface EdgeIndicatorOptions {
  /** Camera zoom (world units per pixel). Default 1. */
  zoom?: number;
  /** If the target's screen position is inside this margin from the edge, no arrow is shown. Default 48. */
  visibilityMargin?: number;
  /** Arrow is placed this many pixels from the screen edge. Default 36. */
  edgeMargin?: number;
}

export interface EdgeIndicatorScreenOptions {
  visibilityMargin?: number;
  edgeMargin?: number;
}

const DEFAULT_OPTIONS: Required<EdgeIndicatorOptions> = {
  zoom: 1,
  visibilityMargin: 48,
  edgeMargin: 36,
};

const DEFAULT_SCREEN_OPTIONS: Required<EdgeIndicatorScreenOptions> = {
  visibilityMargin: 48,
  edgeMargin: 36,
};

/**
 * When a world-space point is off-screen, returns position and angle for an edge arrow; otherwise null.
 * Used for base indicator (planet scene) and planet/moon indicators (space nav scene).
 */
export function getEdgeIndicator(
  worldX: number,
  worldY: number,
  cameraPos: Vector,
  drawWidth: number,
  drawHeight: number,
  options: EdgeIndicatorOptions = {}
): EdgeIndicator | null {
  const { zoom, visibilityMargin, edgeMargin } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const halfW = drawWidth / 2;
  const halfH = drawHeight / 2;
  const cam = cameraPos;
  const baseScreenX = (worldX - cam.x) * zoom + halfW;
  const baseScreenY = (worldY - cam.y) * zoom + halfH;

  if (
    baseScreenX >= visibilityMargin &&
    baseScreenX <= drawWidth - visibilityMargin &&
    baseScreenY >= visibilityMargin &&
    baseScreenY <= drawHeight - visibilityMargin
  ) {
    return null;
  }

  const dx = baseScreenX - halfW;
  const dy = baseScreenY - halfH;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;

  const left = edgeMargin;
  const right = drawWidth - edgeMargin;
  const top = edgeMargin;
  const bottom = drawHeight - edgeMargin;

  let t = Infinity;
  if (ux > 0) t = Math.min(t, (right - halfW) / ux);
  else if (ux < 0) t = Math.min(t, (left - halfW) / ux);
  if (uy > 0) t = Math.min(t, (bottom - halfH) / uy);
  else if (uy < 0) t = Math.min(t, (top - halfH) / uy);

  if (t === Infinity || t <= 0) return null;
  let screenX = halfW + ux * t;
  let screenY = halfH + uy * t;
  screenX = Math.max(left, Math.min(right, screenX));
  screenY = Math.max(top, Math.min(bottom, screenY));
  const angleRad = Math.atan2(dy, dx);
  return { screenX, screenY, angleRad };
}

/**
 * Same as getEdgeIndicator but takes a position already in screen coordinates.
 * Use this when the scene uses camera zoom or drawPos so the engine's
 * worldToScreenCoordinates matches the arrow logic exactly.
 */
export function getEdgeIndicatorFromScreen(
  screenX: number,
  screenY: number,
  drawWidth: number,
  drawHeight: number,
  options: EdgeIndicatorScreenOptions = {}
): EdgeIndicator | null {
  const { visibilityMargin, edgeMargin } = {
    ...DEFAULT_SCREEN_OPTIONS,
    ...options,
  };
  const halfW = drawWidth / 2;
  const halfH = drawHeight / 2;

  if (
    screenX >= visibilityMargin &&
    screenX <= drawWidth - visibilityMargin &&
    screenY >= visibilityMargin &&
    screenY <= drawHeight - visibilityMargin
  ) {
    return null;
  }

  const dx = screenX - halfW;
  const dy = screenY - halfH;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;

  const left = edgeMargin;
  const right = drawWidth - edgeMargin;
  const top = edgeMargin;
  const bottom = drawHeight - edgeMargin;

  let t = Infinity;
  if (ux > 0) t = Math.min(t, (right - halfW) / ux);
  else if (ux < 0) t = Math.min(t, (left - halfW) / ux);
  if (uy > 0) t = Math.min(t, (bottom - halfH) / uy);
  else if (uy < 0) t = Math.min(t, (top - halfH) / uy);

  if (t === Infinity || t <= 0) return null;
  let outX = halfW + ux * t;
  let outY = halfH + uy * t;
  // Clamp to the edge rectangle so the arrow is always on-screen (e.g. when
  // we hit the right edge first but the computed y would be below the bottom)
  outX = Math.max(left, Math.min(right, outX));
  outY = Math.max(top, Math.min(bottom, outY));
  const angleRad = Math.atan2(dy, dx);
  return { screenX: outX, screenY: outY, angleRad };
}
