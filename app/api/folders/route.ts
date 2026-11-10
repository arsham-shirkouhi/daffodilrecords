import { connection, type NextRequest } from "next/server";
import { json, readJsonBody, requireOwner, resolveCollectionViewer, toErrorResponse } from "@/lib/api";
import { createFolder, loadFolders } from "@/lib/discogs";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await resolveCollectionViewer(request);
    const folders = await loadFolders(username, token);
    return json({ folders });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const body = await readJsonBody(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return json({ error: "Give the folder a name." }, 400);
    await createFolder(username, token, name);
    const folders = await loadFolders(username, token);
    return json({ folders });
  } catch (error) {
    return toErrorResponse(error);
  }
}
