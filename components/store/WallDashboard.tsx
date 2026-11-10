"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AddRecordDialog } from "@/components/catalog/AddRecordDialog";
import { FavoritesWall } from "@/components/store/FavoritesWall";
import { PhoneTabBar } from "@/components/store/PhoneTabBar";
import { WallLoader } from "@/components/store/WallLoader";
import { WallRecordStage, type WallOrigin } from "@/components/store/WallRecordStage";
import { WallVinylSearch } from "@/components/store/WallVinylSearch";
import { useCollection, useMe } from "@/components/store/use-shop-data";
import { fetchCollection, fetchFolders, fetchWants, postJson } from "@/lib/client-api";
import { CollectionError } from "@/lib/errors";
import { pickFavoriteWalls } from "@/lib/favorites";
import { preloadWallAssets } from "@/lib/preload";
import type { CollectionRecord, SearchRelease, WantRecord } from "@/lib/types";

function collectionHref(username: string | null, hash = "") {
  const base = username ? `/store/collection?u=${encodeURIComponent(username)}` : "/store/collection";
  return hash ? `${base}${hash}` : base;
}

export function WallDashboard({
  username,
  initialRecordId,
}: {
  username: string | null;
  initialRecordId: number | null;
}) {
  const collection = useCollection(username);
  const me = useMe();
  const canAdd = Boolean(me.data) && !username;
  const folders = useSWR(canAdd ? ["folders", "__session__"] : null, () => fetchFolders(null), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const wants = useSWR(canAdd ? ["wants", "__session__"] : null, () => fetchWants(null), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const [mounted, setMounted] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0.08);
  const [openId, setOpenId] = useState<number | null>(initialRecordId);
  const [takenId, setTakenId] = useState<number | null>(initialRecordId);
  const [origin, setOrigin] = useState<WallOrigin | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const records = useMemo(() => collection.data?.records ?? [], [collection.data]);
  const wantList = useMemo(() => wants.data?.wants ?? [], [wants.data]);
  const folderList = folders.data?.folders ?? [];
  const wallCoverKey = useMemo(() => {
    return pickFavoriteWalls(records)
      .flat()
      .filter((record): record is NonNullable<typeof record> => record != null)
      .map((record) => record.cover_image ?? record.thumb ?? "")
      .join("|");
  }, [records]);
  const openRecord = records.find((record) => record.id === openId) ?? null;
  const displayName = username ?? collection.data?.username ?? me.data?.username ?? null;
  const ownedIds = useMemo(() => new Set(records.map((record) => record.id)), [records]);
  const wantedIds = useMemo(() => new Set(wantList.map((record) => record.id)), [wantList]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!collection.data || collection.error) {
      setRoomReady(false);
      setLoadProgress(0.08);
      return;
    }

    let cancelled = false;
    setRoomReady(false);
    setLoadProgress(0.12);

    const covers = wallCoverKey.split("|").filter(Boolean);

    const tick = window.setInterval(() => {
      setLoadProgress((value) => (value >= 0.9 ? value : value + 0.04));
    }, 180);

    void preloadWallAssets(covers).then(() => {
      if (cancelled) return;
      window.clearInterval(tick);
      setLoadProgress(1);
      window.setTimeout(() => {
        if (!cancelled) setRoomReady(true);
      }, 220);
    });

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [collection.data, collection.error, wallCoverKey]);

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

  const open = (id: number, nextOrigin: WallOrigin | null = null) => {
    setOrigin(nextOrigin);
    setOpenId(id);
    setTakenId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("record", String(id));
    window.history.pushState({}, "", url);
  };

  const revealOnWall = () => {
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
      setToast(message);
    } catch (error) {
      setToast(error instanceof CollectionError ? error.message : "Discogs could not save that.");
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
      setToast(message);
    } catch (error) {
      setToast(error instanceof CollectionError ? error.message : "Discogs could not update the wishlist.");
    }
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
    setAdding(false);
    await saveCollection(
      [stub, ...records.filter((record) => record.id !== release.id)],
      () => postJson("/api/collection/items", "POST", { releaseId: release.id, folderId }),
      "Filed on the shelf.",
    );
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
    await saveWant(
      [stub, ...wantList.filter((item) => item.id !== release.id)],
      () => postJson(`/api/wants/${release.id}`, "PUT"),
      "Added to the wishlist.",
    );
  };

  const collectionReady = mounted && Boolean(collection.data) && !collection.error;
  const showRoom = collectionReady && roomReady;
  const showLoader = !collection.error && (!collectionReady || !roomReady);

  return (
    <div className={`listening-shell${showLoader ? " is-loading" : ""}`}>
      {showLoader ? <WallLoader progress={collectionReady ? loadProgress : 0.18} /> : null}

      <header className={`listening-chrome${showLoader ? " is-dimmed" : ""}`}>
        <div className="listening-chrome-bar">
          <div className="listening-brand-spacer" aria-hidden />

          <WallVinylSearch
            username={username}
            ownedIds={ownedIds}
            onPick={(id) => open(id, null)}
          />

          <div className="listening-account">
            {mounted && displayName ? <span className="listening-who-inline">{displayName}</span> : null}
            {mounted && me.data ? (
              <a href="/api/auth/logout" className="listening-ghost">
                Log out
              </a>
            ) : (
              <a href="/api/auth/login" className="listening-ghost">
                Log in
              </a>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="listening-main">
        {collection.error ? (
          <div className="listening-status">
            <h1 className="font-display text-3xl">
              {collection.error instanceof CollectionError && collection.error.status === 401
                ? "The door locked itself"
                : "The room went quiet"}
            </h1>
            <p className="mt-3 text-[#6f6a62]">
              {collection.error instanceof CollectionError
                ? collection.error.message
                : "Discogs is not answering."}
            </p>
            {collection.error instanceof CollectionError && collection.error.status === 401 ? (
              <a href="/api/auth/login" className="listening-cta mt-6 inline-flex">
                Log in again
              </a>
            ) : (
              <button type="button" onClick={() => void collection.mutate()} className="listening-cta mt-6">
                Try again
              </button>
            )}
          </div>
        ) : showRoom ? (
          <FavoritesWall
            records={records}
            onOpen={open}
            activeId={takenId}
            collectionHref={collectionHref(username)}
            exploreHref={username ? `/store/explore?u=${encodeURIComponent(username)}` : "/store/explore"}
            wantlistHref={collectionHref(username, "#wishlist")}
          />
        ) : null}
      </main>

      {openId != null ? (
        <WallRecordStage
          key={openId}
          id={openId}
          record={openRecord}
          origin={origin}
          onReturnStart={revealOnWall}
          onClose={close}
        />
      ) : null}

      {adding && canAdd ? (
        <AddRecordDialog
          folders={folderList}
          ownedIds={ownedIds}
          wantedIds={wantedIds}
          initialTab="scan"
          onClose={() => setAdding(false)}
          onAdd={addRelease}
          onWant={wantRelease}
        />
      ) : null}

      {toast ? (
        <p
          role="status"
          className="store-toast fixed bottom-20 left-1/2 z-[90] max-w-sm -translate-x-1/2 rounded-full bg-[#1c1b19] px-4 py-2 text-center text-sm text-[#f6f3ec] shadow-lg"
        >
          {toast}
        </p>
      ) : null}

      <PhoneTabBar
        username={username}
        active="wall"
        canAdd={canAdd}
        onAdd={() => setAdding(true)}
      />
    </div>
  );
}
