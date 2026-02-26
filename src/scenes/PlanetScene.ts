import { Color, Engine, Label, Scene, vec, Font, FontUnit, Keys } from 'excalibur'
import { Rover } from '../entities/Rover'
import { generatePlanet } from '../world/PlanetGenerator'
import { resetRunTracking, finishRun } from '../state/GameState'

export class PlanetScene extends Scene {
  private engineRef: Engine
  private rover!: Rover
  private infoLabel!: Label
  private healthLabel!: Label
  private capacityLabel!: Label
  private cargoLabel!: Label
  private nearBaseHintLabel!: Label
  private basePos = vec(0, 0)
  private quakeTimer = 0

  constructor(engine: Engine) {
    super()
    this.engineRef = engine
  }

  onActivate() {
    resetRunTracking()
  }

  onInitialize() {
    this.engineRef.backgroundColor = Color.fromHex('#020617')

    this.rover = new Rover(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2)
    this.add(this.rover)

    const planet = generatePlanet(this, this.engineRef, this.rover)
    this.basePos = planet.base.pos.clone()

    this.infoLabel = new Label({
      text: 'Drive with W/S and A/D. Return to base to finish.',
      pos: vec(16, 24),
      color: Color.White,
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 16,
        unit: FontUnit.Px,
      }),
    })

    this.healthLabel = new Label({
      text: '',
      pos: vec(16, 48),
      color: Color.fromHex('#fca5a5'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 16,
        unit: FontUnit.Px,
      }),
    })

    this.capacityLabel = new Label({
      text: '',
      pos: vec(16, 72),
      color: Color.fromHex('#bbf7d0'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 16,
        unit: FontUnit.Px,
      }),
    })

    this.cargoLabel = new Label({
      text: '',
      pos: vec(16, 96),
      color: Color.fromHex('#e5e7eb'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 16,
        unit: FontUnit.Px,
      }),
    })

    this.nearBaseHintLabel = new Label({
      text: '',
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight - 32),
      color: Color.fromHex('#facc15'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 18,
        unit: FontUnit.Px,
      }),
    })
    this.nearBaseHintLabel.anchor.setTo(0.5, 0.5)

    this.add(this.infoLabel)
    this.add(this.healthLabel)
    this.add(this.capacityLabel)
    this.add(this.cargoLabel)
    this.add(this.nearBaseHintLabel)

    this.camera.strategy.lockToActor(this.rover)
  }

  onPreUpdate(engine: Engine, delta: number): void {
    const distanceToBase = this.rover.pos.distance(this.basePos)
    const closeToBase = distanceToBase < 80

    if (closeToBase) {
      this.nearBaseHintLabel.text = 'Press Enter to return to ship'
      const keyboard = engine.input.keyboard
      if (keyboard.wasPressed(Keys.Enter)) {
        finishRun(
          this.rover.cargo,
          this.rover.usedCapacity,
          this.rover.maxCapacity,
          this.rover.health,
        )
        this.engineRef.goToScene('summary')
      }
    } else {
      this.nearBaseHintLabel.text = ''
    }

    this.quakeTimer += delta
    if (this.quakeTimer > 15000) {
      this.quakeTimer = 0
      this.engineRef.currentScene.camera.shake(5, 5, 500)
    }

    this.healthLabel.text = `Health: ${this.rover.health}`
    this.capacityLabel.text = `Cargo: ${this.rover.usedCapacity}/${this.rover.maxCapacity} (left ${this.rover.remainingCapacity()})`
    this.cargoLabel.text = `Iron: ${this.rover.cargo.iron}  Crystal: ${this.rover.cargo.crystal}  Gas: ${this.rover.cargo.gas}`
  }
}



