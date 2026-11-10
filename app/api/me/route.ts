import { connection } from "next/server";
import { json, optionalToken, toErrorResponse } from "@/lib/api";
import { fetchUser, profileAvatar } from "@/lib/discogs";
import { getSession } from "@/lib/session";

export async function GET() {
  await connection();
  try {
    const session = await getSession();
    if (!session.username || !session.accessToken || !session.accessTokenSecret) {
      return json({ error: "Not signed in." }, 401);
    }

    const token = await optionalToken();
    try {
      const user = await fetchUser(session.username, token);
      return json({
        username: session.username,
        avatar: profileAvatar(user),
        name: user.name?.trim() || session.username,
      });
    } catch {
      return json({
        username: session.username,
        avatar: null,
        name: session.username,
      });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
