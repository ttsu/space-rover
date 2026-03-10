import type { Actor } from "excalibur";
import type { DamageType } from "../types/DamageTypes";
import type { ResourceId } from "../resources/ResourceTypes";

export interface IHazardTarget {
  takeDamage(amount: number, damageType?: DamageType): void;
  applySlow(factor: number): void;
  getWindResist(): number;
  getActor(): Actor;
}

export interface IResourceCollector {
  canPick(id: ResourceId, size: number): boolean;
  addResource(id: ResourceId, size: number): void;
  remainingCapacity(): number;
}
