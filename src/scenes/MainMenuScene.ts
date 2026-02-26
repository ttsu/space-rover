import { Engine, Scene, Label, Color, Font, FontUnit, Actor, vec } from 'excalibur'

export class MainMenuScene extends Scene {
  private engineRef: Engine

  constructor(engine: Engine) {
    super()
    this.engineRef = engine
  }

  onInitialize() {
    const title = new Label({
      text: 'Starship Rover',
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2 - 80),
      color: Color.White,
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 48,
        unit: FontUnit.Px,
      }),
    })
    title.anchor.setTo(0.5, 0.5)

    const subtitle = new Label({
      text: 'Explore planets, collect resources,\nuse your math power!',
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2),
      color: Color.fromHex('#c1d5ff'),
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 20,
        unit: FontUnit.Px,
      }),
    })
    subtitle.anchor.setTo(0.5, 0.5)

    const button = new Actor({
      pos: vec(this.engineRef.drawWidth / 2, this.engineRef.drawHeight / 2 + 100),
      width: 200,
      height: 60,
      color: Color.fromHex('#3b82f6'),
    })
    button.anchor.setTo(0.5, 0.5)

    const buttonLabel = new Label({
      text: 'Play',
      pos: button.pos.clone(),
      color: Color.White,
      font: new Font({
        family: 'system-ui, sans-serif',
        size: 28,
        unit: FontUnit.Px,
      }),
    })
    buttonLabel.anchor.setTo(0.5, 0.5)

    button.on('pointerup', () => {
      this.engineRef.goToScene('planet')
    })

    this.add(title)
    this.add(subtitle)
    this.add(button)
    this.add(buttonLabel)
  }
}

