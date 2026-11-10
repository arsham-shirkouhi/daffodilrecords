"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import useSWR from "swr";
import { artistLine, formatAdded, formatMoney, recordLabel } from "@/lib/browse";
import { fetchRelease, fetchStats } from "@/lib/client-api";
import { CollectionError } from "@/lib/errors";
import type { CollectionRecord, ReleaseDetail } from "@/lib/types";
import { CoverImage } from "@/components/store/Sleeve";
import type { ReactNode } from "react";

export function RecordModal({
  id,
  record,
  onClose,
  editor,
}: {
  id: number;
  record: CollectionRecord | null;
  onClose: () => void;
  editor?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const release = useSWR(["release", id], () => fetchRelease(id), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const stats = useSWR(["stats", id], () => fetchStats(id), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  const detail = release.data;
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialogRef.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")].filter(
        (item) => !item.hasAttribute("disabled"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  const activeImage = detail?.images[imageIndex] ?? detail?.images[0];
  const cover = activeImage?.uri ?? detail?.cover_image ?? record?.cover_image ?? null;
  const label = detail ? recordLabel(detail) : record ? recordLabel(record) : "Record";
  const price = stats.data?.lowest_price ?? detail?.lowest_price ?? null;
  const currency = stats.data?.currency ?? "USD";
  const forSale = stats.data?.num_for_sale ?? detail?.num_for_sale;
  const money = formatMoney(price, currency);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center md:items-center md:p-6">
      <button type="button" aria-label="Close record" className="absolute inset-0 bg-[#24301c]/35" onClick={onClose} />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-in relative z-10 h-full w-full overflow-y-auto bg-petal shadow-[0_30px_80px_rgba(90,70,20,0.18)] md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-[1.75rem] md:border md:border-line"
      >
        <div className="sticky top-0 z-30 flex items-center justify-between bg-petal/95 px-4 py-3 backdrop-blur md:px-6">
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-ink hover:border-leaf hover:text-leaf"
          >
            Back to the crates
          </button>
          {detail ? (
            <a
              href={detail.uri}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-leaf underline-offset-2 hover:underline"
            >
              View on Discogs
            </a>
          ) : (
            <span />
          )}
        </div>

        <div className="grid gap-8 px-4 pb-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:px-8 md:pb-12">
          <div>
            <div className="relative mx-auto w-full max-w-md">
              <motion.div
                className="vinyl-rest absolute top-[3%] left-0 aspect-square w-[64%]"
                initial={{ x: "-8%" }}
                animate={{ x: "52%" }}
                transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="vinyl-disc vinyl-spin relative h-full w-full">
                  <div
                    className="absolute inset-[31%] rounded-full bg-cover bg-center shadow-[0_0_0_5px_rgba(0,0,0,0.45)]"
                    style={{
                      backgroundImage: cover ? `url("${cover.replace(/"/g, "%22")}")` : undefined,
                      backgroundColor: "#f3d15a",
                    }}
                  />
                  <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a120c] shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" />
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(115deg,transparent_32%,rgba(255,255,255,0.16)_48%,transparent_62%)]" />
                </div>
              </motion.div>
              <div className="relative z-10 aspect-square w-[64%] overflow-hidden rounded-[2px] bg-[#f6e7a2] shadow-[10px_18px_30px_rgba(120,90,20,0.18)]">
                {release.isLoading && !cover ? (
                  <div className="skeleton-shimmer absolute inset-0" />
                ) : (
                  <CoverImage src={cover} alt={label} sizes="(max-width: 768px) 70vw, 380px" priority />
                )}
              </div>
            </div>

            {detail && detail.images.length > 1 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto" aria-label="Artwork gallery">
                {detail.images.map((image, index) => (
                  <button
                    key={image.uri}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    aria-pressed={index === imageIndex}
                    onClick={() => setImageIndex(index)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-sm ${index === imageIndex ? "ring-2 ring-amber" : "opacity-75"}`}
                  >
                    <CoverImage src={image.thumb} alt="" sizes="64px" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            {release.error ? (
              <ErrorNote error={release.error} />
            ) : (
              <>
                <Details
                  titleId={titleId}
                  detail={detail}
                  record={record}
                  money={money}
                  forSale={forSale}
                  statsLoading={stats.isLoading}
                />
                {editor}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Details({
  titleId,
  detail,
  record,
  money,
  forSale,
  statsLoading,
}: {
  titleId: string;
  detail: ReleaseDetail | undefined;
  record: CollectionRecord | null;
  money: string | null;
  forSale: number | null | undefined;
  statsLoading: boolean;
}) {
  const artists = detail?.artists ?? record?.artists ?? [];
  const title = detail?.title ?? record?.title ?? "Pulling the sleeve…";
  const year = detail?.year || record?.year || 0;
  const formats = detail?.formats || record?.formats || "";
  const genres = detail?.genres ?? record?.genres ?? [];
  const styles = detail?.styles ?? record?.styles ?? [];

  return (
    <div>
      <p className="text-sm tracking-[0.18em] text-trumpet uppercase">{artistLine(artists)}</p>
      <h2 id={titleId} className="mt-2 font-display text-4xl leading-tight text-ink">
        {title}
      </h2>
      <p className="mt-3 text-ink/75">
        {[year || null, detail?.country, formats || null].filter(Boolean).join(" · ")}
      </p>

      {detail?.labels.length ? (
        <p className="mt-2 text-sm text-ink/70">
          {detail.labels.map((label) => (label.catno ? `${label.name} — ${label.catno}` : label.name)).join(", ")}
        </p>
      ) : record?.labels.length ? (
        <p className="mt-2 text-sm text-ink/70">{record.labels.join(", ")}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {[...genres, ...styles].map((chip) => (
          <span key={chip} className="rounded-full border border-line px-3 py-1 text-xs text-ink/80">
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Have" value={detail ? detail.community.have.toLocaleString() : "…"} />
        <Stat label="Want" value={detail ? detail.community.want.toLocaleString() : "…"} />
        <Stat
          label="Lowest price"
          value={statsLoading && !money ? "Checking the bin…" : money ?? "None listed"}
        />
        <Stat label="For sale" value={forSale == null ? "…" : String(forSale)} />
      </div>

      {record && record.rating > 0 ? (
        <p className="mt-4 text-trumpet" aria-label={`Your rating: ${record.rating} out of 5`}>
          {"★".repeat(record.rating)}
          <span className="text-ink/25">{"★".repeat(5 - record.rating)}</span>
        </p>
      ) : null}
      {record?.date_added ? (
        <p className="mt-2 text-ink/70">Added {formatAdded(record.date_added)}</p>
      ) : null}

      {detail?.notes ? (
        <section className="mt-6">
          <h3 className="font-display text-xl">Liner notes</h3>
          <p className="mt-2 max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-ink/75">
            {detail.notes}
          </p>
        </section>
      ) : null}

      {detail ? (
        <section className="mt-6">
          <h3 className="font-display text-xl">Tracklist</h3>
          {detail.tracklist.length === 0 ? (
            <p className="mt-2 text-sm text-ink/60">No tracklist on file.</p>
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {detail.tracklist.map((track, index) =>
                track.type === "heading" ? (
                  <li key={`${track.position}-${track.title}-${index}`} className="py-2 font-display text-leaf">
                    {track.title}
                  </li>
                ) : (
                  <li key={`${track.position}-${track.title}-${index}`} className="flex gap-3 py-2 text-sm">
                    <span className="w-10 shrink-0 text-ink/45">{track.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{track.title}</span>
                      {track.artists.length > 0 ? (
                        <span className="block text-xs text-ink/50">{artistLine(track.artists)}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-ink/50">{track.duration}</span>
                  </li>
                ),
              )}
            </ol>
          )}
        </section>
      ) : (
        <p className="mt-8 text-ink/70" aria-live="polite">
          Sliding the record out of the sleeve…
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-amber/35 px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-ink/55 uppercase">{label}</p>
      <p className="mt-1 font-display text-lg">{value}</p>
    </div>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  const message =
    error instanceof CollectionError
      ? error.message
      : error instanceof Error
        ? error.message
        : "This sleeve would not come off the shelf.";
  return (
    <p role="alert" className="rounded-2xl border border-trumpet/30 bg-amber/40 px-4 py-3 text-trumpet">
      {message}
    </p>
  );
}
