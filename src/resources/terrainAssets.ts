import { ImageSource } from "excalibur";
import type { BiomeId } from "../config/biomeConfig";
import { BIOME_IDS } from "../config/biomeConfig";

const BASE = `${import.meta.env.BASE_URL}assets/terrain/`;

export type IndestructibleSize = 1 | 2 | 3;

interface TerrainResourceMap {
  ground: Record<BiomeId, ImageSource>;
  destructible: Record<BiomeId, ImageSource>;
  indestructible: Record<BiomeId, Record<IndestructibleSize, ImageSource>>;
}

function createTerrainResources(): TerrainResourceMap {
  const ground: Record<BiomeId, ImageSource> = {} as Record<
    BiomeId,
    ImageSource
  >;
  const destructible: Record<BiomeId, ImageSource> = {} as Record<
    BiomeId,
    ImageSource
  >;
  const indestructible: Record<
    BiomeId,
    Record<IndestructibleSize, ImageSource>
  > = {} as Record<BiomeId, Record<IndestructibleSize, ImageSource>>;

  for (const biome of BIOME_IDS) {
    ground[biome] = new ImageSource(`${BASE}ground_${biome}.png`);
    destructible[biome] = new ImageSource(`${BASE}destructible_${biome}.png`);
    indestructible[biome] = {
      1: new ImageSource(`${BASE}indestructible_${biome}_1x1.png`),
      2: new ImageSource(`${BASE}indestructible_${biome}_2x2.png`),
      3: new ImageSource(`${BASE}indestructible_${biome}_3x3.png`),
    };
  }

  return { ground, destructible, indestructible };
}

export const TerrainResources = createTerrainResources();

/** All terrain ImageSources for the loader. */
export function getAllTerrainImageSources(): ImageSource[] {
  const out: ImageSource[] = [];
  for (const biome of BIOME_IDS) {
    out.push(TerrainResources.ground[biome]);
    out.push(TerrainResources.destructible[biome]);
    out.push(
      TerrainResources.indestructible[biome][1],
      TerrainResources.indestructible[biome][2],
      TerrainResources.indestructible[biome][3]
    );
  }
  return out;
}
