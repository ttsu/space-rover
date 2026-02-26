import { Actor, Color, Engine, vec, Font, FontUnit, Label, CollisionType } from 'excalibur'
import type { Rover } from '../entities/Rover'
import { recordHazardHit, type HazardKind } from '../state/GameState'
import { LAVA_SLOW_FACTOR } from '../config/gameConfig'

abstract class HazardBase extends Actor {
  protected rover: Rover
  protected kind: HazardKind

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    rover: Rover,
    kind: HazardKind,
  ) {
    super({ x, y, width, height, color })
    this.rover = rover
    this.kind = kind
  }

  protected hit(amount: number) {
    this.rover.takeDamage(amount)
    recordHazardHit(this.kind)
  }
}

export class LavaPool extends HazardBase {
  private tickTimer = 0

  onPreUpdate(_engine: Engine, delta: number): void {
    const distance = this.pos.distance(this.rover.pos)
    const radius = (this.width + this.rover.width) / 2

    if (distance < radius) {
      this.rover.applySlow(LAVA_SLOW_FACTOR)
      this.tickTimer += delta
      if (this.tickTimer >= 500) {
        this.tickTimer = 0
        this.hit(1)
      }
    } else {
      this.tickTimer = 0
    }
  }
}

export class RockObstacle extends HazardBase {
  onInitialize(): void {
    this.body.collisionType = CollisionType.Fixed
  }
}

export class WindZone extends HazardBase {
  private direction = vec(1, 0)

  constructor(x: number, y: number, width: number, height: number, rover: Rover, directionAngle: number) {
    super(x, y, width, height, Color.fromHex('#0ea5e930'), rover, 'wind')
    this.direction = vec(Math.cos(directionAngle), Math.sin(directionAngle))
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    const distance = this.pos.distance(this.rover.pos)
    if (distance < Math.max(this.width, this.height)) {
      const pushStrength = 80
      this.rover.vel = this.rover.vel.add(this.direction.scale(pushStrength * (delta / 1000)))
    }
  }
}

export class LightningZone extends HazardBase {
  private warningTime = 800
  private strikeTime = 200
  private elapsed = 0
  private hasStruck = false

  constructor(x: number, y: number, rover: Rover) {
    super(x, y, 40, 40, Color.fromHex('#facc15'), rover, 'lightning')
  }

  onPreUpdate(engine: Engine, delta: number): void {
    this.elapsed += delta

    if (!this.hasStruck && this.elapsed >= this.warningTime) {
      this.color = Color.fromHex('#e5e7eb')
      const distance = this.pos.distance(this.rover.pos)
      if (distance < 40) {
        this.hit(1)
      }
      this.showStrikeFlash(engine)
      this.hasStruck = true
    }

    if (this.elapsed >= this.warningTime + this.strikeTime) {
      this.kill()
    }
  }

  private showStrikeFlash(engine: Engine) {
    const flash = new Label({
      text: '⚡',
      pos: this.pos.clone(),
      color: Color.fromHex('#eab308'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 32,
        unit: FontUnit.Px,
      }),
    })
    flash.anchor.setTo(0.5, 0.5)
    engine.currentScene.add(flash)

    let life = 300
    flash.on('preupdate', () => {
      life -= engine.clock.elapsed()
      if (life <= 0) flash.kill()
    })
  }
}

