"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetchCollection, fetchMe, fetchPrices } from "@/lib/client-api";
import type { CollectionProgress, PriceInfo } from "@/lib/types";

/** Shared SWR defaults: one fetch per page load, no background refresh. */
export const oncePerLoad = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  shouldRetryOnError: false,
  dedupingInterval: 60_000 * 60,
} as const;

const priceCache: Record<number, PriceInfo> = {};
const priceDoneKeys = new Set<string>();
const priceInflight = new Map<string, Promise<Record<number, PriceInfo>>>();

function loadPricesOnce(ids: number[], username: string | null) {
  const key = `${username ?? "__session__"}:${ids.join(",")}`;
  if (priceDoneKeys.has(key)) {
    const snapshot: Record<number, PriceInfo> = {};
    for (const id of ids) {
      if (priceCache[id] !== undefined) snapshot[id] = priceCache[id];
    }
    return Promise.resolve(snapshot);
  }

  const existing = priceInflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const next: Record<number, PriceInfo> = {};
    for (const id of ids) {
      if (priceCache[id] !== undefined) next[id] = priceCache[id];
    }
    const missing = ids.filter((id) => priceCache[id] === undefined);

    for (let index = 0; index < missing.length; index += 12) {
      const chunk = missing.slice(index, index + 12);
      try {
        const fetched = await fetchPrices(chunk, username);
        Object.assign(next, fetched);
        Object.assign(priceCache, fetched);
      } catch {
        for (const id of chunk) {
          const empty = { lowest_price: null, currency: "USD", num_for_sale: 0 } satisfies PriceInfo;
          next[id] = empty;
          priceCache[id] = empty;
        }
      }
    }

    priceDoneKeys.add(key);
    priceInflight.delete(key);
    return next;
  })();

  priceInflight.set(key, task);
  return task;
}

export function useCollection(username: string | null) {
  const [progress, setProgress] = useState<CollectionProgress | null>(null);
  const swr = useSWR(
    ["collection", username ?? "__session__"],
    () => fetchCollection(username, setProgress),
    oncePerLoad,
  );
  return { ...swr, progress };
}

export function useMe() {
  return useSWR("me", fetchMe, oncePerLoad);
}

export function usePrices(ids: number[] | null, username: string | null) {
  const [prices, setPrices] = useState<Record<number, PriceInfo>>({});
  const [checked, setChecked] = useState(0);
  const key = ids?.join(",") ?? "";

  useEffect(() => {
    if (!key) return;
    const idList = key
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    let cancelled = false;
    const cached: Record<number, PriceInfo> = {};
    let have = 0;
    for (const id of idList) {
      if (priceCache[id] !== undefined) {
        cached[id] = priceCache[id];
        have += 1;
      }
    }
    setPrices(cached);
    setChecked(have);

    void loadPricesOnce(idList, username).then((next) => {
      if (cancelled) return;
      setPrices(next);
      setChecked(idList.length);
    });

    return () => {
      cancelled = true;
    };
  }, [key, username]);

  return { prices, checked, total: ids?.length ?? 0 };
}
