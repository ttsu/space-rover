import { System, SystemPriority, SystemType } from "excalibur";
import type { LightningSystem } from "../hazards/LightningSystem";

export class PlanetLightningUpdateSystem extends System {
  static priority = SystemPriority.Lower;
  get systemType(): SystemType {
    return SystemType.Update;
  }

  private lightning: LightningSystem;

  constructor(lightning: LightningSystem) {
    super();
    this.lightning = lightning;
  }

  update(elapsed: number): void {
    this.lightning.update(elapsed);
  }
}
