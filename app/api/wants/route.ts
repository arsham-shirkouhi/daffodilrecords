import { connection, type NextRequest } from "next/server";
import { json, resolveCollectionViewer, toErrorResponse } from "@/lib/api";
import { loadWants } from "@/lib/discogs";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await resolveCollectionViewer(request);
    const wants = await loadWants(username, token);
    return json({ wants });
  } catch (error) {
    return toErrorResponse(error);
  }
}
