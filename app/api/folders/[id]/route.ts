import { connection, type NextRequest } from "next/server";
import { json, readId, readJsonBody, requireOwner, toErrorResponse } from "@/lib/api";
import { deleteFolder, loadFolders, renameFolder } from "@/lib/discogs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const { id } = await context.params;
    const folderId = readId(id, "folder");
    const body = await readJsonBody(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return json({ error: "Give the folder a name." }, 400);
    await renameFolder(username, token, folderId, name);
    const folders = await loadFolders(username, token);
    return json({ folders });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const { id } = await context.params;
    const folderId = readId(id, "folder");
    if (folderId === 1) {
      return json({ error: "Uncategorized is Discogs' own folder. It stays." }, 400);
    }
    await deleteFolder(username, token, folderId);
    const folders = await loadFolders(username, token);
    return json({ folders });
  } catch (error) {
    return toErrorResponse(error);
  }
}
