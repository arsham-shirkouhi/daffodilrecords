import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/discogs";
import { getSession } from "@/lib/session";

export async function GET() {
  await connection();
  const session = await getSession();
  session.destroy();
  let appUrl = "http://localhost:3000";
  try {
    appUrl = getAppUrl();
  } catch {
    /* fall back for local misconfig */
  }
  return NextResponse.redirect(new URL("/", appUrl));
}
