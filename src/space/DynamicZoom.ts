export interface ZoomInputBody {
  distanceToShip: number;
  radiusPx: number;
  id: string;
}

export interface ZoomState {
  smoothedZoom: number;
  lastNearestId: string | null;
  lastNearestDist: number;
}

export interface ZoomResult extends ZoomState {
  zoom: number;
}

export function computeDynamicZoom(
  state: ZoomState,
  bodies: ZoomInputBody[],
  viewSize: number,
  margin: number,
  hysteresisPx: number,
  zoomMin: number,
  zoomMax: number,
  zoomLerp: number
): ZoomResult {
  let nearest = bodies[0] ?? null;
  for (const body of bodies) {
    if (!nearest || body.distanceToShip < nearest.distanceToShip) {
      nearest = body;
    }
  }

  let nearestId = nearest?.id ?? null;
  let nearestDist = nearest?.distanceToShip ?? Infinity;
  if (
    state.lastNearestId &&
    nearestId &&
    nearestId !== state.lastNearestId &&
    nearestDist > state.lastNearestDist - hysteresisPx
  ) {
    const prev = bodies.find((b) => b.id === state.lastNearestId);
    if (prev) {
      nearestId = prev.id;
      nearestDist = prev.distanceToShip;
      nearest = prev;
    }
  }

  const nearestRadius = nearest?.radiusPx ?? 0;
  let radiusToFit = nearestDist + nearestRadius + margin;
  if (nearestId) {
    for (const body of bodies) {
      if (body.id === nearestId) continue;
      radiusToFit = Math.max(
        radiusToFit,
        body.distanceToShip + body.radiusPx + margin
      );
    }
  }

  const targetZoom = radiusToFit <= 0 ? zoomMax : viewSize / (2 * radiusToFit);
  const clampedTarget = Math.max(zoomMin, Math.min(zoomMax, targetZoom));
  const smoothedZoom =
    state.smoothedZoom + (clampedTarget - state.smoothedZoom) * zoomLerp;

  return {
    zoom: smoothedZoom,
    smoothedZoom,
    lastNearestId: nearestId,
    lastNearestDist: nearestDist,
  };
}
