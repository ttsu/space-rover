import { Color, Engine, Label, Scene, vec, Font, FontUnit, Keys, ScreenElement, Actor } from 'excalibur'
import { Rover } from '../entities/Rover'
import { BlasterProjectile } from '../entities/BlasterProjectile'
import { generatePlanet } from '../world/PlanetGenerator'
import { resetRunTracking, finishRun } from '../state/GameState'
import { Hud } from '../ui/Hud'
import { TouchControls } from '../ui/TouchControls'
import { getTouchControlsEnabled } from '../input/TouchInputState'

export class PlanetScene extends Scene {
  private engineRef: Engine
  private rover!: Rover
  private infoLabel!: Label
  private hud!: Hud
  private returnToShipBtn?: Actor
  private returnToShipLabel?: Label
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

    this.rover.onDamaged = () => {
      this.engineRef.currentScene.camera.shake(4, 4, 200)
    }

    this.rover.onFireBlaster = (x, y, angle, damage, speed, range) => {
      const proj = new BlasterProjectile(x, y, angle, damage, speed, range)
      this.add(proj)
    }

    const planet = generatePlanet(this, this.engineRef, this.rover)
    this.basePos = planet.base.pos.clone()

    this.infoLabel = new Label({
      text: 'W/S A/D drive. Space to fire blaster. Return to base to finish.',
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

    if (getTouchControlsEnabled()) {
      this.add(new TouchControls(this.engineRef))
      const returnContainer = new ScreenElement({ x: 0, y: 0 })
      const cx = this.engineRef.drawWidth / 2
      const by = this.engineRef.drawHeight - 40
      const returnBtn = new Actor({
        pos: vec(cx, by),
        width: 220,
        height: 52,
        color: Color.fromHex('#eab308'),
      })
      returnBtn.anchor.setTo(0.5, 0.5)
      const returnLabel = new Label({
        text: 'Return to ship',
        pos: vec(cx, by),
        color: Color.fromHex('#1c1917'),
        font: new Font({
          family: 'system-ui, sans-serif',
          size: 22,
          unit: FontUnit.Px,
        }),
      })
      returnLabel.anchor.setTo(0.5, 0.5)
      returnBtn.on('pointerup', () => {
        if (this.runEnded) return
        this.runEnded = true
        finishRun(
          this.rover.cargo,
          this.rover.usedCapacity,
          this.rover.maxCapacity,
          this.rover.health,
        )
        this.engineRef.goToScene('summary')
      })
      returnContainer.addChild(returnBtn)
      returnContainer.addChild(returnLabel)
      returnBtn.graphics.visible = false
      returnLabel.graphics.visible = false
      this.returnToShipBtn = returnBtn
      this.returnToShipLabel = returnLabel
      this.add(returnContainer)
    }

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

    if (this.returnToShipBtn && this.returnToShipLabel) {
      const show = !this.runEnded && closeToBase
      this.returnToShipBtn.graphics.visible = show
      this.returnToShipLabel.graphics.visible = show
    }
  }
}



