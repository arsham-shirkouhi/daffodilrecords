import { DiscogsError } from "@/lib/errors";
import type {
  CollectionField,
  CollectionFolder,
  CollectionRecord,
  DiscogsCollectionRelease,
  DiscogsCollectionResponse,
  DiscogsFormat,
  DiscogsMarketplaceStats,
  DiscogsRelease,
  PriceInfo,
  ReleaseDetail,
  ReleaseImage,
  ReleaseTrack,
  SearchRelease,
  WantRecord,
} from "@/lib/types";

export function stripArtistName(name: string): string {
  return name.replace(/\s\(\d+\)$/, "").trim();
}

export function usableImage(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || /spacer\.gif/i.test(trimmed)) return null;
  return trimmed;
}

export function formatList(formats: DiscogsFormat[] | undefined): string {
  if (!formats?.length) return "";
  const parts: string[] = [];
  for (const format of formats) {
    const descriptions = (format.descriptions ?? []).map((item) => item.trim()).filter(Boolean);
    if (descriptions.length > 0) {
      parts.push(...descriptions);
    } else if (format.name?.trim()) {
      parts.push(format.name.trim());
    }
  }
  return [...new Set(parts)].join(", ");
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function cleanNotes(notes: string): string {
  return notes
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/g, "$2")
    .replace(/\[a=([^\]]+)\]/g, "$1")
    .replace(/\[l=([^\]]+)\]/g, "$1")
    .replace(/\[m=([^\]]+)\]/g, "$1")
    .replace(/\[b\]|\[\/b\]|\[i\]|\[\/i\]/g, "")
    .trim();
}

