import { CollectionError } from "@/lib/errors";
import { isValidUsername } from "@/lib/username";
import type {
  CollectionField,
  CollectionFolder,
  CollectionProgress,
  CollectionRecord,
  Me,
  PriceInfo,
  ReleaseDetail,
  SearchRelease,
  WantRecord,
} from "@/lib/types";

type ProgressEvent = CollectionProgress & { type: "progress"; username: string };
type DoneEvent = { type: "done"; records: CollectionRecord[]; total: number; username: string };
type ErrorEvent = { type: "error"; message: string; status: number };
type StreamEvent = ProgressEvent | DoneEvent | ErrorEvent;

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new CollectionError(body.error || "The shop could not finish that request.", response.status);
  }
  return body;
}

export async function fetchCollection(
  username: string | null,
  onProgress: (progress: CollectionProgress) => void,
): Promise<{ records: CollectionRecord[]; username: string }> {
  if (username && !isValidUsername(username)) {
    throw new CollectionError("That does not look like a Discogs username.", 400);
  }

  const url = username ? `/api/collection?username=${encodeURIComponent(username)}` : "/api/collection";
  const response = await fetch(url, { cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await readJson<DoneEvent>(response);
    onProgress({
      page: 1,
      pages: 1,
      loaded: body.records.length,
      total: body.total,
    });
    return { records: body.records, username: body.username };
  }

  if (!response.ok || !response.body) {
    throw new CollectionError("The crates could not be brought out.", response.status || 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: { records: CollectionRecord[]; username: string } | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "progress") {
        onProgress(event);
      } else if (event.type === "error") {
        throw new CollectionError(event.message, event.status);
      } else if (event.type === "done") {
        donePayload = { records: event.records, username: event.username };
      }
    }
  }

  if (!donePayload) {
    throw new CollectionError("The collection stream ended early.", 500);
  }
  return donePayload;
}

export async function fetchMe(): Promise<Me | null> {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (response.status === 401) return null;
  return readJson<Me>(response);
}

export async function fetchRelease(id: number): Promise<ReleaseDetail> {
  const response = await fetch(`/api/release/${id}`, { cache: "no-store" });
  return readJson<ReleaseDetail>(response);
}

export async function fetchStats(id: number): Promise<PriceInfo> {
  const response = await fetch(`/api/release/${id}/stats`, { cache: "no-store" });
  return readJson<PriceInfo>(response);
}

export async function fetchPrices(ids: number[], username: string | null): Promise<Record<number, PriceInfo>> {
  if (ids.length === 0) return {};
  const usernameQuery = username ? `&username=${encodeURIComponent(username)}` : "";
  const response = await fetch(`/api/prices?ids=${ids.join(",")}${usernameQuery}`, { cache: "no-store" });
  const body = await readJson<{ prices: Record<string, PriceInfo> }>(response);
  const prices: Record<number, PriceInfo> = {};
  for (const [id, info] of Object.entries(body.prices)) {
    prices[Number(id)] = info;
  }
  return prices;
}

function viewerQuery(username: string | null) {
  return username ? `?username=${encodeURIComponent(username)}` : "";
}

export async function fetchFolders(username: string | null) {
  const response = await fetch(`/api/folders${viewerQuery(username)}`, { cache: "no-store" });
  return readJson<{ folders: CollectionFolder[] }>(response);
}

export async function fetchFields(username: string | null) {
  const response = await fetch(`/api/fields${viewerQuery(username)}`, { cache: "no-store" });
  return readJson<{ fields: CollectionField[] }>(response);
}

export async function fetchWants(username: string | null) {
  const response = await fetch(`/api/wants${viewerQuery(username)}`, { cache: "no-store" });
  return readJson<{ wants: WantRecord[] }>(response);
}

export async function fetchRecommendations(username: string | null, limit = 18) {
  const params = new URLSearchParams();
  if (username) params.set("username", username);
  params.set("limit", String(limit));
  const response = await fetch(`/api/recommend?${params.toString()}`, { cache: "no-store" });
  return readJson<{
    results: (SearchRelease & { reason: string })[];
    seeds: { kind: "artist" | "style" | "genre"; value: string; score: number }[];
    sampleSize: number;
    username: string;
  }>(response);
}

export async function searchCatalog(query: {
  q?: string;
  barcode?: string;
  catno?: string;
  page?: number;
  perPage?: number;
  preview?: boolean;
}) {
  const params = new URLSearchParams();
  if (query.barcode) params.set("barcode", query.barcode);
  else if (query.catno) params.set("catno", query.catno);
  else if (query.q) params.set("q", query.q);
  if (query.preview) params.set("preview", "1");
  if (query.page) params.set("page", String(query.page));
  if (query.perPage) params.set("per_page", String(query.perPage));
  const response = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
  return readJson<{
    results: SearchRelease[];
    page: number;
    pages: number;
    items: number;
    perPage: number;
  }>(response);
}

export async function postJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return readJson<T>(response);
}
