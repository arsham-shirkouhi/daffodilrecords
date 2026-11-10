import type { CollectionRecord } from "@/lib/types";

export type TasteSeed = {
  kind: "artist" | "style" | "genre";
  value: string;
  score: number;
};

export type TasteProfile = {
  artists: TasteSeed[];
  styles: TasteSeed[];
  genres: TasteSeed[];
  ownedIds: Set<number>;
  ownedKeys: Set<string>;
  sampleSize: number;
};

function weightFor(record: CollectionRecord) {
  if (record.rating >= 4) return record.rating;
  if (record.rating > 0) return record.rating * 0.55;
  return 0.35;
}

function albumKey(artist: string, title: string) {
  return `${artist} ${title}`
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topSeeds(
  scores: Map<string, number>,
  kind: TasteSeed["kind"],
  limit: number,
): TasteSeed[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, score]) => ({ kind, value, score }));
}

/** Score artists / styles / genres from what you already own (favourites weigh more). */
export function buildTasteProfile(records: CollectionRecord[]): TasteProfile {
  const artists = new Map<string, number>();
  const styles = new Map<string, number>();
  const genres = new Map<string, number>();
  const ownedIds = new Set<number>();
  const ownedKeys = new Set<string>();

  for (const record of records) {
    ownedIds.add(record.id);
    const weight = weightFor(record);
    for (const artist of record.artists) {
      const name = artist.trim();
      if (!name) continue;
      artists.set(name, (artists.get(name) ?? 0) + weight);
      ownedKeys.add(albumKey(name, record.title));
    }
    if (record.artists.length === 0) {
      ownedKeys.add(albumKey("", record.title));
    }
    for (const style of record.styles) {
      const name = style.trim();
      if (!name) continue;
      styles.set(name, (styles.get(name) ?? 0) + weight);
    }
    for (const genre of record.genres) {
      const name = genre.trim();
      if (!name) continue;
      genres.set(name, (genres.get(name) ?? 0) + weight);
    }
  }

  return {
    artists: topSeeds(artists, "artist", 4),
    styles: topSeeds(styles, "style", 3),
    genres: topSeeds(genres, "genre", 2),
    ownedIds,
    ownedKeys,
    sampleSize: records.length,
  };
}

export function releaseOwnedKey(artist: string, title: string) {
  return albumKey(artist, title);
}

export function pickRecommendQueries(profile: TasteProfile): TasteSeed[] {
  const picks: TasteSeed[] = [];
  for (const seed of profile.artists.slice(0, 2)) picks.push(seed);
  for (const seed of profile.styles.slice(0, 2)) picks.push(seed);
  if (picks.length < 3) {
    for (const seed of profile.genres) {
      if (picks.length >= 4) break;
      picks.push(seed);
    }
  }
  return picks.slice(0, 4);
}