export function mapCollectionRelease(item: DiscogsCollectionRelease): CollectionRecord | null {
  const info = item.basic_information;
  if (!info || typeof info.id !== "number") return null;

  const artists = (info.artists ?? [])
    .map((artist) => stripArtistName(artist.name ?? ""))
    .filter(Boolean);
  const labels = [
    ...new Set(
      (info.labels ?? [])
        .map((label) => label.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  return {
    id: info.id,
    instance_id: item.instance_id || item.id,
    folder_id: typeof item.folder_id === "number" ? item.folder_id : 1,
    title: info.title?.trim() || "Untitled",
    artists,
    year: typeof info.year === "number" ? info.year : 0,
    labels,
    formats: formatList(info.formats),
    genres: cleanList(info.genres),
    styles: cleanList(info.styles),
    cover_image: usableImage(info.cover_image),
    thumb: usableImage(info.thumb),
    date_added: item.date_added ?? "",
    rating: typeof item.rating === "number" ? item.rating : 0,
    notes: (item.notes ?? []).flatMap((note) => {
      if (typeof note.field_id !== "number") return [];
      return [{ fieldId: note.field_id, value: note.value?.trim() ?? "" }];
    }),
  };
}

export function assertCollection(value: unknown): DiscogsCollectionResponse {
  if (!value || typeof value !== "object") {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  const body = value as Partial<DiscogsCollectionResponse>;
  if (!Array.isArray(body.releases)) {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  return {
    pagination: {
      page: body.pagination?.page ?? 1,
      pages: body.pagination?.pages && body.pagination.pages > 0 ? body.pagination.pages : 1,
      per_page: body.pagination?.per_page ?? body.releases.length,
      items: body.pagination?.items ?? body.releases.length,
    },
    releases: body.releases,
  };
}

function mapTracks(release: DiscogsRelease): ReleaseTrack[] {
  return (release.tracklist ?? []).flatMap((track) => {
    const title = track.title?.trim() ?? "";
    const position = track.position?.trim() ?? "";
    if (!title && !position) return [];
    return [
      {
        position,
        title: title || "Untitled",
        duration: track.duration?.trim() ?? "",
        type: track.type_ === "heading" ? "heading" : "track",
        artists: (track.artists ?? [])
          .map((artist) => stripArtistName(artist.name ?? ""))
          .filter(Boolean),
      },
    ];
  });
}

function mapImages(release: DiscogsRelease, cover: string | null): ReleaseImage[] {
  const images = (release.images ?? []).flatMap((image) => {
    const uri = usableImage(image.uri);
    if (!uri) return [];
    return [
      {
        uri,
        thumb: usableImage(image.uri150) ?? uri,
        type: image.type ?? "secondary",
      },
    ];
  });
  if (images.length === 0 && cover) {
    return [{ uri: cover, thumb: cover, type: "primary" }];
  }
  return images;
}

export function assertRelease(value: unknown): DiscogsRelease {
  if (!value || typeof value !== "object") {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  const body = value as Partial<DiscogsRelease>;
  if (typeof body.id !== "number" || typeof body.title !== "string") {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  return body as DiscogsRelease;
}

export function mapRelease(release: DiscogsRelease): ReleaseDetail {
  const artists = (release.artists ?? [])
    .map((artist) => stripArtistName(artist.name ?? ""))
    .filter(Boolean);
  const cover = usableImage(release.cover_image) ?? usableImage(release.images?.[0]?.uri);
  const notes = release.notes ? cleanNotes(release.notes) : "";

  return {
    id: release.id,
    title: release.title.trim() || "Untitled",
    artists,
    year: typeof release.year === "number" ? release.year : 0,
    country: release.country?.trim() || null,
    notes: notes || null,
    labels: (release.labels ?? [])
      .filter((label) => label.name?.trim())
      .map((label) => ({
        name: label.name.trim(),
        catno: label.catno?.trim() ?? "",
      })),
    formats: formatList(release.formats),
    genres: cleanList(release.genres),
    styles: cleanList(release.styles),
    tracklist: mapTracks(release),
    images: mapImages(release, cover),
    cover_image: cover,
    thumb: usableImage(release.thumb),
    community: {
      have: release.community?.have ?? 0,
      want: release.community?.want ?? 0,
    },
    lowest_price: typeof release.lowest_price === "number" ? release.lowest_price : null,
    num_for_sale: typeof release.num_for_sale === "number" ? release.num_for_sale : null,
    uri: release.uri?.trim() || `https://www.discogs.com/release/${release.id}`,
  };
}

export function mapStats(stats: DiscogsMarketplaceStats): PriceInfo {
  const value = stats.lowest_price?.value;
  return {
    lowest_price: typeof value === "number" ? value : null,
    currency: stats.lowest_price?.currency || "USD",
    num_for_sale: typeof stats.num_for_sale === "number" ? stats.num_for_sale : 0,
  };
}

export function mapFolders(value: unknown): CollectionFolder[] {
  const folders = readArray(value, "folders");
  return folders.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const folder = item as { id?: number; name?: string; count?: number };
    if (typeof folder.id !== "number" || !folder.name?.trim()) return [];
    return [{ id: folder.id, name: folder.name.trim(), count: folder.count ?? 0 }];
  });
}

export function mapFields(value: unknown): CollectionField[] {
  const fields = readArray(value, "fields");
  return fields.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const field = item as { id?: number; name?: string; options?: string[] };
    if (typeof field.id !== "number" || !field.name?.trim()) return [];
    return [{
      id: field.id,
      name: field.name.trim(),
      options: (field.options ?? []).map((option) => option.trim()).filter(Boolean),
    }];
  });
}

export function mapWantsPage(value: unknown): { wants: WantRecord[]; pages: number } {
  if (!value || typeof value !== "object") {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  const body = value as { pagination?: DiscogsCollectionResponse["pagination"]; wants?: unknown[] };
  const wants = (body.wants ?? []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const want = item as {
      id?: number;
      date_added?: string;
      basic_information?: DiscogsCollectionRelease["basic_information"];
    };
    const info = want.basic_information;
    const id = info?.id ?? want.id;
    if (typeof id !== "number") return [];
    const artists = (info?.artists ?? [])
      .map((artist) => stripArtistName(artist.name ?? ""))
      .filter(Boolean);
    return [{
      id,
      title: info?.title?.trim() || "Untitled",
      artists,
      year: typeof info?.year === "number" ? info.year : 0,
      labels: [...new Set((info?.labels ?? []).map((label) => label.name?.trim()).filter((name): name is string => Boolean(name)))],
      formats: formatList(info?.formats),
      cover_image: usableImage(info?.cover_image),
      thumb: usableImage(info?.thumb),
      date_added: want.date_added ?? "",
    }];
  });
  const pages = body.pagination?.pages && body.pagination.pages > 0 ? body.pagination.pages : 1;
  return { wants, pages };
}

export function mapSearch(value: unknown): SearchRelease[] {
  return mapSearchPage(value).results;
}

function splitSearchTitle(rawTitle: string) {
  const split = rawTitle.split(" - ");
  const artist = split.length > 1 ? split[0] ?? "" : "";
  const title = split.length > 1 ? split.slice(1).join(" - ") : rawTitle;
  return { artist, title };
}

function mapSearchRow(item: unknown, accept: "release" | "master"): SearchRelease[] {
  if (!item || typeof item !== "object") return [];
  const row = item as {
    id?: number;
    master_id?: number;
    main_release?: number;
    title?: string;
    year?: string | number;
    country?: string;
    label?: string[];
    catno?: string;
    format?: string[];
    cover_image?: string;
    thumb?: string;
    type?: string;
  };
  if (row.type && row.type !== accept) return [];
  if (typeof row.id !== "number") return [];
  const rawTitle = row.title?.trim() || "Untitled";
  const { artist, title } = splitSearchTitle(rawTitle);
  const year = typeof row.year === "number" ? row.year : Number(row.year) || 0;
  const releaseId =
    accept === "master"
      ? typeof row.main_release === "number" && row.main_release > 0
        ? row.main_release
        : row.id
      : row.id;
  return [
    {
      id: releaseId,
      master_id:
        accept === "master"
          ? row.id
          : typeof row.master_id === "number" && row.master_id > 0
            ? row.master_id
            : null,
      title,
      artist,
      year,
      country: row.country?.trim() || "",
      label: row.label?.[0]?.trim() || "",
      catno: row.catno?.trim() || "",
      format: (row.format ?? []).filter(Boolean).join(", "),
      cover_image: usableImage(row.cover_image) ?? usableImage(row.thumb),
    },
  ];
}

export function mapSearchPage(value: unknown): {
  results: SearchRelease[];
  page: number;
  pages: number;
  items: number;
  perPage: number;
} {
  const results = readArray(value, "results").flatMap((item) => mapSearchRow(item, "release"));

  const body = value as {
    pagination?: { page?: number; pages?: number; items?: number; per_page?: number };
  };
  const page = body.pagination?.page && body.pagination.page > 0 ? body.pagination.page : 1;
  const pages = body.pagination?.pages && body.pagination.pages > 0 ? body.pagination.pages : 1;
  const items = body.pagination?.items ?? results.length;
  const perPage = body.pagination?.per_page ?? results.length;
  return { results, page, pages, items, perPage };
}

export function mapMasterSearchPage(value: unknown): {
  results: SearchRelease[];
  page: number;
  pages: number;
  items: number;
  perPage: number;
} {
  const results = readArray(value, "results").flatMap((item) => mapSearchRow(item, "master"));
  const body = value as {
    pagination?: { page?: number; pages?: number; items?: number; per_page?: number };
  };
  const page = body.pagination?.page && body.pagination.page > 0 ? body.pagination.page : 1;
  const pages = body.pagination?.pages && body.pagination.pages > 0 ? body.pagination.pages : 1;
  const items = body.pagination?.items ?? results.length;
  const perPage = body.pagination?.per_page ?? results.length;
  return { results, page, pages, items, perPage };
}

function readArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== "object") {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  const list = (value as Record<string, unknown>)[key];
  if (!Array.isArray(list)) {
    throw new DiscogsError("Discogs sent back something we could not read.", 502);
  }
  return list;
}
