import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { DiscogsError } from "@/lib/errors";

export interface SessionData {
  requestToken?: string;
  requestTokenSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  username?: string;
}

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET ?? "";
  if (password.length < 32) {
    throw new DiscogsError(
      "SESSION_SECRET must be at least 32 characters in .env.local.",
      500,
      "config",
    );
  }

  return {
    cookieName: "record-store",
    password,
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
