"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AddRecordDialog } from "@/components/catalog/AddRecordDialog";
import { NotesPanel } from "@/components/catalog/NotesPanel";
import { SleeveFace } from "@/components/store/Sleeve";
import { SleeveHoverCard } from "@/components/store/SleeveHoverCard";
import { PhoneTabBar } from "@/components/store/PhoneTabBar";
import { VinylCrate } from "@/components/store/VinylCrate";
import { WallRecordStage, type WallOrigin } from "@/components/store/WallRecordStage";
import { useCollection, useMe, usePrices } from "@/components/store/use-shop-data";
import {
  artistLine,
  defaultFilters,
  filterRecords,
  formatMoney,
  primaryFormat,
  type BrowseFilters,
} from "@/lib/browse";
import { fetchCollection, fetchFolders, fetchWants, postJson } from "@/lib/client-api";
import { CollectionError } from "@/lib/errors";
import { collectionPriceStats } from "@/lib/spine";
import type { CollectionRecord, SearchRelease, WantRecord } from "@/lib/types";

const PAGE_SIZE = 24;
const PREFERRED_GENRES = ["Folk", "Rock", "Jazz", "Soul", "Pop"];
type LayoutMode = "covers" | "grid" | "list";

type Section = "collection" | "wishlist" | "notes";

