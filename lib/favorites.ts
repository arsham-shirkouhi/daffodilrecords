import type { CollectionRecord } from "@/lib/types";

/** Left / back / right — back wall gets more columns, still 3 high. */
export const WALL_CAPS = [9, 15, 9] as const;
export const WALL_COLS = [3, 5, 3] as const;
export const WALL_ROWS = [3, 3, 3] as const;

/** Side-wall architectural features (occupy vinyl slots). */
/** Bump when replacing public/room door/window PNGs so the browser drops the old cache. */
const ROOM_ART_V = "2";

export const WALL_FEATURES = {
  left: {
    kind: "door" as const,
    src: `/room/door.png?v=${ROOM_ART_V}`,
    alt: "Door",
    /** Door column + the full vinyl column beside it (the 3 stacked sleeves). */
    slots: [0, 1, 3, 4, 6, 7],
    gridColumn: 1,
    gridRow: "2 / span 2",
  },
  right: {
    kind: "window" as const,
    src: `/room/window.png?v=${ROOM_ART_V}`,
    alt: "Window",
    /** Window column + the full vinyl column beside it (the 3 stacked sleeves). */
    slots: [1, 2, 4, 5, 7, 8],
    gridColumn: 3,
    gridRow: "2 / span 2",
  },
} as const;

export function reservedSlotsForWall(wallIndex: number): Set<number> {
  if (wallIndex === 0) return new Set(WALL_FEATURES.left.slots);
  if (wallIndex === 2) return new Set(WALL_FEATURES.right.slots);
  return new Set();
}

function addedTime(record: CollectionRecord) {
  const time = Date.parse(record.date_added);
  return Number.isNaN(time) ? 0 : time;
}

/** Prefer high ratings, then fill with the newest so the walls never look empty. */
export function pickFavoriteWalls(records: CollectionRecord[]): (CollectionRecord | null)[][] {
  const loved = records
    .filter((record) => record.rating >= 4)
    .sort((a, b) => b.rating - a.rating || addedTime(b) - addedTime(a));

  const lovedIds = new Set(loved.map((record) => record.instance_id));
  const fillers = [...records]
    .filter((record) => !lovedIds.has(record.instance_id))
    .sort((a, b) => b.rating - a.rating || addedTime(b) - addedTime(a));

  const openSlots = WALL_CAPS.reduce((sum, cap, wallIndex) => {
    return sum + cap - reservedSlotsForWall(wallIndex).size;
  }, 0);
  const pool = [...loved, ...fillers].slice(0, openSlots);

  // Sparse slot arrays — reserved feature slots stay null.
  const walls: (CollectionRecord | null)[][] = [
    Array.from({ length: WALL_CAPS[0] }, () => null),
    Array.from({ length: WALL_CAPS[1] }, () => null),
    Array.from({ length: WALL_CAPS[2] }, () => null),
  ];

  // Fill back wall first so the main wall feels richest, then sides.
  const order = [1, 0, 2];
  let index = 0;
  for (const wallIndex of order) {
    const reserved = reservedSlotsForWall(wallIndex);
    const cap = WALL_CAPS[wallIndex] ?? 0;
    for (let slot = 0; slot < cap && index < pool.length; slot += 1) {
      if (reserved.has(slot)) continue;
      const record = pool[index];
      index += 1;
      if (record) walls[wallIndex]![slot] = record;
    }
  }

  return walls;
}
