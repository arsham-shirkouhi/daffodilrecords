import { connection, type NextRequest } from "next/server";
import { json, resolveCollectionViewer, toErrorResponse } from "@/lib/api";
import { recommendFromCollection } from "@/lib/discogs";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await resolveCollectionViewer(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "18");
    const payload = await recommendFromCollection(
      username,
      token,
      Number.isFinite(limit) ? Math.min(24, Math.max(6, limit)) : 18,
    );
    return json({
      results: payload.results,
      seeds: payload.seeds,
      sampleSize: payload.sampleSize,
      username,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
