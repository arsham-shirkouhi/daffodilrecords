import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  await connection();
  const session = await getSession();
  session.destroy();
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return NextResponse.redirect(new URL("/", appUrl));
}
