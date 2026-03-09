import {
  MotionComponent,
  System,
  SystemPriority,
  SystemType,
  TransformComponent,
  World,
  vec,
} from "excalibur";
import type { Rover } from "../entities/Rover";
import { MagneticResourceComponent } from "../world/components/MagneticResourceComponent";

export class MagnetismSystem extends System {
  static priority = SystemPriority.Higher;
  get systemType(): SystemType {
    return SystemType.Update;
  }

  query;
  private rover: Rover;

  constructor(world: World, rover: Rover) {
    super();
    this.rover = rover;
    this.query = world.query([
      MagneticResourceComponent,
      TransformComponent,
      MotionComponent,
    ]);
  }

  update(elapsed: number): void {
    const magnetism = this.rover.roverStats.magnetism;
    if (magnetism <= 0) return;
    const roverPos = this.rover.pos;
    const attractionSpeed = 80;
    const dtScale = elapsed / 1000;

    for (const entity of this.query.entities) {
      const transform = entity.get(TransformComponent);
      const motion = entity.get(MotionComponent);
      if (!transform || !motion) continue;
      const dist = transform.pos.distance(roverPos);
      if (dist > 0 && dist < magnetism) {
        const toRover = roverPos.sub(transform.pos).normalize();
        motion.vel = toRover.scale(attractionSpeed * dtScale);
      } else {
        motion.vel = vec(0, 0);
      }
    }
  }
}
