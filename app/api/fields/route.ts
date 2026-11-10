import { connection, type NextRequest } from "next/server";
import { json, resolveCollectionViewer, toErrorResponse } from "@/lib/api";
import { loadFields } from "@/lib/discogs";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await resolveCollectionViewer(request);
    const fields = await loadFields(username, token);
    return json({ fields });
  } catch (error) {
    return toErrorResponse(error);
  }
}
