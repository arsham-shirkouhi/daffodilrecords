import { connection, type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAppUrl } from "@/lib/app-url";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  await connection();
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", resolveAppUrl(request)));
}
