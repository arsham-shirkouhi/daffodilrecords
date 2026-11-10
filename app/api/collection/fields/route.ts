import { connection, type NextRequest } from "next/server";
import { json, readId, readJsonBody, requireOwner, toErrorResponse } from "@/lib/api";
import { updateInstanceField } from "@/lib/discogs";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const body = await readJsonBody(request);
    const value = typeof body.value === "string" ? body.value : "";
    await updateInstanceField(
      username,
      token,
      readId(body.folderId, "folder"),
      readId(body.releaseId, "release"),
      readId(body.instanceId, "copy"),
      readId(body.fieldId, "field"),
      value,
    );
    return json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
