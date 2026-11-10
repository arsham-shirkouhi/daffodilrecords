"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { searchCatalog } from "@/lib/client-api";
import { CollectionError } from "@/lib/errors";
import type { SearchRelease } from "@/lib/types";

const SLOT_COUNT = 8;

/** Flat bottom row of three, with left/right sleeves sitting a bit higher. */
const SCATTER = [
  { x: -16.8, y: -0.6, tilt: -9, scale: 0.92 },
  { x: -9.2, y: 5.4, tilt: -4, scale: 1 },
  { x: 0, y: 5.8, tilt: 2, scale: 1.04 },
  { x: 9.2, y: 5.4, tilt: 5, scale: 0.98 },
  { x: 16.8, y: -0.6, tilt: 9, scale: 0.92 },
] as const;

function scatterStyle(index: number): CSSProperties {
  const spot = SCATTER[index] ?? SCATTER[SCATTER.length - 1]!;
  return {
    ["--scatter-x" as string]: `${spot.x}rem`,
    ["--scatter-y" as string]: `${spot.y}rem`,
    ["--tilt" as string]: `${spot.tilt}deg`,
    ["--scatter-scale" as string]: String(spot.scale),
    ["--arc-delay" as string]: `${60 + index * 55}ms`,
    ["--pack-delay" as string]: `${60 + index * 55}ms`,
  };
}

type Slot = {
  key: string;
  release: SearchRelease | null;
  coverReady: boolean;
};

function emptySlots(prefix: string): Slot[] {
  return Array.from({ length: SLOT_COUNT }, (_, index) => ({
    key: `${prefix}-${index}`,
    release: null,
    coverReady: false,
  }));
}

