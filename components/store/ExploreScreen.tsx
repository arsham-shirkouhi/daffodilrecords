"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoverImage } from "@/components/store/Sleeve";
import { PhoneTabBar } from "@/components/store/PhoneTabBar";
import { RecordModal } from "@/components/store/RecordModal";
import { useMe } from "@/components/store/use-shop-data";
import { fetchRecommendations, searchCatalog } from "@/lib/client-api";
import { CollectionError } from "@/lib/errors";
import type { CollectionRecord, SearchRelease } from "@/lib/types";

type RecommendHit = SearchRelease & { reason: string };
type TasteSeed = { kind: "artist" | "style" | "genre"; value: string; score: number };

export function ExploreScreen({
  username,
  initialQuery,
}: {
  username: string | null;
  initialQuery: string;
}) {
  const me = useMe();
  const [query, setQuery] = useState(initialQuery);
  const [committed, setCommitted] = useState(initialQuery.trim());
  const [results, setResults] = useState<SearchRelease[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [items, setItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [recs, setRecs] = useState<RecommendHit[]>([]);
  const [seeds, setSeeds] = useState<TasteSeed[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState("");
  const [searchOpen, setSearchOpen] = useState(Boolean(initialQuery.trim()));

  const wallHref = username ? `/store?u=${encodeURIComponent(username)}` : "/store";
  const displayName = username ?? me.data?.username ?? null;
  const canAdd = Boolean(me.data) && !username;
  const showRecs = !committed;
  // Prefer session when you're browsing yourself so the recommend API keeps OAuth.
  const recommendAs =
    username && me.data?.username && username.toLowerCase() === me.data.username.toLowerCase()
      ? null
      : username;

  const runSearch = useCallback(async (needle: string, nextPage: number, append: boolean) => {
    if (!needle) {
      setResults([]);
      setPage(1);
      setPages(1);
      setItems(0);
      setError("");
      return;
    }

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const body = await searchCatalog({ q: needle, page: nextPage, perPage: 100 });
      setResults((prev) => (append ? [...prev, ...body.results] : body.results));
      setPage(body.page);
      setPages(body.pages);
      setItems(body.items);
    } catch (err: unknown) {
      if (!append) setResults([]);
      setError(err instanceof CollectionError ? err.message : "Discogs search could not finish.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(committed, 1, false);
  }, [committed, runSearch]);

  useEffect(() => {
    if (!showRecs) return;
    let cancelled = false;
    setRecsLoading(true);
    setRecsError("");
    void fetchRecommendations(recommendAs, 18)
      .then((body) => {
        if (cancelled) return;
        setRecs(body.results);
        setSeeds(body.seeds);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRecs([]);
        setSeeds([]);
        setRecsError(
          err instanceof CollectionError
            ? err.message
            : "Could not build picks from your collection.",
        );
      })
      .finally(() => {
        if (!cancelled) setRecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showRecs, recommendAs, me.data?.username]);

  const commitSearch = useCallback((next: string) => {
    const trimmed = next.trim();
    setQuery(trimmed);
    setCommitted(trimmed);
    setSearchOpen(Boolean(trimmed));
    const url = new URL(window.location.href);
    if (trimmed) url.searchParams.set("q", trimmed);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
  }, []);

  const canLoadMore = committed.length >= 2 && page < pages && !loading && !loadingMore;
  const displayResults = showRecs ? recs : results;

  const openRecord = useMemo((): CollectionRecord | null => {
    if (openId == null) return null;
    const hit = displayResults.find((release) => release.id === openId);
    if (!hit) return null;
    return {
      id: hit.id,
      instance_id: hit.id,
      folder_id: 1,
      title: hit.title,
      artists: hit.artist ? [hit.artist] : [],
      year: hit.year,
      labels: hit.label ? [hit.label] : [],
      formats: hit.format,
      genres: [],
      styles: [],
      cover_image: hit.cover_image,
      thumb: hit.cover_image,
      date_added: "",
      rating: 0,
      notes: [],
    };
  }, [openId, displayResults]);

  return (
    <div className="explore-shell">
      <header className="explore-chrome">
        <Link href={wallHref} className="explore-brand" aria-label="Back to the wall">
          The wall
        </Link>
        <div className="explore-account">
          {displayName ? <span className="listening-who-inline">{displayName}</span> : null}
          <Link href={wallHref} className="listening-ghost explore-desktop-link">
            The wall
          </Link>
          <Link
            href={username ? `/store/collection?u=${encodeURIComponent(username)}` : "/store/collection"}
            className="listening-ghost explore-desktop-link"
          >
            Catalog
          </Link>
        </div>
      </header>

      <main className="explore-main">
        <div className="explore-hero">
          <p className="explore-recs-kicker">Explore</p>
          <h1 className="font-display text-3xl sm:text-4xl">
            {showRecs ? "For you" : `“${committed}”`}
          </h1>
          <p className="explore-hero-copy mt-2 max-w-xl text-sm text-[#6f6a62]">
            {showRecs
              ? "Picks from your Discogs favourites — no search needed."
              : "Discogs results. Clear to go back to your picks."}
          </p>

          {showRecs && seeds.length > 0 ? (
            <div className="explore-seed-row">
              {seeds.map((seed) => (
                <button
                  key={`${seed.kind}-${seed.value}`}
                  type="button"
                  className="explore-seed"
                  onClick={() => commitSearch(seed.value)}
                >
                  {seed.value}
                </button>
              ))}
            </div>
          ) : null}

          {searchOpen || committed ? (
            <form
              className="explore-search"
              onSubmit={(event) => {
                event.preventDefault();
                commitSearch(query);
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Artist, album, label…"
                autoFocus={Boolean(committed)}
              />
              <button type="submit" className="listening-cta">
                Search
              </button>
              {committed ? (
                <button type="button" className="explore-clear-btn" onClick={() => commitSearch("")}>
                  Clear
                </button>
              ) : (
                <button type="button" className="explore-clear-btn" onClick={() => setSearchOpen(false)}>
                  Hide
                </button>
              )}
            </form>
          ) : (
            <button type="button" className="explore-search-toggle" onClick={() => setSearchOpen(true)}>
              Or search Discogs…
            </button>
          )}
        </div>

        {showRecs && recsLoading ? <p className="explore-status">Pulling picks from your shelf…</p> : null}
        {showRecs && recsError ? <p className="explore-status is-error">{recsError}</p> : null}
        {showRecs && !recsLoading && !recsError && recs.length === 0 ? (
          <p className="explore-status">
            Nothing to recommend yet — add records to your Discogs collection (heart a few favourites)
            and open the laptop again.
          </p>
        ) : null}

        {loading ? <p className="explore-status">Searching Discogs…</p> : null}
        {error ? <p className="explore-status is-error">{error}</p> : null}
        {!loading && !error && committed && results.length === 0 ? (
          <p className="explore-status">Nothing matched “{committed}”.</p>
        ) : null}
        {!showRecs && !loading && results.length > 0 ? (
          <p className="explore-count">
            Showing {results.length.toLocaleString()}
            {items > 0 ? ` of ${items.toLocaleString()}` : ""} releases
          </p>
        ) : null}
        {showRecs && !recsLoading && recs.length > 0 ? (
          <p className="explore-count">{recs.length} automatic picks · titles you own are skipped</p>
        ) : null}

        <ul className="explore-grid">
          {displayResults.map((release) => {
            const label = [release.artist, release.title].filter(Boolean).join(" — ");
            const reason = "reason" in release ? String(release.reason) : "";
            return (
              <li key={`${release.id}-${release.catno || release.master_id || "x"}`}>
                <button type="button" className="explore-card" onClick={() => setOpenId(release.id)}>
                  <span className="explore-card-stage">
                    <span className="explore-card-disc" aria-hidden />
                    <span className="explore-card-art">
                      {release.cover_image ? (
                        <CoverImage
                          src={release.cover_image}
                          alt={label}
                          sizes="(max-width: 768px) 45vw, 240px"
                        />
                      ) : (
                        <span className="explore-card-empty" />
                      )}
                    </span>
                  </span>
                  <span className="explore-card-copy">
                    {reason ? <span className="explore-card-reason">{reason}</span> : null}
                    <span className="explore-card-title">{label}</span>
                    <span className="explore-card-meta">
                      {[release.year || null, release.format || null, release.label || null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {canLoadMore ? (
          <div className="explore-more">
            <button
              type="button"
              className="listening-cta"
              disabled={loadingMore}
              onClick={() => void runSearch(committed, page + 1, true)}
            >
              {loadingMore ? "Loading…" : `Load more · page ${page + 1} of ${pages}`}
            </button>
          </div>
        ) : null}
      </main>

      {openId != null ? <RecordModal id={openId} record={openRecord} onClose={() => setOpenId(null)} /> : null}

      <PhoneTabBar username={username} active="explore" canAdd={canAdd} />
    </div>
  );
}
