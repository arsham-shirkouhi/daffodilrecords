import { connection, type NextRequest } from "next/server";
import { json, optionalToken, toErrorResponse } from "@/lib/api";
import { getReleaseStats } from "@/lib/discogs";
import type { PriceInfo } from "@/lib/types";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const ids = (request.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, 12);

    const token = await optionalToken();
    const prices: Record<number, PriceInfo> = {};
    for (const id of ids) {
      try {
        prices[id] = await getReleaseStats(id, token);
      } catch {
        prices[id] = { lowest_price: null, currency: "USD", num_for_sale: 0 };
      }
    }
    return json({ prices });
  } catch (error) {
    return toErrorResponse(error);
  }
}
