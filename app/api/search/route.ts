import { connection, type NextRequest } from "next/server";
import { json, optionalToken, toErrorResponse } from "@/lib/api";
import { searchReleasesPage, searchReleasesPreview } from "@/lib/discogs";
import { DiscogsError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const barcode = request.nextUrl.searchParams.get("barcode")?.trim() ?? "";
    const catno = request.nextUrl.searchParams.get("catno")?.trim() ?? "";
    const preview = request.nextUrl.searchParams.get("preview") === "1";
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const perPage = Number(request.nextUrl.searchParams.get("per_page") ?? "100");
    if (!q && !barcode && !catno) {
      throw new DiscogsError("Type a title, barcode, or catalog number to search.", 400);
    }
    const token = await optionalToken();
    const query = barcode ? { barcode } : catno ? { catno } : { q };
    const payload = preview
      ? await searchReleasesPreview(token, query, 5)
      : await searchReleasesPage(token, {
          ...query,
          page: Number.isFinite(page) ? page : 1,
          perPage: Number.isFinite(perPage) ? perPage : 100,
        });
    return json({
      results: payload.results,
      page: payload.page,
      pages: payload.pages,
      items: payload.items,
      perPage: payload.perPage,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
