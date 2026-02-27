import { Color, Engine, Scene } from 'excalibur'
import {
  LAVA_DENSITY,
  PLANET_HEIGHT_TILES,
  PLANET_WIDTH_TILES,
  RESOURCE_DENSITY,
  ROCK_DENSITY,
  STORM_ZONE_DENSITY,
  TILE_SIZE,
} from '../config/gameConfig'
import { Tile } from './Tile'
import { BaseLander } from '../entities/BaseLander'
import { RESOURCE_TYPES, type ResourceId } from '../resources/ResourceTypes'
import { ResourceNode } from '../entities/ResourceNode'
import { ResourceDeposit } from '../entities/ResourceDeposit'
import { LavaPool, RockObstacle, WindZone, LightningZone } from '../hazards/Hazards'
import type { Rover } from '../entities/Rover'

export interface PlanetGenerationResult {
  base: BaseLander
}

export function generatePlanet(scene: Scene, _engine: Engine, rover: Rover): PlanetGenerationResult {
  const centerTileX = Math.floor(PLANET_WIDTH_TILES / 2)
  const centerTileY = Math.floor(PLANET_HEIGHT_TILES / 2)

  for (let y = 0; y < PLANET_HEIGHT_TILES; y++) {
    for (let x = 0; x < PLANET_WIDTH_TILES; x++) {
      const isCenter = x === centerTileX && y === centerTileY
      const tile = new Tile(x, y, isCenter ? 'base' : 'ground')
      scene.add(tile)
    }
  }

  const baseX = centerTileX * TILE_SIZE + TILE_SIZE / 2
  const baseY = centerTileY * TILE_SIZE + TILE_SIZE / 2
  const base = new BaseLander(baseX, baseY)
  scene.add(base)

  rover.pos.x = baseX
  rover.pos.y = baseY - TILE_SIZE

  const totalTiles = PLANET_WIDTH_TILES * PLANET_HEIGHT_TILES

  const resourceCount = Math.floor(totalTiles * RESOURCE_DENSITY)
  const lavaCount = Math.floor(totalTiles * LAVA_DENSITY)
  const rockCount = Math.floor(totalTiles * ROCK_DENSITY)
  const stormCount = Math.floor(totalTiles * STORM_ZONE_DENSITY)

  const occupied = new Set<string>()
  occupied.add(`${centerTileX},${centerTileY}`)

  function randomTile(): { x: number; y: number } {
    return {
      x: Math.floor(Math.random() * PLANET_WIDTH_TILES),
      y: Math.floor(Math.random() * PLANET_HEIGHT_TILES),
    }
  }

  function place(count: number, cb: (x: number, y: number) => void) {
    let placed = 0
    let safety = totalTiles * 4
    while (placed < count && safety-- > 0) {
      const { x, y } = randomTile()
      const key = `${x},${y}`
      if (occupied.has(key)) continue
      occupied.add(key)
      cb(x, y)
      placed++
    }
  }

  const resourceIds: ResourceId[] = ['iron', 'crystal', 'gas']
  place(resourceCount, (gridX, gridY) => {
    const resourceId = resourceIds[Math.floor(Math.random() * resourceIds.length)]
    const type = RESOURCE_TYPES.find((r) => r.id === resourceId)!
    const nodeX = gridX * TILE_SIZE + TILE_SIZE / 2
    const nodeY = gridY * TILE_SIZE + TILE_SIZE / 2
    if (resourceId === 'gas') {
      const node = new ResourceNode(nodeX, nodeY, type)
      scene.add(node)
    } else {
      const deposit = new ResourceDeposit(nodeX, nodeY, type, 4)
      scene.add(deposit)
    }
  })

  place(lavaCount, (gridX, gridY) => {
    const x = gridX * TILE_SIZE + TILE_SIZE / 2
    const y = gridY * TILE_SIZE + TILE_SIZE / 2
    const lava = new LavaPool(x, y, TILE_SIZE, TILE_SIZE, Color.fromHex('#b91c1c'), rover, 'lava')
    scene.add(lava)
  })

  place(rockCount, (gridX, gridY) => {
    const x = gridX * TILE_SIZE + TILE_SIZE / 2
    const y = gridY * TILE_SIZE + TILE_SIZE / 2
    const rock = new RockObstacle(x, y, TILE_SIZE, TILE_SIZE, Color.fromHex('#4b5563'), rover, 'rock')
    scene.add(rock)
  })

  place(stormCount, (gridX, gridY) => {
    const x = gridX * TILE_SIZE + TILE_SIZE / 2
    const y = gridY * TILE_SIZE + TILE_SIZE / 2
    const angle = Math.random() * Math.PI * 2
    const wind = new WindZone(
      x,
      y,
      TILE_SIZE * 2,
      TILE_SIZE * 2,
      rover,
      angle,
    )
    scene.add(wind)

    const lightning = new LightningZone(x, y, rover)
    scene.add(lightning)
  })

  return { base }
}

