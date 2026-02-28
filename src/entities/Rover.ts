import { Actor, Color, CollisionType, Engine, Keys, SpriteSheet, vec, Shape } from 'excalibur'
import type { ResourceId } from '../resources/ResourceTypes'
import { Resources } from '../resources'
import { getTouchInput, setTouchInput, getTouchControlsEnabled } from '../input/TouchInputState'
import {
  ROVER_SPRITE_COLUMNS,
  ROVER_SPRITE_HEIGHT,
  ROVER_SPRITE_ROWS,
  ROVER_SPRITE_WIDTH,
} from '../config/gameConfig'
import type { RoverStats } from '../upgrades/RoverStats'
import { computeEffectiveRoverStats } from '../upgrades/RoverStats'
import { getAppliedUpgrades } from '../state/Progress'

export type CargoCounts = Record<ResourceId, number>

export type BlasterSpawnFn = (
  x: number,
  y: number,
  angleRad: number,
  damage: number,
  speed: number,
  range: number,
) => void

export class Rover extends Actor {
  maxCapacity: number
  usedCapacity = 0
  cargo: CargoCounts = {
    iron: 0,
    crystal: 0,
    gas: 0,
  }

  health: number

  readonly roverStats: RoverStats

  onDamaged?: (amount: number) => void
  onFireBlaster?: BlasterSpawnFn

  private currentSpeed = 0
  private blasterCooldown = 0
  private isDisabled = false
  private slowFactorThisFrame = 1
  private damageFlashTimer = 0
  private readonly maxForwardSpeed: number
  private readonly maxReverseSpeed: number
  private readonly acceleration: number
  private readonly brakeDeceleration = 600
  private readonly naturalFriction = 200
  private readonly turnSpeed: number

  constructor(x: number, y: number, stats?: RoverStats) {
    super({
      x,
      y,
      width: ROVER_SPRITE_WIDTH,
      height: ROVER_SPRITE_HEIGHT,
      color: Color.fromHex('#f97316'),
    })
    this.body.collisionType = CollisionType.Active
    this.collider.set(Shape.Box(
      ROVER_SPRITE_WIDTH - 4,
      ROVER_SPRITE_HEIGHT - 12))
    this.roverStats = stats ?? computeEffectiveRoverStats(getAppliedUpgrades())
    const s = this.roverStats
    this.maxCapacity = s.maxCapacity
    this.health = s.maxHealth
    this.maxForwardSpeed = s.maxSpeed
    this.maxReverseSpeed = -s.maxSpeed * 0.5
    this.acceleration = s.acceleration
    this.turnSpeed = s.turnSpeed

    const spriteSheet = SpriteSheet.fromImageSource({
      image: Resources.RoverSprite,
      grid: {
        rows: ROVER_SPRITE_ROWS,
        columns: ROVER_SPRITE_COLUMNS,
        spriteWidth: ROVER_SPRITE_WIDTH,
        spriteHeight: ROVER_SPRITE_HEIGHT,
      },
    })
    const sprite = spriteSheet.getSprite(0, 0)
    if (sprite) {
      this.graphics.use(sprite)
    }
  }

  remainingCapacity(): number {
    return this.maxCapacity - this.usedCapacity
  }

  canPick(size: number): boolean {
    return this.usedCapacity + size <= this.maxCapacity
  }

  addResource(id: ResourceId, size: number) {
    this.cargo[id] += size
    this.usedCapacity += size
  }

  takeDamage(amount: number, fromLava = false) {
    if (amount <= 0) return
    let effective = amount - this.roverStats.flatDamageReduction
    if (fromLava) {
      effective -= this.roverStats.lavaDamageReduction
    }
    effective = Math.max(0, Math.ceil(effective))
    if (effective <= 0) return

    this.health = Math.max(0, this.health - effective)
    this.damageFlashTimer = 150

    if (this.onDamaged) {
      this.onDamaged(effective)
    }

    if (this.health <= 0) {
      this.isDisabled = true
    }
  }

  applySlow(factor: number) {
    const effectiveFactor = factor * (1 - this.roverStats.lavaSlowResist)
    if (effectiveFactor < this.slowFactorThisFrame) {
      this.slowFactorThisFrame = effectiveFactor
    }
  }

  getWindResist(): number {
    return this.roverStats.windResist
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (this.isDisabled) {
      this.vel = vec(0, 0)
      return
    }

    const input = engine.input.keyboard
    const dt = delta / 1000

    let turningLeft = input.isHeld(Keys.Left) || input.isHeld(Keys.A)
    let turningRight = input.isHeld(Keys.Right) || input.isHeld(Keys.D)
    let accelerating = input.isHeld(Keys.Up) || input.isHeld(Keys.W)
    let braking = input.isHeld(Keys.Down) || input.isHeld(Keys.S)
    if (getTouchControlsEnabled()) {
      const touch = getTouchInput()
      turningLeft = turningLeft || touch.turnLeft
      turningRight = turningRight || touch.turnRight
      accelerating = accelerating || touch.accelerate
      braking = braking || touch.brake
    }

    if (turningLeft) {
      this.rotation -= this.turnSpeed * dt
    } else if (turningRight) {
      this.rotation += this.turnSpeed * dt
    }

    if (accelerating) {
      this.currentSpeed += this.acceleration * dt
      if (this.currentSpeed < 0) {
        this.currentSpeed += this.brakeDeceleration * dt
      }
    } else if (braking) {
      this.currentSpeed -= this.acceleration * dt
      if (this.currentSpeed > 0) {
        this.currentSpeed -= this.brakeDeceleration * dt
      }
    } else {
      if (this.currentSpeed > 0) {
        this.currentSpeed = Math.max(0, this.currentSpeed - this.naturalFriction * dt)
      } else if (this.currentSpeed < 0) {
        this.currentSpeed = Math.min(0, this.currentSpeed + this.naturalFriction * dt)
      }
    }

    if (this.currentSpeed > this.maxForwardSpeed) {
      this.currentSpeed = this.maxForwardSpeed
    }
    if (this.currentSpeed < this.maxReverseSpeed) {
      this.currentSpeed = this.maxReverseSpeed
    }

    const forward = vec(Math.cos(this.rotation), Math.sin(this.rotation))
    this.vel = forward.scale(this.currentSpeed * this.slowFactorThisFrame)

    if (this.blasterCooldown > 0) {
      this.blasterCooldown -= delta
    }
    let fireKey = input.wasPressed(Keys.Space) || input.wasPressed(Keys.ControlLeft)
    if (getTouchControlsEnabled()) {
      const touch = getTouchInput()
      if (touch.fire) {
        fireKey = true
        setTouchInput({ fire: false })
      }
    }
    if (fireKey && this.blasterCooldown <= 0 && this.onFireBlaster) {
      const msPerShot = 1000 / this.roverStats.blasterFireRate
      this.blasterCooldown = msPerShot
      this.onFireBlaster(
        this.pos.x,
        this.pos.y,
        this.rotation,
        this.roverStats.blasterDamage,
        600,
        this.roverStats.blasterRange,
      )
    }

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta
      this.graphics.opacity = Math.floor(this.damageFlashTimer / 25) % 2 === 0 ? 1 : 0
    } else {
      this.graphics.opacity = 1
    }

    this.slowFactorThisFrame = 1
  }
}
