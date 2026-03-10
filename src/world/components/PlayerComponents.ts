import { Component, vec, type Vector } from "excalibur";

export class PlayerTagComponent extends Component {
  readonly type = "player-tag";
}

export class FogViewerComponent extends Component {
  readonly type = "fog-viewer";
  baseRadiusTiles: number;
  multiplier: number;

  constructor(baseRadiusTiles: number, multiplier = 1) {
    super();
    this.baseRadiusTiles = baseRadiusTiles;
    this.multiplier = multiplier;
  }
}

export class MagnetismSourceComponent extends Component {
  readonly type = "magnetism-source";
  radiusPx: number;

  constructor(radiusPx: number) {
    super();
    this.radiusPx = radiusPx;
  }
}

export class WindReceiverComponent extends Component {
  readonly type = "wind-receiver";
  resistance: number;
  velocityDelta: Vector = vec(0, 0);

  constructor(resistance: number) {
    super();
    this.resistance = resistance;
  }
}
