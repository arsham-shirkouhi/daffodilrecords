export type CoverTheme = {
  ink: string;
  groove: string;
  paper: string;
  paperDeep: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  glow: string;
};

const inkCache = new Map<string, { ink: string; groove: string }>();
const themeCache = new Map<string, CoverTheme>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toHex(r: number, g: number, b: number) {
  const hex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function mix(channel: number, toward: number, amount: number) {
  return channel + (toward - channel) * amount;
}

function luminance(r: number, g: number, b: number) {
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
}

function hashInk(seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = hash % 360;
  return `hsl(${hue} 22% 16%)`;
}

/** Dark vinyl still tinted with the cover hue (colored pressing). */
export function crushToVinylInk(r: number, g: number, b: number): { ink: string; groove: string } {
  const inkR = clamp(r * 0.48 + 10, 8, 110);
  const inkG = clamp(g * 0.44 + 8, 6, 105);
  const inkB = clamp(b * 0.5 + 12, 8, 115);
  return {
    ink: toHex(inkR, inkG, inkB),
    groove: toHex(inkR * 0.45, inkG * 0.42, inkB * 0.48),
  };
}

export function fallbackVinylInk(seed: string, inkHex?: string): { ink: string; groove: string } {
  if (inkHex?.startsWith("#") && inkHex.length >= 7) {
    const r = Number.parseInt(inkHex.slice(1, 3), 16);
    const g = Number.parseInt(inkHex.slice(3, 5), 16);
    const b = Number.parseInt(inkHex.slice(5, 7), 16);
    if ([r, g, b].every((value) => Number.isFinite(value))) return crushToVinylInk(r, g, b);
  }
  return { ink: hashInk(seed), groove: "#070605" };
}

function themeFromRgb(r: number, g: number, b: number): CoverTheme {
  const ink = crushToVinylInk(r, g, b);
  const luma = luminance(r, g, b);

  const accent = toHex(
    clamp(mix(r, luma > 0.55 ? 25 : 255, luma > 0.55 ? 0.28 : 0.08), 0, 255),
    clamp(mix(g, luma > 0.55 ? 22 : 255, luma > 0.55 ? 0.28 : 0.08), 0, 255),
    clamp(mix(b, luma > 0.55 ? 20 : 255, luma > 0.55 ? 0.28 : 0.08), 0, 255),
  );
  const accentSoft = toHex(mix(r, 255, 0.48), mix(g, 252, 0.45), mix(b, 245, 0.4));
  // Sleeve paper keeps more of the cover cast than a generic cream.
  const paper = toHex(mix(r, 250, 0.58), mix(g, 246, 0.55), mix(b, 238, 0.5));
  const paperDeep = toHex(mix(r, 228, 0.38), mix(g, 220, 0.36), mix(b, 208, 0.32));
  const text =
    luma > 0.58
      ? toHex(mix(r, 16, 0.78), mix(g, 14, 0.8), mix(b, 12, 0.82))
      : toHex(mix(r, 14, 0.48), mix(g, 12, 0.5), mix(b, 12, 0.52));
  const muted = toHex(mix(r, 88, 0.4), mix(g, 80, 0.42), mix(b, 70, 0.44));
  const glow = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.34)`;

  return { ...ink, paper, paperDeep, accent, accentSoft, text, muted, glow };
}

export function fallbackCoverTheme(seed: string, fallbackHex?: string): CoverTheme {
  const ink = fallbackVinylInk(seed, fallbackHex);
  return {
    ...ink,
    paper: "#f6f0e4",
    paperDeep: "#ebe2d2",
    accent: "#9a6410",
    accentSoft: "#f3e6b0",
    text: "#1c1b19",
    muted: "#8a847a",
    glow: "rgba(154, 100, 16, 0.28)",
  };
}

function proxiedCover(art: string) {
  if (art.startsWith("/api/cover-proxy")) return art;
  try {
    const host = new URL(art).hostname;
    if (host.endsWith("discogs.com")) {
      return `/api/cover-proxy?url=${encodeURIComponent(art)}`;
    }
  } catch {
    /* keep original */
  }
  return art;
}

async function readDominant(src: string) {
  const { FastAverageColor } = await import("fast-average-color");
  const fac = new FastAverageColor();
  try {
    const result = await fac.getColorAsync(src, {
      algorithm: "dominant",
      crossOrigin: "anonymous",
      silent: true,
    });
    if (result.error || !result.value) return null;
    return result.value;
  } finally {
    fac.destroy();
  }
}

export async function sampleVinylInk(
  art: string | null | undefined,
  seed: string,
  fallbackHex?: string,
): Promise<{ ink: string; groove: string }> {
  const theme = await sampleCoverTheme(art, seed, fallbackHex);
  return { ink: theme.ink, groove: theme.groove };
}

/** Dominant cover color → colored vinyl, sleeve paper, accents, type. */
export async function sampleCoverTheme(
  art: string | null | undefined,
  seed: string,
  fallbackHex?: string,
): Promise<CoverTheme> {
  const fallback = fallbackCoverTheme(seed, fallbackHex);
  if (!art) return fallback;
  const cached = themeCache.get(art);
  if (cached) return cached;
  if (typeof window === "undefined") return fallback;

  try {
    const proxied = proxiedCover(art);
    const value = (await readDominant(proxied)) ?? (proxied !== art ? await readDominant(art) : null);
    if (!value) {
      themeCache.set(art, fallback);
      return fallback;
    }

    const [r, g, b] = value;
    const theme = themeFromRgb(r, g, b);
    themeCache.set(art, theme);
    inkCache.set(art, { ink: theme.ink, groove: theme.groove });
    return theme;
  } catch {
    themeCache.set(art, fallback);
    return fallback;
  }
}
