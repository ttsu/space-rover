import { vec, type Actor } from "excalibur";

export class BlasterTargetRegistry {
  private targets = new Set<Actor>();

  register(actor: Actor): void {
    this.targets.add(actor);
  }

  clear(): void {
    this.targets.clear();
  }

  findNearest(fromX: number, fromY: number): Actor | undefined {
    const from = vec(fromX, fromY);
    let nearest: Actor | undefined;
    let nearestDist = Infinity;
    for (const actor of this.targets) {
      if (actor.isKilled()) continue;
      const d = actor.pos.distance(from);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = actor;
      }
    }
    return nearest;
  }
}
