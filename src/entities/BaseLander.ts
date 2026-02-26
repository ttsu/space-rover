import { Actor, Color } from 'excalibur'

export class BaseLander extends Actor {
  constructor(x: number, y: number) {
    super({
      x,
      y,
      width: 64,
      height: 64,
      color: Color.fromHex('#22d3ee'),
    })
  }
}

