import { connection, type NextRequest } from "next/server";
import { json, optionalToken, toErrorResponse } from "@/lib/api";
import { getReleaseStats } from "@/lib/discogs";
import { DiscogsError } from "@/lib/errors";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await context.params;
    const releaseId = Number(id);
    if (!Number.isInteger(releaseId) || releaseId <= 0) {
      throw new DiscogsError("Unknown record.", 400);
    }
    const token = await optionalToken();
    const stats = await getReleaseStats(releaseId, token);
    return json(stats);
  } catch (error) {
    return toErrorResponse(error);
  }
}