export function StoreScreen({
  username,
  initialRecordId,
}: {
  username: string | null;
  initialRecordId: number | null;
}) {
  const collection = useCollection(username);
  const me = useMe();
  const folders = useSWR(["folders", username ?? "__session__"], () => fetchFolders(username), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const wants = useSWR(["wants", username ?? "__session__"], () => fetchWants(username), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const canEdit = Boolean(me.data) && !username;

  const [section, setSection] = useState<Section>("collection");
  const [layout, setLayout] = useState<LayoutMode>("covers");
  const [group, setGroup] = useState<"genre" | "folder">("genre");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [filters, setFilters] = useState<BrowseFilters>(defaultFilters);
  const [pageState, setPageState] = useState({ key: "collection", page: 1 });
  const [openId, setOpenId] = useState<number | null>(initialRecordId);
  const [takenId, setTakenId] = useState<number | null>(initialRecordId);
  const [origin, setOrigin] = useState<WallOrigin | null>(null);
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState<"search" | "scan">("scan");
  const [toast, setToast] = useState("");
  const [flying, setFlying] = useState<string | null>(null);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "wishlist" || hash === "notes" || hash === "collection") {
        setSection(hash);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") !== "scan") return;
    setAddTab("scan");
    setAdding(true);
    params.delete("add");
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", url);
  }, [canEdit]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onPop = () => {
      const value = Number(new URLSearchParams(window.location.search).get("record"));
      const next = Number.isInteger(value) && value > 0 ? value : null;
      setOpenId(next);
      setTakenId(next);
      if (next == null) setOrigin(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const records = useMemo(() => collection.data?.records ?? [], [collection.data]);
  const wantList = useMemo(() => wants.data?.wants ?? [], [wants.data]);
  const folderList = folders.data?.folders ?? [];
  const ownedIds = useMemo(() => new Set(records.map((record) => record.id)), [records]);
  const wantedIds = useMemo(() => new Set(wantList.map((record) => record.id)), [wantList]);
  const favourites = records.filter((record) => record.rating >= 4).length;
  const allPriceIds = useMemo(() => [...new Set(records.map((record) => record.id))], [records]);
  const priceIds = useMemo(() => allPriceIds.slice(0, 60), [allPriceIds]);
  const priceState = usePrices(priceIds.length > 0 ? priceIds : null, username);
  const priceStats = useMemo(() => collectionPriceStats(priceState.prices), [priceState.prices]);
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      const list = record.genres.length > 0 ? record.genres : ["Unsorted"];
      for (const genre of list) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    const present = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
    const preferred = PREFERRED_GENRES.filter((genre) => counts.has(genre));
    const rest = present.filter((genre) => !PREFERRED_GENRES.includes(genre));
    return [...preferred, ...rest].map((genre) => ({ name: genre, count: counts.get(genre) ?? 0 }));
  }, [records]);

  const visible = useMemo(() => {
    const filtered = filterRecords(records, filters, priceState.prices);
    return favouritesOnly ? filtered.filter((record) => record.rating >= 4) : filtered;
  }, [records, filters, favouritesOnly, priceState.prices]);

  const pageKey = `${section}:${group}:${favouritesOnly}:${filters.query}:${filters.genre}:${filters.folder}:${filters.sort}`;
  const page = pageState.key === pageKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: pageKey, page: next });
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRecords = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const openRecord =
    records.find((record) => record.id === openId) ??
    (openId != null ? wantAsCollection(wantList.find((record) => record.id === openId) ?? null) : null);

  const notify = (message: string) => setToast(message);

  const saveCollection = async (next: CollectionRecord[], task: () => Promise<unknown>, message: string) => {
    const previous = collection.data;
    try {
      await collection.mutate(
        async () => {
          await task();
          return fetchCollection(username, () => undefined);
        },
        {
          optimisticData: previous ? { records: next, username: previous.username } : undefined,
          rollbackOnError: true,
          revalidate: false,
        },
      );
      notify(message);
    } catch (error) {
      notify(error instanceof CollectionError ? error.message : "Discogs could not save that.");
    }
  };

  const saveWant = async (next: WantRecord[], task: () => Promise<unknown>, message: string) => {
    const previous = wants.data;
    try {
      await wants.mutate(
        async () => {
          await task();
          return fetchWants(username);
        },
        {
          optimisticData: previous ? { wants: next } : { wants: next },
          rollbackOnError: true,
          revalidate: false,
        },
      );
      notify(message);
    } catch (error) {
      notify(error instanceof CollectionError ? error.message : "Discogs could not update the wishlist.");
    }
  };

  const open = (id: number, nextOrigin: WallOrigin | null = null) => {
    setOrigin(nextOrigin);
    setOpenId(id);
    setTakenId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("record", String(id));
    window.history.pushState({}, "", url);
  };

  const revealSource = () => {
    setTakenId(null);
  };

  const close = () => {
    setOpenId(null);
    setTakenId(null);
    setOrigin(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    window.history.pushState({}, "", url);
  };

  const addRelease = async (release: SearchRelease, folderId: number) => {
    const stub: CollectionRecord = {
      id: release.id,
      instance_id: -release.id,
      folder_id: folderId,
      title: release.title,
      artists: release.artist ? [release.artist] : [],
      year: release.year,
      labels: release.label ? [release.label] : [],
      formats: release.format,
      genres: [],
      styles: [],
      cover_image: release.cover_image,
      thumb: release.cover_image,
      date_added: new Date().toISOString(),
      rating: 0,
      notes: [],
    };
    setFlying(release.cover_image);
    setAdding(false);
    setSection("collection");
    await saveCollection([stub, ...records.filter((record) => record.id !== release.id)], () =>
      postJson("/api/collection/items", "POST", { releaseId: release.id, folderId }),
      "Filed on the shelf.");
    void folders.mutate();
  };

  const wantRelease = async (release: SearchRelease) => {
    const stub: WantRecord = {
      id: release.id,
      title: release.title,
      artists: release.artist ? [release.artist] : [],
      year: release.year,
      labels: release.label ? [release.label] : [],
      formats: release.format,
      cover_image: release.cover_image,
      thumb: release.cover_image,
      date_added: new Date().toISOString(),
    };
    await saveWant([stub, ...wantList.filter((item) => item.id !== release.id)], () =>
      postJson(`/api/wants/${release.id}`, "PUT"),
      "Added to the wishlist.");
  };

  const phoneTab = section === "wishlist" ? "wantlist" : "collection";

  return (
    <div className="store-shell min-h-dvh bg-[#f6f3ec] text-[#1c1b19]">
      <header className="store-chrome sticky top-0 z-30 border-b border-[#e7e2d8] bg-[#f6f3ec]/90 backdrop-blur">
        <div className="store-chrome-bar mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href={username ? `/store?u=${encodeURIComponent(username)}` : "/store"}
            className="font-display text-xl text-[#1c1b19]"
            aria-label="Back to the wall"
          >
            The wall
          </Link>
          <nav className="hidden items-center gap-6 text-sm sm:flex" aria-label="Shop">
            <Link
              href={username ? `/store?u=${encodeURIComponent(username)}` : "/store"}
              className="pb-1 text-[#6f6a62] hover:text-[#1c1b19]"
            >
              The wall
            </Link>
            <NavButton current={section === "collection"} onClick={() => setSection("collection")}>
              The collection
            </NavButton>
            <NavButton current={section === "wishlist"} onClick={() => setSection("wishlist")}>
              Wishlist
            </NavButton>
            <NavButton current={section === "notes"} onClick={() => setSection("notes")}>
              Little notes
            </NavButton>
          </nav>
          <div className="store-chrome-notes flex items-center gap-3 sm:hidden">
            <NavButton current={section === "notes"} onClick={() => setSection("notes")}>
              Notes
            </NavButton>
          </div>
          <p className="hidden items-center gap-2 rounded-full border border-[#e6e1d6] bg-white/70 px-3 py-1 text-sm text-[#6f6a62] md:flex">
            <Heart filled={false} />
            {username ? "A public collection" : me.data ? "A personal collection" : "A public collection"}
          </p>
        </div>
      </header>

      <main id="main" className="store-main mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {section === "collection" ? (
          <>
            {collection.error ? (
              <ShelfMessage
                title="The shelf went quiet"
                body={collection.error instanceof CollectionError ? collection.error.message : "Discogs is not answering."}
                action={collection.error instanceof CollectionError && collection.error.status === 401 ? "login" : "retry"}
                onRetry={() => void collection.mutate()}
              />
            ) : !collection.data ? (
              <p className="mt-8 font-display text-3xl text-[#3d6b36]">Pulling records from the back room…</p>
            ) : records.length === 0 ? (
              <ShelfMessage title="The shelf is waiting" body="Once a record lands in the Discogs collection, it will show up here." />
            ) : (
              <>
                <div className="store-section-head mt-8 flex flex-col gap-4 border-b border-[#e6e1d6] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="store-section-title flex flex-wrap items-baseline gap-3">
                    <h2 className="font-display text-3xl">
                      {favouritesOnly ? "Favourites" : "My collection"}
                    </h2>
                    <span className="rounded-full bg-[#f3e6b0] px-2.5 py-0.5 text-sm">
                      {favouritesOnly ? favourites : records.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFavouritesOnly((value) => !value)}
                      className={`rounded-full px-3 py-1 text-sm ${favouritesOnly ? "bg-[#1c1b19] text-[#f6f3ec]" : "bg-white text-[#6f6a62]"}`}
                    >
                      {favouritesOnly ? `All ${records.length}` : `Favourites ${favourites}`}
                    </button>
                  </div>
                  <label className="store-section-search relative block sm:w-72">
                    <span className="sr-only">Search</span>
                    <input
                      value={filters.query}
                      onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                      placeholder="Find an album or artist..."
                      className="h-11 w-full rounded-full border border-[#e6e1d6] bg-white px-4 text-sm outline-none"
                    />
                  </label>
                </div>

                <div className="collection-toolbar">
                <PriceSummary
                  lowest={priceStats.lowest}
                  average={priceStats.average}
                  highest={priceStats.highest}
                  sum={priceStats.sum}
                  collectionSize={records.length}
                  counted={priceStats.counted}
                  checked={priceState.checked}
                  checkingTotal={priceState.total}
                  checking={priceState.checked < priceState.total}
                  capped={allPriceIds.length > priceIds.length}
                />

                <div className="browse-board">
                  <div className="browse-board-head">
                    <div className="browse-board-nav">
                      <p className="browse-kicker">
                        <span className="browse-kicker-disc" aria-hidden />
                        Browse by
                      </p>
                      <div className="browse-modes" role="group" aria-label="Browse by">
                        <button
                          type="button"
                          aria-pressed={group === "genre"}
                          onClick={() => {
                            setGroup("genre");
                            setFilters({ ...filters, folder: "all", genre: "all" });
                          }}
                          className={group === "genre" ? "is-on" : ""}
                        >
                          Genres
                          {group === "genre" ? <motion.span layoutId="browse-mode" className="browse-mode-mark" /> : null}
                        </button>
                        <button
                          type="button"
                          aria-pressed={group === "folder"}
                          onClick={() => {
                            setGroup("folder");
                            setFilters({ ...filters, genre: "all", folder: "all" });
                          }}
                          className={group === "folder" ? "is-on" : ""}
                        >
                          Folders
                          {group === "folder" ? <motion.span layoutId="browse-mode" className="browse-mode-mark" /> : null}
                        </button>
                      </div>
                    </div>
                    <div className="browse-tools">
                      <label className="browse-sort">
                        <span>Sort</span>
                        <select
                          value={filters.sort}
                          aria-label="Sort records"
                          onChange={(event) => setFilters({ ...filters, sort: event.target.value as BrowseFilters["sort"] })}
                        >
                          <option value="artist">Artist A–Z</option>
                          <option value="added">Recently added</option>
                          <option value="year">Year</option>
                          <option value="rating">Rating</option>
                          <option value="price">Lowest price</option>
                        </select>
                      </label>
                      <div className="browse-views" role="radiogroup" aria-label="Layout">
                        {(
                          [
                            ["covers", "Crate"],
                            ["grid", "Grid"],
                            ["list", "List"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={layout === id}
                            aria-label={label === "Crate" ? "Vinyl crate" : label === "Grid" ? "Cover grid" : "List"}
                            onClick={() => setLayout(id)}
                            className={layout === id ? "is-on" : ""}
                          >
                            <ViewGlyph mode={id} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="browse-bins">
                    {group === "genre" ? (
                      <>
                        <CategoryPill
                          selected={filters.genre === "all"}
                          count={records.length}
                          tone={binTone("All records")}
                          onClick={() => setFilters({ ...filters, genre: "all" })}
                        >
                          All records
                        </CategoryPill>
                        {genres.map((genre, index) => (
                          <CategoryPill
                            key={genre.name}
                            selected={filters.genre === genre.name}
                            count={genre.count}
                            tone={binTone(genre.name, index)}
                            onClick={() => setFilters({ ...filters, genre: genre.name })}
                          >
                            {genre.name}
                          </CategoryPill>
                        ))}
                      </>
                    ) : (
                      <>
                        <CategoryPill
                          selected={filters.folder === "all"}
                          count={records.length}
                          tone={binTone("All folders")}
                          onClick={() => setFilters({ ...filters, folder: "all" })}
                        >
                          All folders
                        </CategoryPill>
                        {folderList.filter((folder) => folder.id !== 0).map((folder, index) => (
                          <CategoryPill
                            key={folder.id}
                            selected={filters.folder === String(folder.id)}
                            count={folder.count}
                            tone={binTone(folder.name, index)}
                            onClick={() => setFilters({ ...filters, folder: String(folder.id) })}
                          >
                            {folder.name}
                          </CategoryPill>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                </div>

                {visible.length === 0 ? (
                  <motion.p
                    className="mt-16 text-center font-display text-3xl"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    Nothing on the shelf matches.
                  </motion.p>
                ) : layout === "covers" ? (
                  <VinylCrate records={visible} onOpen={open} activeId={takenId} />
                ) : layout === "grid" ? (
                  <motion.div layout className="mt-8 grid grid-cols-2 gap-x-8 gap-y-10 overflow-visible md:grid-cols-4">
                    {pageRecords.map((record, index) => (
                      <AlbumCard
                        key={record.instance_id}
                        record={record}
                        index={index}
                        canEdit={canEdit}
                        taken={takenId === record.id}
                        onOpen={open}
                        onHeart={(rating) =>
                          void saveCollection(
                            records.map((item) =>
                              item.instance_id === record.instance_id ? { ...item, rating } : item,
                            ),
                            () =>
                              postJson("/api/collection/items", "PATCH", {
                                releaseId: record.id,
                                instanceId: record.instance_id,
                                folderId: record.folder_id,
                                rating,
                              }),
                            rating ? "Marked as a favourite." : "Rating cleared.",
                          )
                        }
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.ul layout className="mt-8 divide-y divide-[#e6e1d6]">
                    {pageRecords.map((record, index) => (
                      <motion.li
                        key={record.instance_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index, 10) * 0.03 }}
                        className={takenId === record.id ? "opacity-0" : undefined}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            open(record.id, {
                              x: rect.left,
                              y: rect.top,
                              width: rect.height,
                              height: rect.height,
                              tilt: 0,
                            });
                          }}
                          className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-[#efeae0]/50"
                        >
                          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-[#ece7dc] shadow-sm">
                            <SleeveFace record={record} sizes="64px" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-xl">{record.title}</span>
                            <span className="block truncate text-sm text-[#6f6a62]">{artistLine(record.artists)}</span>
                          </span>
                          <span className="hidden text-sm text-[#8a847a] sm:block">{record.year || ""}</span>
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}

                {layout === "covers" ? (
                  <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-sm text-[#8a847a]">
                      Showing all {visible.length} sleeves
                      {visible.length !== records.length ? ` from ${records.length}` : ""} in the crate.
                    </p>
                    <p className="font-display text-lg text-[#3d6b36] italic">Collected with love. Played on repeat.</p>
                  </div>
                ) : (
                  <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    <p className="text-sm text-[#8a847a]">
                      Showing {pageRecords.length} of {visible.length} records
                    </p>
                    <Pagination page={safePage} pages={pages} onPage={setPage} />
                    <p className="font-display text-lg text-[#3d6b36] italic">Collected with love. Played on repeat.</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : null}

        {section === "wishlist" ? (
          <motion.section
            className="py-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs tracking-[0.22em] text-[#a8843a] uppercase">Wanted</p>
            <h2 className="store-want-title mt-2 font-display text-3xl sm:text-5xl">The ones still out there.</h2>
            {wants.error ? (
              <p className="mt-6 text-[#6f6a62]">The wishlist could not be opened.</p>
            ) : !wants.data ? (
              <p className="mt-6 font-display text-2xl text-[#a8843a]">Checking the want list…</p>
            ) : wantList.length === 0 ? (
              <p className="mt-6 max-w-md text-[#6f6a62]">Nothing is waiting on the wishlist yet.</p>
            ) : (
              <>
                <VinylCrate
                  records={wantList.map((record) => wantAsCollection(record)!)}
                  onOpen={open}
                  activeId={takenId}
                />
                <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <p className="text-sm text-[#8a847a]">
                    Showing all {wantList.length} wanted sleeves in the crate.
                  </p>
                  <p className="font-display text-lg text-[#3d6b36] italic">Still hunting. Still hoping.</p>
                </div>
              </>
            )}
          </motion.section>
        ) : null}

        {section === "notes" ? (
          <NotesPanel
            folders={folderList}
            canEdit={canEdit}
            onChanged={() => folders.mutate()}
            onToast={notify}
          />
        ) : null}
      </main>

      <footer className="store-footer border-t border-[#e6e1d6]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-[#6f6a62] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>A little music. A little sunshine. A lot of love.</p>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-right">
            Back to top ↑
          </button>
        </div>
      </footer>

      <PhoneTabBar
        username={username}
        active={phoneTab}
        canAdd={canEdit}
        onAdd={() => {
          setAddTab("scan");
          setAdding(true);
        }}
      />

      {openId != null ? (
        <WallRecordStage
          key={openId}
          id={openId}
          record={openRecord}
          origin={origin}
          onReturnStart={revealSource}
          onClose={close}
          returnLabel="Put it back"
          pickingHint="Picking it up…"
        />
      ) : null}

      {adding ? (
        <AddRecordDialog
          key={addTab}
          folders={folderList}
          ownedIds={ownedIds}
          wantedIds={wantedIds}
          initialTab={addTab}
          onClose={() => setAdding(false)}
          onAdd={addRelease}
          onWant={wantRelease}
        />
      ) : null}

      {flying ? (
        <motion.div
          className="pointer-events-none fixed z-[90] h-28 w-28 overflow-hidden rounded-sm shadow-xl"
          initial={{ left: "50%", top: "42%", x: "-50%", y: "-50%", scale: 1, opacity: 1 }}
          animate={{ left: "22%", top: "68%", x: "-50%", scale: 0.35, opacity: 0 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          onAnimationComplete={() => setFlying(null)}
        >
          <SleeveFace record={{ artists: [], title: "New record", cover_image: flying, year: 0 }} sizes="112px" />
        </motion.div>
      ) : null}

      {toast ? (
        <p role="status" className="store-toast fixed bottom-20 left-1/2 z-[90] max-w-sm -translate-x-1/2 rounded-full bg-[#1c1b19] px-4 py-2 text-center text-sm text-[#f6f3ec] shadow-lg">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function wantAsCollection(record: WantRecord | null): CollectionRecord | null {
  if (!record) return null;
  return {
    id: record.id,
    instance_id: -record.id,
    folder_id: 0,
    title: record.title,
    artists: record.artists,
    year: record.year,
    labels: record.labels,
    formats: record.formats,
    genres: [],
    styles: [],
    cover_image: record.cover_image,
    thumb: record.thumb,
    date_added: record.date_added,
    rating: 0,
    notes: [],
  };
}

function AlbumCard({
  record,
  index,
  canEdit,
  taken = false,
  onOpen,
  onHeart,
}: {
  record: CollectionRecord;
  index: number;
  canEdit: boolean;
  taken?: boolean;
  onOpen: (id: number, origin?: WallOrigin | null) => void;
  onHeart: (rating: number) => void;
}) {
  const loved = record.rating >= 4;
  const meta = [record.genres[0], primaryFormat(record.formats)].filter(Boolean).join(" · ");
  return (
    <motion.article
      className={`collection-album relative${taken ? " is-taken" : ""}`}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: taken ? 0 : 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 12) * 0.04, type: "spring", stiffness: 280, damping: 24 }}
    >
      <SleeveHoverCard
        record={record}
        taken={taken}
        sizes="(max-width: 768px) 45vw, 240px"
        onOpen={onOpen}
      >
        <span className="mt-3 block font-display text-lg leading-tight">{record.title}</span>
        <span className="mt-1 block text-sm text-[#6f6a62]">{artistLine(record.artists)}</span>
        <span className="mt-2 flex items-start justify-between gap-3 text-[11px] tracking-wide text-[#8a847a] uppercase">
          <span>{meta}</span>
          <span>{record.year || ""}</span>
        </span>
      </SleeveHoverCard>
      {canEdit ? (
        <button
          type="button"
          aria-label={loved ? "Clear favourite" : "Mark as favourite"}
          onClick={() => onHeart(loved ? 0 : 5)}
          className="absolute top-3 right-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[#1c1b19]"
        >
          <Heart filled={loved} />
        </button>
      ) : loved ? (
        <span className="absolute top-3 right-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-white/85">
          <Heart filled />
        </span>
      ) : null}
    </motion.article>
  );
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return <span />;
  const numbers = Array.from({ length: pages }, (_, index) => index + 1).slice(0, 6);
  return (
    <div className="flex items-center gap-3 text-sm">
      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onPage(number)}
          className={`grid h-8 w-8 place-items-center rounded-full ${number === page ? "bg-[#f0d56a] text-[#1c1b19]" : "text-[#6f6a62]"}`}
        >
          {number}
        </button>
      ))}
      {page < pages ? (
        <button type="button" onClick={() => onPage(page + 1)} aria-label="Next page">
          →
        </button>
      ) : null}
    </div>
  );
}

const BIN_COLORS: Record<string, string> = {
  "All records": "#1c1b19",
  "All folders": "#1c1b19",
  Rock: "#8d3a2e",
  Pop: "#a84868",
  "Hip Hop": "#343f78",
  "Hip-Hop": "#343f78",
  "Funk / Soul": "#a86520",
  Funk: "#a86520",
  Soul: "#9a4a38",
  Jazz: "#245e48",
  Folk: "#5c6a32",
  "Folk, World, & Country": "#6a6230",
  Electronic: "#31557a",
  Classical: "#5c4a78",
  Blues: "#2c4e72",
  Reggae: "#2f6a3a",
  Latin: "#a85a32",
  Country: "#7a6230",
  Disco: "#b84a55",
  "R&B": "#7a3a58",
  Metal: "#3e3836",
  Punk: "#a33a3a",
  "Stage & Screen": "#7a4060",
  "Brass & Military": "#6a5428",
  Unsorted: "#6f6a62",
};

const BIN_FALLBACK = ["#8d3a2e", "#343f78", "#245e48", "#a86520", "#a84868", "#5c4a78", "#2c4e72", "#6a5428"];

function binTone(name: string, index = 0) {
  const known = BIN_COLORS[name];
  if (known) return known;
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return BIN_FALLBACK[hash % BIN_FALLBACK.length] ?? BIN_FALLBACK[index % BIN_FALLBACK.length];
}

function CategoryPill({
  selected,
  count,
  tone,
  onClick,
  children,
}: {
  selected: boolean;
  count: number;
  tone: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`browse-bin${selected ? " is-on" : ""}`}
      style={{ ["--bin" as string]: tone }}
    >
      <span className="browse-bin-name">{children}</span>
      <span className="browse-bin-count">{count}</span>
    </button>
  );
}

function ViewGlyph({ mode }: { mode: LayoutMode }) {
  if (mode === "covers") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <rect x="1.6" y="4.2" width="8.2" height="9" rx="1.1" />
        <rect x="6.1" y="2.4" width="8.2" height="9" rx="1.1" />
      </svg>
    );
  }
  if (mode === "grid") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="3" width="12" height="1.7" rx="0.85" />
      <rect x="2" y="7.15" width="12" height="1.7" rx="0.85" />
      <rect x="2" y="11.3" width="8" height="1.7" rx="0.85" />
    </svg>
  );
}

function PriceSummary({
  lowest,
  average,
  highest,
  sum,
  collectionSize,
  counted,
  checked,
  checkingTotal,
  checking,
  capped,
}: {
  lowest: number | null;
  average: number | null;
  highest: number | null;
  sum: number | null;
  collectionSize: number;
  counted: number;
  checked: number;
  checkingTotal: number;
  checking: boolean;
  capped: boolean;
}) {
  const collectionTotal =
    average != null && collectionSize > 0
      ? capped
        ? average * collectionSize
        : (sum ?? average * collectionSize)
      : null;
  const note = checking
    ? `Checking… ${checked}/${checkingTotal}`
    : capped
      ? `Est. from ${counted} priced`
      : `${counted} priced`;

  return (
    <div className="collection-price-stats" aria-label="Collection pricing">
      <span className="collection-price-chip">
        <span className="collection-price-chip-label">Low</span>
        <span className="collection-price-chip-value">{formatMoney(lowest) ?? "—"}</span>
      </span>
      <span className="collection-price-chip">
        <span className="collection-price-chip-label">Avg</span>
        <span className="collection-price-chip-value">{formatMoney(average) ?? "—"}</span>
      </span>
      <span className="collection-price-chip">
        <span className="collection-price-chip-label">High</span>
        <span className="collection-price-chip-value">{formatMoney(highest) ?? "—"}</span>
      </span>
      <span className="collection-price-chip is-total">
        <span className="collection-price-chip-label">Total</span>
        <span className="collection-price-chip-value">{formatMoney(collectionTotal) ?? "—"}</span>
      </span>
      <span className="collection-price-note">{note}</span>
    </div>
  );
}

function NavButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-1 ${current ? "border-b-2 border-[#e0b44a] text-[#1c1b19]" : "text-[#6f6a62]"}`}
    >
      {children}
    </button>
  );
}

function ShelfMessage({
  title,
  body,
  action,
  onRetry,
}: {
  title: string;
  body: string;
  action?: "login" | "retry";
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-lg text-center">
      <h2 className="font-display text-4xl">{title}</h2>
      <p className="mt-3 text-[#6f6a62]">{body}</p>
      {action === "login" ? (
        <a href="/api/auth/login" className="mt-6 inline-block rounded-full bg-[#1c1b19] px-5 py-2.5 text-sm text-[#f6f3ec]">
          Log in with Discogs
        </a>
      ) : null}
      {action === "retry" && onRetry ? (
        <button type="button" onClick={onRetry} className="mt-6 rounded-full bg-[#1c1b19] px-5 py-2.5 text-sm text-[#f6f3ec]">
          Try again
        </button>
      ) : null}
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill={filled ? "#1c1b19" : "none"} stroke="#1c1b19" strokeWidth="1.6">
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
    </svg>
  );
}

