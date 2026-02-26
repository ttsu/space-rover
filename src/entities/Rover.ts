import { Actor, Color, Engine, Keys, vec } from 'excalibur'
import { ROVER_BASE_HEALTH, ROVER_BASE_SPEED, ROVER_MAX_CAPACITY } from '../config/gameConfig'
import type { ResourceId } from '../resources/ResourceTypes'

export type CargoCounts = Record<ResourceId, number>

export class Rover extends Actor {
  maxCapacity = ROVER_MAX_CAPACITY
  usedCapacity = 0
  cargo: CargoCounts = {
    iron: 0,
    crystal: 0,
    gas: 0,
  }

  health = ROVER_BASE_HEALTH

  private currentSpeed = 0
  private readonly maxForwardSpeed = ROVER_BASE_SPEED
  private readonly maxReverseSpeed = -ROVER_BASE_SPEED * 0.5
  private readonly acceleration = 400 // units per second^2
  private readonly brakeDeceleration = 600
  private readonly naturalFriction = 200
  private readonly turnSpeed = Math.PI // radians per second

  constructor(x: number, y: number) {
    super({
      x,
      y,
      width: 28,
      height: 28,
      color: Color.fromHex('#f97316'),
    })
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

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
  }

  onPreUpdate(engine: Engine, delta: number): void {
    const input = engine.input.keyboard
    const dt = delta / 1000

    const turningLeft = input.isHeld(Keys.Left) || input.isHeld(Keys.A)
    const turningRight = input.isHeld(Keys.Right) || input.isHeld(Keys.D)
    const accelerating = input.isHeld(Keys.Up) || input.isHeld(Keys.W)
    const braking = input.isHeld(Keys.Down) || input.isHeld(Keys.S)

    // Turning (car-style: turn while moving)
    if (turningLeft) {
      this.rotation -= this.turnSpeed * dt
    } else if (turningRight) {
      this.rotation += this.turnSpeed * dt
    }

    // Forward / backward acceleration
    if (accelerating) {
      this.currentSpeed += this.acceleration * dt
      if (this.currentSpeed < 0) {
        // If we were going backwards, braking first
        this.currentSpeed += this.brakeDeceleration * dt
      }
    } else if (braking) {
      this.currentSpeed -= this.acceleration * dt
      if (this.currentSpeed > 0) {
        // If we were going forwards, braking first
        this.currentSpeed -= this.brakeDeceleration * dt
      }
    } else {
      // Natural friction when no input
      if (this.currentSpeed > 0) {
        this.currentSpeed = Math.max(0, this.currentSpeed - this.naturalFriction * dt)
      } else if (this.currentSpeed < 0) {
        this.currentSpeed = Math.min(0, this.currentSpeed + this.naturalFriction * dt)
      }
    }

    // Clamp speeds
    if (this.currentSpeed > this.maxForwardSpeed) {
      this.currentSpeed = this.maxForwardSpeed
    }
    if (this.currentSpeed < this.maxReverseSpeed) {
      this.currentSpeed = this.maxReverseSpeed
    }

    // Apply velocity based on facing direction (rotation)
    const forward = vec(Math.cos(this.rotation), Math.sin(this.rotation))
    this.vel = forward.scale(this.currentSpeed)
  }
}

