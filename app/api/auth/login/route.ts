import { connection } from "next/server";
import { NextResponse } from "next/server";
import { fetchRequestToken, getAppUrl } from "@/lib/discogs";
import { DiscogsError } from "@/lib/errors";
import { getSession } from "@/lib/session";
import { unstable_rethrow } from "next/navigation";

export async function GET() {
  await connection();
  const fallback = (() => {
    try {
      return getAppUrl();
    } catch {
      return "http://localhost:3000";
    }
  })();
  try {
    const appUrl = getAppUrl();
    const callback = `${appUrl}/api/auth/callback`;
    const requestToken = await fetchRequestToken(callback);
    const session = await getSession();
    session.requestToken = requestToken.oauth_token;
    session.requestTokenSecret = requestToken.oauth_token_secret;
    await session.save();

    const authorize = new URL("https://www.discogs.com/oauth/authorize");
    authorize.searchParams.set("oauth_token", requestToken.oauth_token);
    return NextResponse.redirect(authorize);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[record-store] OAuth login failed:", error);
    const code = error instanceof DiscogsError && error.kind === "config" ? "config" : "oauth";
    const url = new URL("/", fallback);
    url.searchParams.set("error", code);
    return NextResponse.redirect(url);
  }
}
