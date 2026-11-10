import type { CollectionRecord } from "@/lib/types";

export interface SpineColors {
  dominant: string;
  accent: string;
  text: string;
}

export interface SpineLayout {
  width: number;
  heightRatio: number;
  tilt: number;
  lean: number;
}

const colorCache = new Map<string, SpineColors>();
const memoryFallback = new Map<number, SpineColors>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function relativeLuminance(r: number, g: number, b: number) {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toRgb(r: number, g: number, b: number) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function fallbackSpineColors(seed: string): SpineColors {
  const hash = hashSeed(seed);
  const hue = hash % 360;
  const sat = 32 + (hash % 28);
  const light = 28 + ((hash >> 8) % 26);
  const dominant = `hsl(${hue} ${sat}% ${light}%)`;
  const accent = `hsl(${(hue + 28) % 360} ${sat + 8}% ${Math.min(72, light + 18)}%)`;
  const text = light > 48 ? "#1a1714" : "#f7f1e4";
  return { dominant, accent, text };
}

export function colorsFromRgb(r: number, g: number, b: number): SpineColors {
  const luminance = relativeLuminance(r, g, b);
  const darken = luminance > 0.62 ? 0.72 : 1;
  const dominant = toRgb(r * darken, g * darken, b * darken);
  const accent = toRgb(clamp(r + 28, 0, 255), clamp(g + 18, 0, 255), clamp(b + 12, 0, 255));
  const text = luminance > 0.48 ? "#1a1714" : "#f7f1e4";
  return { dominant, accent, text };
}

export function getCachedSpineColors(record: CollectionRecord): SpineColors {
  const cover = record.cover_image ?? record.thumb;
  if (cover && colorCache.has(cover)) return colorCache.get(cover)!;
  if (memoryFallback.has(record.id)) return memoryFallback.get(record.id)!;
  const fallback = fallbackSpineColors(`${record.artists[0] ?? ""}:${record.title}:${record.id}`);
  memoryFallback.set(record.id, fallback);
  return fallback;
}

export function cacheSpineColors(url: string, colors: SpineColors) {
  colorCache.set(url, colors);
}

export async function extractSpineColors(url: string): Promise<SpineColors | null> {
  if (colorCache.has(url)) return colorCache.get(url)!;
  if (typeof window === "undefined") return null;
  try {
    const { FastAverageColor } = await import("fast-average-color");
    const fac = new FastAverageColor();
    const result = await fac.getColorAsync(url, {
      algorithm: "dominant",
      crossOrigin: "anonymous",
      silent: true,
    });
    fac.destroy();
    if (result.error || !result.value) return null;
    const [r, g, b] = result.value;
    const colors = colorsFromRgb(r, g, b);
    colorCache.set(url, colors);
    return colors;
  } catch {
    return null;
  }
}

export function spineThickness(formats: string): number {
  const lower = formats.toLowerCase();
  let width = 15;
  if (/\bbox\b|box set|deluxe|anniversary/.test(lower)) width = 22;
  else if (/2xlp|2xlp|double|gatefold|2\s*lp|3\s*lp|4\s*lp/.test(lower)) width = 19;
  else if (/3xlp|triple/.test(lower)) width = 21;
  else if (/7"|7 inch/.test(lower)) width = 12;
  else if (/10"|10 inch/.test(lower)) width = 14;
  else if (/12"|lp|vinyl/.test(lower)) width = 16;
  const qty = lower.match(/(\d+)\s*x/);
  if (qty?.[1]) width = clamp(12 + Number(qty[1]) * 3, 12, 24);
  return width;
}

export function spineHeightRatio(formats: string): number {
  const lower = formats.toLowerCase();
  if (/7"|7 inch/.test(lower)) return 0.72;
  if (/10"|10 inch/.test(lower)) return 0.86;
  return 1;
}

export function spineLayout(record: CollectionRecord): SpineLayout {
  const hash = hashSeed(`${record.instance_id}:${record.id}`);
  const tilt = ((hash % 11) - 5) * 0.1;
  const lean = hash % 17 === 0 ? ((hash % 2) * 2 - 1) * 1.4 : 0;
  return {
    width: spineThickness(record.formats),
    heightRatio: spineHeightRatio(record.formats),
    tilt,
    lean,
  };
}

export function catalogHint(record: CollectionRecord): string {
  const label = record.labels[0]?.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
  const year = record.year ? String(record.year).slice(-2) : "";
  const id = String(record.id).slice(-4);
  return [label, year, id].filter(Boolean).join("·") || id;
}

export function packShelfRows(records: CollectionRecord[], rowWidth: number, baseWidth = 15) {
  const rows: CollectionRecord[][] = [];
  let current: CollectionRecord[] = [];
  let used = 0;
  for (const record of records) {
    const width = spineThickness(record.formats) || baseWidth;
    if (current.length > 0 && used + width > rowWidth) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(record);
    used += width;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

export function collectionPriceStats(prices: Record<number, { lowest_price: number | null }>) {
  const values = Object.values(prices)
    .map((price) => price.lowest_price)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) {
    return { lowest: null, average: null, highest: null, sum: null, counted: 0 };
  }
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const sum = values.reduce((total, value) => total + value, 0);
  const average = sum / values.length;
  return { lowest, average, highest, sum, counted: values.length };
}
