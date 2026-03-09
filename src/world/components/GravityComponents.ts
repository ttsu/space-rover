import { Component } from "excalibur";

export class GravitySourceComponent extends Component {
  readonly type = "gravity-source";
  mass: number;
  radiusPx: number;

  constructor(mass: number, radiusPx: number) {
    super();
    this.mass = mass;
    this.radiusPx = radiusPx;
  }
}

export class GravityReceiverComponent extends Component {
  readonly type = "gravity-receiver";
}
