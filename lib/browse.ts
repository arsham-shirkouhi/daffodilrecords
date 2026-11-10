import type { CollectionRecord, PriceInfo } from "@/lib/types";

export type SortKey = "artist" | "added" | "year" | "price" | "rating";
export type ShopView = "crates" | "wall" | "shelves";

export interface BrowseFilters {
  query: string;
  genre: string;
  style: string;
  decade: string;
  format: string;
  folder: string;
  sort: SortKey;
}

export const defaultFilters: BrowseFilters = {
  query: "",
  genre: "all",
  style: "all",
  decade: "all",
  format: "all",
  folder: "all",
  sort: "artist",
};

const FORMAT_PRIORITY = [
  "LP",
  '12"',
  '7"',
  '10"',
  "CD",
  "Cassette",
  "8-Track",
  "Flexi-disc",
  "Shellac",
  "Lathe Cut",
  "Vinyl",
];

export function artistLine(artists: string[]): string {
  if (artists.length === 0) return "Unknown artist";
  if (artists.length === 1) return artists[0] ?? "Unknown artist";
  if (artists.length === 2) return `${artists[0]} & ${artists[1]}`;
  return `${artists.slice(0, -1).join(", ")} & ${artists[artists.length - 1]}`;
}

export function recordLabel(record: Pick<CollectionRecord, "artists" | "title">): string {
  return `${artistLine(record.artists)} – ${record.title}`;
}

export function sortArtist(name: string): string {
  return name.replace(/^the\s+/i, "").trim();
}

export function decadeLabel(year: number): string {
  if (!year) return "Unknown";
  return `${Math.floor(year / 10) * 10}s`;
}

export function primaryFormat(formats: string): string {
  const tokens = formats
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const found = FORMAT_PRIORITY.find((key) =>
    tokens.some((token) => token.toLowerCase() === key.toLowerCase()),
  );
  return found ?? tokens[0] ?? "Other";
}

export function shelfLetter(artist: string): string {
  const first = sortArtist(artist)[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(first) ? first : "#";
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function sleeveGradient(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const yellow = 42 + (hash % 16);
  const green = 96 + ((hash >> 4) % 36);
  return `linear-gradient(155deg, hsl(${yellow} 88% 74%), hsl(${green} 38% 62%))`;
}

function addedTime(record: CollectionRecord): number {
  const time = Date.parse(record.date_added);
  return Number.isNaN(time) ? 0 : time;
}

function compareRecords(
  a: CollectionRecord,
  b: CollectionRecord,
  sort: SortKey,
  prices: Record<number, PriceInfo>,
): number {
  if (sort === "artist") {
    const artist = sortArtist(a.artists[0] ?? "").localeCompare(sortArtist(b.artists[0] ?? ""), undefined, {
      sensitivity: "base",
    });
    if (artist !== 0) return artist;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  }
  if (sort === "year") {
    return (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title);
  }
  if (sort === "price") {
    const left = prices[a.id]?.lowest_price;
    const right = prices[b.id]?.lowest_price;
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return left - right;
  }
  if (sort === "rating") {
    return (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title);
  }
  return addedTime(b) - addedTime(a);
}

export function filterRecords(
  records: CollectionRecord[],
  filters: BrowseFilters,
  prices: Record<number, PriceInfo>,
): CollectionRecord[] {
  const query = filters.query.trim().toLowerCase();
  const matched = records.filter((record) => {
    if (filters.genre !== "all") {
      if (filters.genre === "Unsorted") {
        if (record.genres.length > 0) return false;
      } else if (!record.genres.includes(filters.genre)) {
        return false;
      }
    }
    if (filters.style !== "all" && !record.styles.includes(filters.style)) return false;
    if (filters.decade !== "all" && decadeLabel(record.year) !== filters.decade) return false;
    if (filters.format !== "all" && primaryFormat(record.formats) !== filters.format) return false;
    if (filters.folder !== "all" && String(record.folder_id) !== filters.folder) return false;
    if (!query) return true;
    const haystack = [record.title, ...record.artists, ...record.labels].join(" ").toLowerCase();
    return haystack.includes(query);
  });
  return [...matched].sort((a, b) => compareRecords(a, b, filters.sort, prices));
}

export function groupCrates(records: CollectionRecord[], genre: string) {
  const groups = new Map<string, CollectionRecord[]>();
  for (const record of records) {
    const key = genre !== "all" ? genre : record.genres[0] || "Unsorted";
    const list = groups.get(key);
    if (list) list.push(record);
    else groups.set(key, [record]);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({ genre: name, records: items }))
    .sort((a, b) => {
      if (a.genre === "Unsorted") return 1;
      if (b.genre === "Unsorted") return -1;
      return b.records.length - a.records.length || a.genre.localeCompare(b.genre);
    });
}

export function groupShelves(records: CollectionRecord[]) {
  const sorted = [...records].sort((a, b) => {
    const artist = sortArtist(a.artists[0] ?? "").localeCompare(sortArtist(b.artists[0] ?? ""), undefined, {
      sensitivity: "base",
    });
    if (artist !== 0) return artist;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
  const groups = new Map<string, CollectionRecord[]>();
  for (const record of sorted) {
    const letter = shelfLetter(record.artists[0] ?? "");
    const list = groups.get(letter);
    if (list) list.push(record);
    else groups.set(letter, [record]);
  }
  return [...groups.entries()]
    .map(([letter, items]) => ({ letter, records: items }))
    .sort((a, b) => {
      if (a.letter === "#") return 1;
      if (b.letter === "#") return -1;
      return a.letter.localeCompare(b.letter);
    });
}

export function formatMoney(value: number | null, currency = "USD"): string | null {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function filtersActive(filters: BrowseFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.genre !== "all" ||
    filters.style !== "all" ||
    filters.decade !== "all" ||
    filters.format !== "all" ||
    filters.folder !== "all"
  );
}
