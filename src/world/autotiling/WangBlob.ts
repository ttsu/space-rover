/**
 * Wang blob / autotiling helpers for the 8-bit (2-edge 2-corner) variant.
 *
 * The blob sprite sheet layout + mask->(col,row) mapping are defined by
 * `public/assets/wang_blob.png` (7x7 grid). All blob tilesets must use the same
 * 7x7 logical layout.
 */

export type SameTypePredicate = (gx: number, gy: number) => boolean;

// Bit convention (clockwise from North), matching the provided template.
const N_BIT = 1;
const NE_BIT = 2;
const E_BIT = 4;
const SE_BIT = 8;
const S_BIT = 16;
const SW_BIT = 32;
const W_BIT = 64;
const NW_BIT = 128;

/**
 * Compute the 8-bit Wang blob mask for a cell.
 *
 * Diagonals are only set if the corresponding 2 cardinals are set AND the
 * diagonal neighbor is the same type.
 */
export function blobMask8(
  gx: number,
  gy: number,
  isSameType: SameTypePredicate
): number {
  const n = isSameType(gx, gy - 1);
  const e = isSameType(gx + 1, gy);
  const s = isSameType(gx, gy + 1);
  const w = isSameType(gx - 1, gy);

  let mask = 0;
  if (n) mask |= N_BIT;
  if (e) mask |= E_BIT;
  if (s) mask |= S_BIT;
  if (w) mask |= W_BIT;

  if (n && e && isSameType(gx + 1, gy - 1)) mask |= NE_BIT;
  if (e && s && isSameType(gx + 1, gy + 1)) mask |= SE_BIT;
  if (s && w && isSameType(gx - 1, gy + 1)) mask |= SW_BIT;
  if (w && n && isSameType(gx - 1, gy - 1)) mask |= NW_BIT;

  return mask;
}

/**
 * 7x7 template-based mask -> sprite (col,row) mapping.
 *
 * The template is a 7x7 grid where each cell contains the mask value that
 * selects the tile at that (col,row). Some mask values appear multiple
 * times due to symmetry; for those duplicates we deterministically keep the
 * first (row-major) occurrence.
 */
const TEMPLATE_MASKS_7X7: number[][] = [
  // row 0
  [0, 4, 92, 124, 116, 80, 0],
  // row 1
  [16, 20, 87, 223, 241, 21, 64],
  // row 2
  [29, 117, 85, 71, 221, 125, 112],
  // row 3
  [31, 253, 113, 28, 127, 247, 209],
  // row 4
  [23, 199, 213, 95, 255, 245, 81],
  // row 5
  [5, 84, 93, 119, 215, 193, 17],
  // row 6
  [0, 1, 7, 197, 69, 68, 65],
];

const MASK_TO_COLROW: Array<{ col: number; row: number } | null> = Array.from(
  { length: 256 },
  () => null
);

for (let row = 0; row < 7; row++) {
  for (let col = 0; col < 7; col++) {
    const mask = TEMPLATE_MASKS_7X7[row]![col]!;
    if (MASK_TO_COLROW[mask] === null) {
      MASK_TO_COLROW[mask] = { col, row };
    }
  }
}

/**
 * Map a blob mask value to the template sprite sheet coordinates.
 * Falls back to (0,0) for masks not present in the template.
 */
export function mask8ToColRow(mask: number): { col: number; row: number } {
  return MASK_TO_COLROW[mask] ?? { col: 0, row: 0 };
}
