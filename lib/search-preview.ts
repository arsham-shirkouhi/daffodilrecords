import type { SearchRelease } from "@/lib/types";

function albumKey(release: SearchRelease): string {
  return `${release.artist} ${release.title}`
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(
      /\b(remaster(?:ed)?|deluxe|expanded|anniversary|edition|reissue|stereo|mono|lp|ep|cd|vinyl|album)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function coverKey(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).pathname.replace(/\/(t\d+|[A-Z])\./, "/").toLowerCase();
  } catch {
    return url.split("?")[0]?.toLowerCase() ?? url;
  }
}

/** Pull a short, visually varied preview from a larger Discogs hit list. */
export function diversifySearchPreview(results: SearchRelease[], limit: number): SearchRelease[] {
  const picked: SearchRelease[] = [];
  const seenMasters = new Set<number>();
  const seenAlbums = new Set<string>();
  const seenCovers = new Set<string>();

  for (const release of results) {
    if (release.master_id) {
      if (seenMasters.has(release.master_id)) continue;
    } else {
      const album = albumKey(release);
      if (album && seenAlbums.has(album)) continue;
    }

    const cover = coverKey(release.cover_image);
    if (cover && seenCovers.has(cover)) continue;

    if (release.master_id) seenMasters.add(release.master_id);
    else {
      const album = albumKey(release);
      if (album) seenAlbums.add(album);
    }
    if (cover) seenCovers.add(cover);

    picked.push(release);
    if (picked.length >= limit) break;
  }

  return picked;
}
