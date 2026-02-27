import './style.css'
import { Engine, DisplayMode, Color } from 'excalibur'
import { MainMenuScene } from './scenes/MainMenuScene'
import { PlanetScene } from './scenes/PlanetScene'
import { SummaryScene } from './scenes/SummaryScene'
import { UpgradeScene } from './scenes/UpgradeScene'
import { loadProgress } from './state/Progress'

loadProgress()

const canvas = document.querySelector<HTMLCanvasElement>('#game')

if (!canvas) {
  throw new Error('Game canvas with id \"game\" not found')
}

const engine = new Engine({
  canvasElement: canvas,
  width: 800,
  height: 600,
  displayMode: DisplayMode.FitScreen,
  backgroundColor: Color.fromHex('#050816'),
})

engine.add('mainMenu', new MainMenuScene(engine))
engine.add('planet', new PlanetScene(engine))
engine.add('summary', new SummaryScene(engine))
engine.add('upgrade', new UpgradeScene(engine))

engine.goToScene('mainMenu')
engine.start()
