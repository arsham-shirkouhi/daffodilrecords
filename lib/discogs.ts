import crypto from "node:crypto";
import OAuth from "oauth-1.0a";
import { cacheDelete, cacheGet, cacheSet } from "@/lib/cache";
import { DiscogsError } from "@/lib/errors";
import {
  assertCollection,
  assertRelease,
  mapCollectionRelease,
  mapFields,
  mapFolders,
  mapMasterSearchPage,
  mapRelease,
  mapSearchPage,
  mapStats,
  mapWantsPage,
  usableImage,
} from "@/lib/map";
import { diversifySearchPreview } from "@/lib/search-preview";
import {
  buildTasteProfile,
  pickRecommendQueries,
  releaseOwnedKey,
  type TasteSeed,
} from "@/lib/taste";
import type {
  CollectionField,
  CollectionFolder,
  CollectionProgress,
  CollectionRecord,
  DiscogsIdentity,
  DiscogsMarketplaceStats,
  DiscogsUser,
  OAuthTokenPair,
  PriceInfo,
  ReleaseDetail,
  SearchRelease,
  WantRecord,
} from "@/lib/types";

export interface OAuthToken {
  key: string;
  secret: string;
}

const API = "https://api.discogs.com";
const COLLECTION_TTL = 10 * 60 * 1000;
const RELEASE_TTL = 30 * 60 * 1000;
const STATS_TTL = 15 * 60 * 1000;
const USER_TTL = 60 * 60 * 1000;

let remaining = 60;
let lastRequestAt = 0;
let tail: Promise<void> = Promise.resolve();

const inflightCollections = new Map<string, Promise<CollectionRecord[]>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireConsumer() {
  const key = process.env.DISCOGS_CONSUMER_KEY?.trim();
  const secret = process.env.DISCOGS_CONSUMER_SECRET?.trim();
  if (!key || !secret) {
    throw new DiscogsError(
      "Discogs is not connected yet. Add DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET to .env.local.",
      500,
      "config",
    );
  }
  return { key, secret };
}

export function userAgent(): string {
  return `RecordStoreApp/1.0 +${resolveAppUrl() ?? "http://localhost:3000"}`;
}

/** Prefer APP_URL; on Vercel fall back to the deployment host. */
function resolveAppUrl(): string | null {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return null;
}

export function getAppUrl(): string {
  const url = resolveAppUrl();
  if (!url) {
    throw new DiscogsError(
      "APP_URL is missing. Set it to your site URL (e.g. https://your-app.vercel.app).",
      500,
      "config",
    );
  }
  return url;
}

function oauthClient() {
  const consumer = requireConsumer();
  return new OAuth({
    consumer,
    signature_method: "HMAC-SHA1",
    hash_function(baseString, signingKey) {
      return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
    },
  });
}

function signedHeaders(url: string, method: string, token?: OAuthToken, oauthParams?: Record<string, string>) {
  const oauth = oauthClient();
  const request = {
    url,
    method,
    data: { ...(oauthParams ?? {}) },
  };
  const authorized = oauth.authorize(request, token);
  return oauth.toHeader(authorized);
}

