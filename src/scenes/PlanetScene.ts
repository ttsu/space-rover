import { Color, Engine, Label, Scene, vec, Font, FontUnit, Keys } from 'excalibur'
import { Rover } from '../entities/Rover'
import { generatePlanet } from '../world/PlanetGenerator'
import { resetRunTracking, finishRun } from '../state/GameState'
import { Hud } from '../ui/Hud'

export class PlanetScene extends Scene {
  private engineRef: Engine
  private rover!: Rover
  private infoLabel!: Label
  private hud!: Hud
  private basePos = vec(0, 0)
  private quakeTimer = 0
  private runEnded = false

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

    this.add(this.infoLabel)

    this.hud = new Hud(this.engineRef, this.rover)
    this.add(this.hud)

    this.camera.strategy.lockToActor(this.rover)
  }

  onPreUpdate(engine: Engine, delta: number): void {
    if (!this.runEnded && this.rover.health <= 0) {
      this.runEnded = true
      finishRun(
        this.rover.cargo,
        this.rover.usedCapacity,
        this.rover.maxCapacity,
        this.rover.health,
      )
      this.engineRef.goToScene('summary')
      return
    }

    const distanceToBase = this.rover.pos.distance(this.basePos)
    const closeToBase = distanceToBase < 80

    if (!this.runEnded && closeToBase) {
      const keyboard = engine.input.keyboard
      if (keyboard.wasPressed(Keys.Enter)) {
        this.runEnded = true
        finishRun(
          this.rover.cargo,
          this.rover.usedCapacity,
          this.rover.maxCapacity,
          this.rover.health,
        )
        this.engineRef.goToScene('summary')
      }
    }

    this.quakeTimer += delta
    if (this.quakeTimer > 15000) {
      this.quakeTimer = 0
      this.engineRef.currentScene.camera.shake(5, 5, 500)
    }

    this.hud.updateFromState(closeToBase)
  }
}



