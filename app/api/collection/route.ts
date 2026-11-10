import { connection, type NextRequest } from "next/server";
import { json, resolveCollectionViewer, toErrorResponse } from "@/lib/api";
import { cacheGet } from "@/lib/cache";
import { collectionCacheKey, loadCollection } from "@/lib/discogs";
import { DiscogsError } from "@/lib/errors";
import type { CollectionRecord } from "@/lib/types";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await resolveCollectionViewer(request);
    const cacheKey = collectionCacheKey(username, Boolean(token));
    const cached = cacheGet<CollectionRecord[]>(cacheKey);
    if (cached) {
      return json({
        type: "done",
        records: cached,
        total: cached.length,
        username,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          const records = await loadCollection(username, token, (progress) => {
            send({ type: "progress", ...progress, username });
          });
          send({ type: "done", records, total: records.length, username });
          controller.close();
        } catch (error) {
          const message =
            error instanceof DiscogsError ? error.message : "Discogs is not answering right now.";
          const status = error instanceof DiscogsError ? error.status : 500;
          send({ type: "error", message, status });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
