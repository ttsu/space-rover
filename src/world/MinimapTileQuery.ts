import type { Difficulty } from "../state/Saves";
import { type BiomePreset } from "../config/biomeConfig";
import type { WorldState } from "./WorldState";
import { TileContentQuery } from "./TileContentQuery";

export interface TileContentResult {
  resource?: "iron" | "crystal" | "gas";
  hazard?: "lava" | "ice";
}

export interface MinimapTileQueryParams {
  seed: number;
  worldState: WorldState;
  difficulty: Difficulty;
  biomePreset: BiomePreset;
}

/**
 * Deterministic tile-content query for minimap: returns resource and/or hazard
 * for any (gx, gy) without loading chunks. Uses same logic as ChunkManager generation.
 */
export class MinimapTileQuery {
  private readonly tileContentQuery: TileContentQuery;

  constructor(params: MinimapTileQueryParams) {
    this.tileContentQuery = new TileContentQuery({
      seed: params.seed,
      worldState: params.worldState,
      difficulty: params.difficulty,
      biomePreset: params.biomePreset,
    });
  }

  getTileContent(gx: number, gy: number): TileContentResult {
    return this.tileContentQuery.getTileContent(gx, gy);
  }
}
