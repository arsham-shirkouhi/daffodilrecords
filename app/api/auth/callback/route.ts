import { unstable_rethrow } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchAccessToken, fetchIdentity, getAppUrl } from "@/lib/discogs";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  await connection();
  let appUrl = "http://localhost:3000";
  try {
    appUrl = getAppUrl();
  } catch {
    /* fall back for local misconfig */
  }
  const fail = (code: string) => NextResponse.redirect(new URL(`/?error=${code}`, appUrl));

  try {
    const oauthToken = request.nextUrl.searchParams.get("oauth_token");
    const verifier = request.nextUrl.searchParams.get("oauth_verifier");
    const denied = request.nextUrl.searchParams.has("denied");
    if (denied || !oauthToken || !verifier) return fail("denied");

    const session = await getSession();
    if (!session.requestToken || !session.requestTokenSecret || session.requestToken !== oauthToken) {
      return fail("oauth");
    }

    const access = await fetchAccessToken(verifier, {
      key: session.requestToken,
      secret: session.requestTokenSecret,
    });
    const identity = await fetchIdentity({
      key: access.oauth_token,
      secret: access.oauth_token_secret,
    });
    console.log("[record-store] Discogs identity:", JSON.stringify(identity));

    session.accessToken = access.oauth_token;
    session.accessTokenSecret = access.oauth_token_secret;
    session.username = identity.username;
    session.requestToken = undefined;
    session.requestTokenSecret = undefined;
    await session.save();

    return NextResponse.redirect(new URL("/store", appUrl));
  } catch (error) {
    unstable_rethrow(error);
    console.error("[record-store] OAuth callback failed:", error);
    return fail("oauth");
  }
}
