import { connection, type NextRequest } from "next/server";
import { json, readId, readJsonBody, requireOwner, toErrorResponse } from "@/lib/api";
import { addToCollection, removeFromCollection, updateInstance } from "@/lib/discogs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const body = await readJsonBody(request);
    const releaseId = readId(body.releaseId, "release");
    const folderId = body.folderId == null ? 1 : readId(body.folderId, "folder");
    if (folderId === 0) {
      return json({ error: "Discogs keeps folder 0 as All. Pick Uncategorized or another folder." }, 400);
    }
    await addToCollection(username, token, releaseId, folderId);
    return json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const body = await readJsonBody(request);
    const releaseId = readId(body.releaseId, "release");
    const instanceId = readId(body.instanceId, "copy");
    const folderId = readId(body.folderId, "folder");
    const payload: { rating?: number; folder_id?: number } = {};
    if (body.rating != null) {
      const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
      if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
        return json({ error: "Ratings go from 1 to 5." }, 400);
      }
      payload.rating = rating;
    }
    if (body.moveTo != null) {
      const moveTo = readId(body.moveTo, "folder");
      if (moveTo === 0) return json({ error: "Pick a real folder. All is not a place to file a record." }, 400);
      payload.folder_id = moveTo;
    }
    if (payload.rating == null && payload.folder_id == null) {
      return json({ error: "Nothing to change on that copy." }, 400);
    }
    await updateInstance(username, token, folderId, releaseId, instanceId, payload);
    return json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const body = await readJsonBody(request);
    await removeFromCollection(
      username,
      token,
      readId(body.folderId, "folder"),
      readId(body.releaseId, "release"),
      readId(body.instanceId, "copy"),
    );
    return json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
