import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { DiscogsError } from "@/lib/errors";
import { getSession } from "@/lib/session";
import type { OAuthToken } from "@/lib/discogs";
import { assertUsername } from "@/lib/username";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function toErrorResponse(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof DiscogsError) {
    if (error.status >= 500) console.error("[record-store]", error);
    return json({ error: error.message }, error.status);
  }
  console.error("[record-store]", error);
  return json({ error: "The back room is dark. Discogs is not answering." }, 500);
}

export async function optionalToken(): Promise<OAuthToken | undefined> {
  const session = await getSession();
  if (session.accessToken && session.accessTokenSecret) {
    return { key: session.accessToken, secret: session.accessTokenSecret };
  }
  return undefined;
}

export async function resolveCollectionViewer(request: NextRequest) {
  const session = await getSession();
  const token =
    session.accessToken && session.accessTokenSecret
      ? ({ key: session.accessToken, secret: session.accessTokenSecret } satisfies OAuthToken)
      : undefined;

  const requested = request.nextUrl.searchParams.get("username")?.trim();
  if (requested) {
    const username = assertUsername(requested);
    // Keep owner auth when ?username= is your own account (private collection / recs).
    if (token && session.username?.toLowerCase() === username.toLowerCase()) {
      return { username, token };
    }
    return { username, token: undefined };
  }

  if (!session.username || !token) {
    throw new DiscogsError("Your session expired. The shop door locked itself.", 401, "auth");
  }

  return {
    username: session.username,
    token,
  };
}

export async function requireOwner() {
  const session = await getSession();
  if (!session.username || !session.accessToken || !session.accessTokenSecret) {
    throw new DiscogsError("Your session expired. The shop door locked itself.", 401, "auth");
  }
  return {
    username: session.username,
    token: { key: session.accessToken, secret: session.accessTokenSecret } as OAuthToken,
  };
}

export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function readId(value: unknown, label: string): number {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DiscogsError(`Choose a valid ${label}.`, 400);
  }
  return id;
}
