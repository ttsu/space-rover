import {
  MotionComponent,
  System,
  SystemPriority,
  SystemType,
  TransformComponent,
  World,
  vec,
} from "excalibur";
import { MagneticResourceComponent } from "../world/components/MagneticResourceComponent";
import {
  MagnetismSourceComponent,
  PlayerTagComponent,
} from "../world/components/PlayerComponents";

export class MagnetismSystem extends System {
  static priority = SystemPriority.Higher;
  get systemType(): SystemType {
    return SystemType.Update;
  }

  query;
  private playerQuery;

  constructor(world: World) {
    super();
    this.query = world.query([
      MagneticResourceComponent,
      TransformComponent,
      MotionComponent,
    ]);
    this.playerQuery = world.query([
      PlayerTagComponent,
      MagnetismSourceComponent,
      TransformComponent,
    ]);
  }

  update(_elapsed: number): void {
    const playerEntity = this.playerQuery.entities[0];
    if (!playerEntity) return;
    const playerTransform = playerEntity.get(TransformComponent);
    const magnetismSource = playerEntity.get(MagnetismSourceComponent);
    if (!playerTransform || !magnetismSource) return;
    const magnetism = magnetismSource.radiusPx;
    if (magnetism <= 0) return;
    const roverPos = playerTransform.pos;
    // Motion velocity is in px/s; keep this high so pull-in feels snappy.
    const attractionSpeed = 280 + magnetism * 1.2;

    for (const entity of this.query.entities) {
      const transform = entity.get(TransformComponent);
      const motion = entity.get(MotionComponent);
      if (!transform || !motion) continue;
      const dist = transform.pos.distance(roverPos);
      if (dist > 0 && dist < magnetism) {
        const toRover = roverPos.sub(transform.pos).normalize();
        motion.vel = toRover.scale(attractionSpeed);
      } else {
        motion.vel = vec(0, 0);
      }
    }
  }
}
