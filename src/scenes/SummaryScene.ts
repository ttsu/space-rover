import { Engine, Scene, Label, Color, Font, FontUnit, vec, Actor } from 'excalibur'
import { GameState } from '../state/GameState'

export class SummaryScene extends Scene {
  private engineRef: Engine
  private statsLabel!: Label

  constructor(engine: Engine) {
    super()
    this.engineRef = engine
  }

  onInitialize() {
    const title = new Label({
      text: 'Mission Summary',
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2 - 120),
      color: Color.White,
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 40,
        unit: FontUnit.Px,
      }),
    })
    title.anchor.setTo(0.5, 0.5)

    this.statsLabel = new Label({
      text: '',
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2),
      color: Color.fromHex('#e5e7eb'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 20,
        unit: FontUnit.Px,
      }),
    })
    this.statsLabel.anchor.setTo(0.5, 0.5)

    const button = new Actor({
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2 + 120),
      width: 220,
      height: 60,
      color: Color.fromHex('#3b82f6'),
    })
    button.anchor.setTo(0.5, 0.5)

    const buttonLabel = new Label({
      text: 'Back to Menu',
      pos: button.pos.clone(),
      color: Color.White,
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 24,
        unit: FontUnit.Px,
      }),
    })
    buttonLabel.anchor.setTo(0.5, 0.5)

    button.on('pointerup', () => {
      this.engineRef.goToScene('mainMenu')
    })

    this.add(title)
    this.add(this.statsLabel)
    this.add(button)
    this.add(buttonLabel)
  }

  onActivate(): void {
    const run = GameState.lastRun
    if (!run) {
      this.statsLabel.text = 'No mission data yet.\nExplore a planet first!'
      return
    }

    const totalPieces =
      run.cargo.iron + run.cargo.crystal + run.cargo.gas

    this.statsLabel.text =
      `You collected ${run.cargo.iron} iron, ${run.cargo.crystal} crystal,\n` +
      `and ${run.cargo.gas} gas. That is ${totalPieces} pieces in all.\n` +
      `Capacity used: ${run.usedCapacity}/${run.maxCapacity}.\n` +
      `Best total so far: ${GameState.bestTotalCargo} pieces.`
  }
}


