import type { IHazardTarget } from "../entities/contracts";

/**
 * Registry for active hazard targets in a scene.
 * Allows systems/generators to resolve targets without hard-coding rover references.
 */
export class HazardTargetRegistry {
  private targets = new Set<IHazardTarget>();

  register(target: IHazardTarget): void {
    this.targets.add(target);
  }

  unregister(target: IHazardTarget): void {
    this.targets.delete(target);
  }

  getPrimary(): IHazardTarget | null {
    const first = this.targets.values().next();
    return first.done ? null : first.value;
  }
}
