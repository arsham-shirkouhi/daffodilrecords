import { connection, type NextRequest } from "next/server";
import { json, readId, requireOwner, toErrorResponse } from "@/lib/api";
import { addWant, loadWants, removeWant } from "@/lib/discogs";

export async function PUT(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const { id } = await context.params;
    await addWant(username, token, readId(id, "release"));
    const wants = await loadWants(username, token);
    return json({ wants });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { username, token } = await requireOwner();
    const { id } = await context.params;
    await removeWant(username, token, readId(id, "release"));
    const wants = await loadWants(username, token);
    return json({ wants });
  } catch (error) {
    return toErrorResponse(error);
  }
}
