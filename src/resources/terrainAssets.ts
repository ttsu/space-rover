import { ImageSource } from "excalibur";
import type { BiomeId } from "../config/biomeConfig";
import { BIOME_IDS } from "../config/biomeConfig";

const BASE = `${import.meta.env.BASE_URL}assets/terrain/`;

export type IndestructibleSize = 1 | 2 | 3;

interface TerrainResourceMap {
  ground: Record<BiomeId, ImageSource>;
  destructible: Record<BiomeId, ImageSource>;
  indestructible: Record<BiomeId, Record<IndestructibleSize, ImageSource>>;
  // Blob tilesets (7x7) for autotiling overlay features.
  blobLava: ImageSource;
  blobIce: ImageSource;
  destructibleBlob: Record<BiomeId, ImageSource>;
  indestructibleBlob: Record<BiomeId, ImageSource>;
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

  // 7x7 blob tilesets for overlay features.
  const destructibleBlob: Record<BiomeId, ImageSource> = {} as Record<
    BiomeId,
    ImageSource
  >;
  const indestructibleBlob: Record<BiomeId, ImageSource> = {} as Record<
    BiomeId,
    ImageSource
  >;

  for (const biome of BIOME_IDS) {
    ground[biome] = new ImageSource(`${BASE}ground_${biome}.png`);
    destructible[biome] = new ImageSource(`${BASE}destructible_${biome}.png`);
    indestructible[biome] = {
      1: new ImageSource(`${BASE}indestructible_${biome}_1x1.png`),
      2: new ImageSource(`${BASE}indestructible_${biome}_2x2.png`),
      3: new ImageSource(`${BASE}indestructible_${biome}_3x3.png`),
    };
    destructibleBlob[biome] = new ImageSource(
      `${BASE}destructible_blob_${biome}.png`
    );
    indestructibleBlob[biome] = new ImageSource(
      `${BASE}indestructible_blob_${biome}.png`
    );
  }

  return {
    ground,
    destructible,
    indestructible,
    blobLava: new ImageSource(`${BASE}lava_blob.png`),
    blobIce: new ImageSource(`${BASE}ice_blob.png`),
    destructibleBlob,
    indestructibleBlob,
  };
}

export const TerrainResources = createTerrainResources();

/** All terrain ImageSources for the loader. */
export function getAllTerrainImageSources(): ImageSource[] {
  const out: ImageSource[] = [];
  for (const biome of BIOME_IDS) {
    out.push(TerrainResources.ground[biome]);
    out.push(TerrainResources.destructible[biome]);
    out.push(TerrainResources.destructibleBlob[biome]);
    out.push(
      TerrainResources.indestructible[biome][1],
      TerrainResources.indestructible[biome][2],
      TerrainResources.indestructible[biome][3]
    );
    out.push(TerrainResources.indestructibleBlob[biome]);
  }
  out.push(TerrainResources.blobLava, TerrainResources.blobIce);
  return out;
}