export function WallVinylSearch({
  username,
  onPick,
  ownedIds,
}: {
  username: string | null;
  ownedIds: Set<number>;
  onPick: (id: number) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<number | null>(null);
  const hasSlotsRef = useRef(false);
  const openRef = useRef(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showCovers, setShowCovers] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const activeSearch = query.trim().length >= 2;
  hasSlotsRef.current = slots.length > 0;
  openRef.current = open;

  const clearExitTimer = () => {
    if (exitTimer.current != null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  };

  const packAway = (clearSlots: boolean) => {
    if (!hasSlotsRef.current) {
      setOpen(false);
      setExiting(false);
      if (clearSlots) setSlots([]);
      return;
    }

    clearExitTimer();
    setShowCovers(false);
    setExiting(true);
    exitTimer.current = window.setTimeout(() => {
      setOpen(false);
      setExiting(false);
      if (clearSlots) {
        setSlots([]);
        setShowMore(false);
        setItems(0);
        setStatus("");
      }
      exitTimer.current = null;
    }, 1150);
  };

  const revealResults = () => {
    clearExitTimer();
    setExiting(false);
    setOpen(true);
  };

  useEffect(() => {
    clearExitTimer();

    if (!activeSearch) {
      setLoading(false);
      setStatus("");
      setItems(0);
      setShowCovers(false);
      setShowMore(false);
      packAway(true);
      return;
    }

    setExiting(false);
    setOpen(true);
    setShowCovers(false);
    setShowMore(false);
    setSlots((prev) =>
      prev.length > 0
        ? prev.map((_, index) => ({
          key: `hold-${index}`,
          release: null,
          coverReady: false,
        }))
        : emptySlots("pending"),
    );

    const needle = query.trim();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setStatus("Searching…");
      void searchCatalog({ q: needle, preview: true })
        .then((body) => {
          const next = body.results.slice(0, SLOT_COUNT).map((release, index) => ({
            key: `hit-${release.id}-${index}`,
            release,
            coverReady: !release.cover_image,
          }));
          while (next.length < SLOT_COUNT) {
            next.push({
              key: `empty-${next.length}`,
              release: null,
              coverReady: false,
            });
          }
          setSlots(next);
          setItems(body.items);
          setShowMore(true);
          setStatus(body.results.length === 0 ? "Nothing matched that." : "");
          setOpen(true);
          setExiting(false);
        })
        .catch((error: unknown) => {
          setSlots(emptySlots("err"));
          setItems(0);
          setShowMore(false);
          setStatus(error instanceof CollectionError ? error.message : "Search could not finish.");
          setOpen(true);
          setExiting(false);
        })
        .finally(() => setLoading(false));
    }, 280);

    return () => window.clearTimeout(timer);
    // packAway is stable enough via refs; only react to query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeSearch]);

  useEffect(() => {
    return () => clearExitTimer();
  }, []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (!openRef.current || !hasSlotsRef.current) {
        setOpen(false);
        return;
      }
      packAway(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open || !activeSearch || loading || exiting) {
      setShowCovers(false);
      return;
    }
    const hasHits = slots.some((slot) => slot.release);
    const coversReady = slots.every((slot) => !slot.release?.cover_image || slot.coverReady);
    if (!hasHits || !coversReady) {
      setShowCovers(false);
      return;
    }
    const timer = window.setTimeout(() => setShowCovers(true), 40);
    return () => window.clearTimeout(timer);
  }, [slots, loading, activeSearch, exiting, open]);

  const exploreHref = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (username) params.set("u", username);
    const qs = params.toString();
    return qs ? `/store/explore?${qs}` : "/store/explore";
  }, [query, username]);

  const showArc = (open || exiting) && slots.length > 0;
  const coversOn = showCovers && open && !exiting && activeSearch;

  return (
    <div
      ref={rootRef}
      className={`wall-search${showArc ? " is-open" : ""}${exiting ? " is-exiting" : ""}${coversOn ? " has-covers" : ""}${loading ? " is-busy" : ""}`}
    >
      {showArc ? (
        <div className="wall-search-panel" id={listId} role="listbox">
          {loading ? <p className="wall-search-status">Listening for matches…</p> : null}
          {!loading && status ? <p className="wall-search-status">{status}</p> : null}

          <ul className={`wall-search-arc${exiting ? " is-packing" : ""}`}>
            {slots.map((slot, index) => {
              const release = slot.release;
              const owned = release ? ownedIds.has(release.id) : false;
              const label = release
                ? [release.artist, release.title].filter(Boolean).join(" — ")
                : "Searching…";
              return (
                <li
                  key={slot.key}
                  className={`wall-search-arc-slot${release ? "" : " is-filler"}`}
                  style={scatterStyle(index)}
                >
                  <button
                    type="button"
                    className={`wall-search-sleeve${coversOn && release?.cover_image ? " has-art" : ""}`}
                    role="option"
                    aria-label={label}
                    title={release ? label : undefined}
                    disabled={!release}
                    onClick={() => {
                      if (!release) return;
                      onPick(release.id);
                      packAway(false);
                    }}
                  >
                    <span
                      className={`wall-search-sleeve-mat${!release || !coversOn ? " is-skeleton" : ""}`}
                    >
                      {release?.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={release.cover_image}
                          alt=""
                          draggable={false}
                          loading="eager"
                          decoding="async"
                          className={coversOn && slot.coverReady ? "is-shown" : ""}
                          ref={(node) => {
                            if (node?.complete && !slot.coverReady) {
                              setSlots((prev) =>
                                prev.map((entry) =>
                                  entry.key === slot.key ? { ...entry, coverReady: true } : entry,
                                ),
                              );
                            }
                          }}
                          onLoad={() => {
                            setSlots((prev) =>
                              prev.map((entry) =>
                                entry.key === slot.key ? { ...entry, coverReady: true } : entry,
                              ),
                            );
                          }}
                          onError={() => {
                            setSlots((prev) =>
                              prev.map((entry) =>
                                entry.key === slot.key ? { ...entry, coverReady: true } : entry,
                              ),
                            );
                          }}
                        />
                      ) : null}
                    </span>
                    {release ? (
                      <span className="wall-search-sleeve-copy">
                        <span className="wall-search-sleeve-title">{release.title}</span>
                        {release.artist ? (
                          <span className="wall-search-sleeve-artist">{release.artist}</span>
                        ) : null}
                      </span>
                    ) : null}
                    {owned ? <span className="wall-search-owned">Yours</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {showMore && !loading && !exiting ? (
            <Link
              href={exploreHref}
              className="wall-search-more-link"
              onClick={() => packAway(false)}
            >
              {items > SLOT_COUNT
                ? `View more · ${items.toLocaleString()} on Discogs`
                : "View more on Explore"}
            </Link>
          ) : null}
        </div>
      ) : null}

      <label className="wall-search-field">
        <span className="sr-only">Search for album</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            revealResults();
          }}
          onFocus={() => {
            if (activeSearch && slots.length > 0) {
              // Remount keys so the scatter entrance plays again.
              setSlots((prev) =>
                prev.map((slot, index) => ({
                  ...slot,
                  key: `focus-${slot.release?.id ?? index}-${index}`,
                })),
              );
              revealResults();
            } else if (activeSearch) {
              revealResults();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              packAway(false);
              event.currentTarget.blur();
            }
            if (event.key === "Enter" && activeSearch) {
              event.preventDefault();
              window.location.href = exploreHref;
            }
          }}
          placeholder="Search for album"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          style={{ textAlign: "center" }}
        />
      </label>
    </div>
  );
}
