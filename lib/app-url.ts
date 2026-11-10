import type { NextRequest } from "next/server";

function stripSlash(url: string) {
  return url.replace(/\/$/, "");
}

function isLocalHost(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

/** Public site URL for OAuth callbacks and auth redirects. */
export function resolveAppUrl(request?: NextRequest): string {
  // Prefer the live request host — works on every Vercel deploy/preview.
  if (request) {
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    if (host) {
      const origin = `${proto === "http" ? "http" : "https"}://${host}`;
      if (!isLocalHost(origin) || process.env.VERCEL !== "1") {
        return stripSlash(origin);
      }
    }
  }

  const configured = process.env.APP_URL?.trim();
  if (configured) {
    const url = stripSlash(configured);
    // Never honor a localhost APP_URL while running on Vercel.
    if (!(process.env.VERCEL === "1" && isLocalHost(url))) {
      return url;
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return stripSlash(vercel.startsWith("http") ? vercel : `https://${vercel}`);
  }

  return "http://localhost:3000";
}