function nextDelay() {
  const since = Date.now() - lastRequestAt;
  let delay = Math.max(0, 200 - since);
  if (remaining <= 10) delay = Math.max(delay, 1100);
  if (remaining <= 3) delay = Math.max(delay, 4000);
  return delay;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function noteRateLimit(response: Response) {
  const header = response.headers.get("x-discogs-ratelimit-remaining");
  if (!header) return;
  const value = Number(header);
  if (Number.isFinite(value)) remaining = value;
}

async function pacedFetch(
  url: string,
  method: string,
  token?: OAuthToken,
  oauthParams?: Record<string, string>,
  body?: unknown,
) {
  return enqueue(async () => {
    const delay = nextDelay();
    if (delay > 0) await sleep(delay);
    lastRequestAt = Date.now();
    const headers = signedHeaders(url, method, token, oauthParams);
    try {
      const response = await fetch(url, {
        method,
        cache: "no-store",
        headers: {
          Authorization: headers.Authorization,
          "User-Agent": userAgent(),
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      noteRateLimit(response);
      return response;
    } catch {
      throw new DiscogsError(
        "Discogs is not answering. The line might be down. Try again in a minute.",
        503,
      );
    }
  });
}

async function discogsFetch(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string>;
    token?: OAuthToken;
    oauthParams?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const method = options.method ?? "GET";
  const url = new URL(path.startsWith("http") ? path : `${API}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }
  const target = url.toString();

  let attempt = 0;
  while (attempt < 5) {
    const response = await pacedFetch(target, method, options.token, options.oauthParams, options.body);
    if (response.status !== 429) return response;
    attempt += 1;
    await response.arrayBuffer().catch(() => undefined);
    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(20_000, 800 * 2 ** attempt);
    await sleep(backoff);
  }

  throw new DiscogsError("Discogs asked us to slow down. Give it a moment and try again.", 429);
}

async function errorMessage(response: Response) {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { message?: string };
    if (json.message) return json.message;
  } catch {
    /* Discogs sometimes replies with plain text. */
  }
  return text.slice(0, 240);
}

function friendlyStatus(status: number, detail: string) {
  if (status === 401) return "Discogs rejected the login. Check the app keys, or sign in again.";
  if (status === 404) return "Those crates are private, or that username is not on Discogs.";
  if (status === 429) return "Discogs asked us to slow down. Give it a moment and try again.";
  if (status >= 500) return "Discogs is having trouble in the back room. Try again shortly.";
  return detail || "Discogs could not complete that request.";
}

async function discogsJson<T>(
  path: string,
  options: {
    query?: Record<string, string>;
    token?: OAuthToken;
  } = {},
): Promise<T> {
  const response = await discogsFetch(path, options);
  if (!response.ok) {
    const detail = await errorMessage(response);
    const kind = response.status === 401 ? "auth" : "request";
    throw new DiscogsError(friendlyStatus(response.status, detail), response.status, kind);
  }
  return (await response.json()) as T;
}

async function discogsSend(
  path: string,
  options: {
    method: "POST" | "PUT" | "DELETE";
    token: OAuthToken;
    body?: unknown;
  },
): Promise<unknown> {
  const response = await discogsFetch(path, options);
  if (!response.ok) {
    const detail = await errorMessage(response);
    const kind = response.status === 401 ? "auth" : "request";
    throw new DiscogsError(friendlyStatus(response.status, detail), response.status, kind);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function parseTokenResponse(text: string): OAuthTokenPair {
  const params = new URLSearchParams(text.trim());
  const oauth_token = params.get("oauth_token");
  const oauth_token_secret = params.get("oauth_token_secret");
  if (!oauth_token || !oauth_token_secret) {
    throw new DiscogsError("Discogs did not return a usable token.", 502, "auth");
  }
  return { oauth_token, oauth_token_secret };
}

export async function fetchRequestToken(callbackUrl: string): Promise<OAuthTokenPair> {
  const response = await discogsFetch(`${API}/oauth/request_token`, {
    method: "POST",
    oauthParams: { oauth_callback: callbackUrl },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new DiscogsError(friendlyStatus(response.status, text.slice(0, 240)), response.status, "auth");
  }
  return parseTokenResponse(text);
}

export async function fetchAccessToken(verifier: string, requestToken: OAuthToken): Promise<OAuthTokenPair> {
  const response = await discogsFetch(`${API}/oauth/access_token`, {
    method: "POST",
    token: requestToken,
    oauthParams: { oauth_verifier: verifier },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new DiscogsError(friendlyStatus(response.status, text.slice(0, 240)), response.status, "auth");
  }
  return parseTokenResponse(text);
}

export async function fetchIdentity(token: OAuthToken): Promise<DiscogsIdentity> {
  const identity = await discogsJson<DiscogsIdentity>("/oauth/identity", { token });
  if (!identity.username) {
    throw new DiscogsError("Discogs did not tell us who signed in.", 502, "auth");
  }
  return identity;
}

export async function fetchUser(username: string, token?: OAuthToken): Promise<DiscogsUser> {
  const key = `user:${username.toLowerCase()}`;
  const cached = cacheGet<DiscogsUser>(key);
  if (cached) return cached;
  const user = await discogsJson<DiscogsUser>(`/users/${encodeURIComponent(username)}`, { token });
  cacheSet(key, user, USER_TTL);
  return user;
}

export function collectionCacheKey(username: string, authed: boolean) {
  return `collection:${authed ? "user" : "app"}:${username.toLowerCase()}`;
}

async function fetchCollectionPage(username: string, page: number, token?: OAuthToken) {
  const json = await discogsJson<unknown>(
    `/users/${encodeURIComponent(username)}/collection/folders/0/releases`,
    {
      token,
      query: {
        per_page: "100",
        page: String(page),
        sort: "added",
        sort_order: "desc",
      },
    },
  );
  return assertCollection(json);
}

async function fetchAllPages(
  username: string,
  token: OAuthToken | undefined,
  onProgress?: (progress: CollectionProgress) => void,
) {
  const records: CollectionRecord[] = [];
  let page = 1;
  let pages = 1;
  let total = 0;

  do {
    const data = await fetchCollectionPage(username, page, token);
    pages = data.pagination.pages;
    total = data.pagination.items;
    if (data.releases.length === 0) {
      onProgress?.({ page, pages, loaded: records.length, total });
      break;
    }
    for (const item of data.releases) {
      const mapped = mapCollectionRelease(item);
      if (mapped) records.push(mapped);
    }
    onProgress?.({ page, pages, loaded: records.length, total });
    page += 1;
  } while (page <= pages && page <= 250);

  return records;
}

export function loadCollection(
  username: string,
  token?: OAuthToken,
  onProgress?: (progress: CollectionProgress) => void,
) {
  const key = collectionCacheKey(username, Boolean(token));
  const cached = cacheGet<CollectionRecord[]>(key);
  if (cached) {
    onProgress?.({
      page: 1,
      pages: 1,
      loaded: cached.length,
      total: cached.length,
    });
    return Promise.resolve(cached);
  }

  const existing = inflightCollections.get(key);
  if (existing) return existing;

  const promise = fetchAllPages(username, token, onProgress)
    .then((records) => {
      cacheSet(key, records, COLLECTION_TTL);
      return records;
    })
    .finally(() => {
      inflightCollections.delete(key);
    });

  inflightCollections.set(key, promise);
  return promise;
}

export async function getRelease(id: number, token?: OAuthToken): Promise<ReleaseDetail> {
  const key = `release:${id}`;
  const cached = cacheGet<ReleaseDetail>(key);
  if (cached) return cached;
  const json = await discogsJson<unknown>(`/releases/${id}`, { token });
  const detail = mapRelease(assertRelease(json));
  cacheSet(key, detail, RELEASE_TTL);
  return detail;
}

export async function getReleaseStats(id: number, token?: OAuthToken): Promise<PriceInfo> {
  const key = `stats:${id}`;
  const cached = cacheGet<PriceInfo>(key);
  if (cached) return cached;
  try {
    const raw = await discogsJson<DiscogsMarketplaceStats>(`/marketplace/stats/${id}`, { token });
    const mapped = mapStats(raw);
    cacheSet(key, mapped, STATS_TTL);
    return mapped;
  } catch (error) {
    if (error instanceof DiscogsError && (error.status === 404 || error.status === 403)) {
      const empty: PriceInfo = { lowest_price: null, currency: "USD", num_for_sale: 0 };
      cacheSet(key, empty, STATS_TTL);
      return empty;
    }
    throw error;
  }
}

export function profileAvatar(user: DiscogsUser): string | null {
  return usableImage(user.avatar_url);
}

export function forgetCollection(username: string) {
  const name = username.toLowerCase();
  cacheDelete(collectionCacheKey(name, true));
  cacheDelete(collectionCacheKey(name, false));
  cacheDelete(wantsCacheKey(name, true));
  cacheDelete(wantsCacheKey(name, false));
  cacheDelete(`folders:${name}`);
  cacheDelete(`fields:${name}`);
}

function wantsCacheKey(username: string, authed: boolean) {
  return `wants:${authed ? "user" : "app"}:${username.toLowerCase()}`;
}

function userPath(username: string) {
  return `/users/${encodeURIComponent(username)}`;
}

export async function loadFolders(username: string, token?: OAuthToken): Promise<CollectionFolder[]> {
  const key = `folders:${username.toLowerCase()}`;
  const cached = cacheGet<CollectionFolder[]>(key);
  if (cached) return cached;
  const json = await discogsJson<unknown>(`${userPath(username)}/collection/folders`, { token });
  const folders = mapFolders(json);
  cacheSet(key, folders, COLLECTION_TTL);
  return folders;
}

export async function loadFields(username: string, token?: OAuthToken): Promise<CollectionField[]> {
  const key = `fields:${username.toLowerCase()}`;
  const cached = cacheGet<CollectionField[]>(key);
  if (cached) return cached;
  const json = await discogsJson<unknown>(`${userPath(username)}/collection/fields`, { token });
  const fields = mapFields(json);
  cacheSet(key, fields, COLLECTION_TTL);
  return fields;
}

export async function loadWants(username: string, token?: OAuthToken): Promise<WantRecord[]> {
  const key = wantsCacheKey(username, Boolean(token));
  const cached = cacheGet<WantRecord[]>(key);
  if (cached) return cached;
  const wants: WantRecord[] = [];
  let page = 1;
  let pages = 1;
  do {
    const json = await discogsJson<unknown>(`${userPath(username)}/wants`, {
      token,
      query: { per_page: "100", page: String(page) },
    });
    const batch = mapWantsPage(json);
    pages = batch.pages;
    wants.push(...batch.wants);
    page += 1;
  } while (page <= pages && page <= 50);
  cacheSet(key, wants, COLLECTION_TTL);
  return wants;
}

export type SearchQuery = {
  q?: string;
  barcode?: string;
  catno?: string;
  artist?: string;
  genre?: string;
  style?: string;
  format?: string;
  type?: "release" | "master";
  sort?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export async function searchReleases(
  token: OAuthToken | undefined,
  query: SearchQuery,
): Promise<SearchRelease[]> {
  const page = await searchReleasesPage(token, query);
  return page.results;
}

export async function searchReleasesPage(token: OAuthToken | undefined, query: SearchQuery) {
  const perPage = Math.min(100, Math.max(1, query.perPage ?? 100));
  const page = Math.max(1, query.page ?? 1);
  const type = query.type ?? "release";
  const params: Record<string, string> = {
    type,
    per_page: String(perPage),
    page: String(page),
  };
  if (query.barcode) params.barcode = query.barcode;
  else if (query.catno) params.catno = query.catno;
  else if (query.q) params.q = query.q;
  if (query.artist) params.artist = query.artist;
  if (query.genre) params.genre = query.genre;
  if (query.style) params.style = query.style;
  if (query.format) params.format = query.format;
  if (query.sort) params.sort = query.sort;
  if (query.sortOrder) params.sort_order = query.sortOrder;
  const json = await discogsJson<unknown>("/database/search", { token, query: params });
  return type === "master" ? mapMasterSearchPage(json) : mapSearchPage(json);
}

type MasterLite = {
  id: number;
  main_release: number | null;
  cover_image: string | null;
};

async function getMasterLite(id: number, token?: OAuthToken): Promise<MasterLite> {
  const key = `master-lite:${id}`;
  const cached = cacheGet<MasterLite>(key);
  if (cached) return cached;
  const json = await discogsJson<{
    id?: number;
    main_release?: number;
    images?: { uri?: string }[];
  }>(`/masters/${id}`, { token });
  const mapped: MasterLite = {
    id: typeof json.id === "number" ? json.id : id,
    main_release: typeof json.main_release === "number" && json.main_release > 0 ? json.main_release : null,
    cover_image: usableImage(json.images?.[0]?.uri),
  };
  cacheSet(key, mapped, RELEASE_TTL);
  return mapped;
}

async function hydratePreviewHit(
  release: SearchRelease,
  token?: OAuthToken,
): Promise<SearchRelease> {
  if (release.master_id) {
    try {
      const master = await getMasterLite(release.master_id, token);
      return {
        ...release,
        id: master.main_release ?? release.id,
        cover_image: release.cover_image ?? master.cover_image,
      };
    } catch {
      /* fall through to release hydrate */
    }
  }

  if (release.cover_image) return release;
  try {
    const detail = await getRelease(release.id, token);
    const cover = usableImage(detail.cover_image) ?? usableImage(detail.images[0]?.uri);
    return cover ? { ...release, cover_image: cover } : release;
  } catch {
    return release;
  }
}

/** Varied album preview — Discogs search omits cover URLs, so we hydrate masters. */
export async function searchReleasesPreview(
  token: OAuthToken | undefined,
  query: { q?: string; barcode?: string },
  limit = 5,
) {
  if (query.barcode) {
    const page = await searchReleasesPage(token, { barcode: query.barcode, page: 1, perPage: 20 });
    const varied = diversifySearchPreview(page.results, limit);
    const results = await Promise.all(varied.map((release) => hydratePreviewHit(release, token)));
    return { ...page, results, perPage: results.length };
  }

  const params: Record<string, string> = {
    type: "master",
    per_page: "12",
    page: "1",
    q: query.q ?? "",
  };
  const json = await discogsJson<unknown>("/database/search", { token, query: params });
  const page = mapMasterSearchPage(json);
  const varied = page.results.slice(0, limit);
  const results = await Promise.all(varied.map((release) => hydratePreviewHit(release, token)));
  return {
    ...page,
    results,
    perPage: results.length,
  };
}

export type RecommendHit = SearchRelease & { reason: string };

const RECOMMEND_TTL = 15 * 60 * 1000;

function seedQuery(seed: TasteSeed): SearchQuery {
  const base: SearchQuery = {
    type: "master",
    format: "Vinyl",
    page: 1,
    perPage: 16,
    sort: seed.kind === "artist" ? "have" : "want",
    sortOrder: "desc",
  };
  if (seed.kind === "artist") return { ...base, artist: seed.value };
  if (seed.kind === "style") return { ...base, style: seed.value };
  return { ...base, genre: seed.value };
}

function seedLabel(seed: TasteSeed) {
  if (seed.kind === "artist") return `More like ${seed.value}`;
  if (seed.kind === "style") return `Into ${seed.value}`;
  return `From your ${seed.value} shelf`;
}

/** Discogs has no listen history — we recommend from collection taste (ratings + genres). */
export async function recommendFromCollection(
  username: string,
  token: OAuthToken | undefined,
  limit = 18,
): Promise<{
  results: RecommendHit[];
  seeds: TasteSeed[];
  sampleSize: number;
}> {
  const cacheKey = `recommend:${Boolean(token) ? "user" : "app"}:${username.toLowerCase()}:${limit}`;
  const cached = cacheGet<{ results: RecommendHit[]; seeds: TasteSeed[]; sampleSize: number }>(cacheKey);
  if (cached) return cached;

  const records = await loadCollection(username, token);
  const profile = buildTasteProfile(records);
  const seeds = pickRecommendQueries(profile);
  if (seeds.length === 0 || records.length === 0) {
    const empty = { results: [] as RecommendHit[], seeds, sampleSize: records.length };
    cacheSet(cacheKey, empty, RECOMMEND_TTL);
    return empty;
  }

  const batches = await Promise.all(
    seeds.map(async (seed) => {
      try {
        const page = await searchReleasesPage(token, seedQuery(seed));
        return page.results.map((release) => ({ ...release, reason: seedLabel(seed) }));
      } catch {
        return [] as RecommendHit[];
      }
    }),
  );

  const picked: RecommendHit[] = [];
  const seenIds = new Set<number>();
  const seenMasters = new Set<number>();
  const seenAlbums = new Set<string>();

  for (const batch of batches) {
    for (const release of batch) {
      if (profile.ownedIds.has(release.id)) continue;
      if (seenIds.has(release.id)) continue;
      if (release.master_id && seenMasters.has(release.master_id)) continue;
      const key = releaseOwnedKey(release.artist, release.title);
      if (key && (profile.ownedKeys.has(key) || seenAlbums.has(key))) continue;

      seenIds.add(release.id);
      if (release.master_id) seenMasters.add(release.master_id);
      if (key) seenAlbums.add(key);
      picked.push(release);
      if (picked.length >= limit) break;
    }
    if (picked.length >= limit) break;
  }

  const hydrated = await Promise.all(
    picked.map(async (release) => {
      const next = await hydratePreviewHit(release, token);
      return { ...next, reason: release.reason };
    }),
  );

  const payload = { results: hydrated, seeds, sampleSize: records.length };
  cacheSet(cacheKey, payload, RECOMMEND_TTL);
  return payload;
}

export async function addToCollection(username: string, token: OAuthToken, releaseId: number, folderId: number) {
  await discogsSend(`${userPath(username)}/collection/folders/${folderId}/releases/${releaseId}`, {
    method: "POST",
    token,
  });
  forgetCollection(username);
}

export async function removeFromCollection(
  username: string,
  token: OAuthToken,
  folderId: number,
  releaseId: number,
  instanceId: number,
) {
  await discogsSend(
    `${userPath(username)}/collection/folders/${folderId}/releases/${releaseId}/instances/${instanceId}`,
    { method: "DELETE", token },
  );
  forgetCollection(username);
}

export async function updateInstance(
  username: string,
  token: OAuthToken,
  folderId: number,
  releaseId: number,
  instanceId: number,
  body: { rating?: number; folder_id?: number },
) {
  await discogsSend(
    `${userPath(username)}/collection/folders/${folderId}/releases/${releaseId}/instances/${instanceId}`,
    { method: "POST", token, body },
  );
  forgetCollection(username);
}

export async function updateInstanceField(
  username: string,
  token: OAuthToken,
  folderId: number,
  releaseId: number,
  instanceId: number,
  fieldId: number,
  value: string,
) {
  await discogsSend(
    `${userPath(username)}/collection/folders/${folderId}/releases/${releaseId}/instances/${instanceId}/fields/${fieldId}`,
    { method: "POST", token, body: { value } },
  );
  forgetCollection(username);
}

export async function createFolder(username: string, token: OAuthToken, name: string) {
  await discogsSend(`${userPath(username)}/collection/folders`, { method: "POST", token, body: { name } });
  forgetCollection(username);
}

export async function renameFolder(username: string, token: OAuthToken, folderId: number, name: string) {
  await discogsSend(`${userPath(username)}/collection/folders/${folderId}`, {
    method: "POST",
    token,
    body: { name },
  });
  forgetCollection(username);
}

export async function deleteFolder(username: string, token: OAuthToken, folderId: number) {
  try {
    await discogsSend(`${userPath(username)}/collection/folders/${folderId}`, { method: "DELETE", token });
  } catch (error) {
    if (error instanceof DiscogsError && error.status !== 401 && error.status !== 429) {
      throw new DiscogsError(
        "That folder still has records in it. Move them somewhere else, then you can delete it.",
        error.status,
      );
    }
    throw error;
  }
  forgetCollection(username);
}

export async function addWant(username: string, token: OAuthToken, releaseId: number) {
  await discogsSend(`${userPath(username)}/wants/${releaseId}`, { method: "PUT", token });
  forgetCollection(username);
}

export async function removeWant(username: string, token: OAuthToken, releaseId: number) {
  await discogsSend(`${userPath(username)}/wants/${releaseId}`, { method: "DELETE", token });
  forgetCollection(username);
}
