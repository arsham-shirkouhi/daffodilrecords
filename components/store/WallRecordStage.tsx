"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import useSWR from "swr";
import { artistLine, formatAdded, formatMoney, recordLabel } from "@/lib/browse";
import { fetchRelease, fetchStats } from "@/lib/client-api";
import { CollectionError } from "@/lib/errors";
import { fallbackCoverTheme, sampleCoverTheme } from "@/lib/vinyl-ink";
import type { CollectionRecord, ReleaseDetail } from "@/lib/types";
import { CoverImage } from "@/components/store/Sleeve";

export type WallOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
  tilt: number;
};

export function WallRecordStage({
  id,
  record,
  origin,
  onReturnStart,
  onClose,
  returnLabel = "Put back on the wall",
  pickingHint = "Picking it off the wall…",
}: {
  id: number;
  record: CollectionRecord | null;
  origin: WallOrigin | null;
  onReturnStart?: () => void;
  onClose: () => void;
  returnLabel?: string;
  pickingHint?: string;
}) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const arriveRef = useRef<HTMLDivElement>(null);
  const vinylRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const foldAnimRef = useRef<Animation | null>(null);
  const onCloseRef = useRef(onClose);
  const onReturnStartRef = useRef(onReturnStart);
  const dragRef = useRef({
    x: 0,
    y: 0,
    turnX: 0,
    turnY: 0,
    moved: false,
    down: false,
    pointerId: -1,
  });
  const openRef = useRef(false);
  const returningRef = useRef(false);
  const foldingRef = useRef(false);
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

  const [held, setHeld] = useState(false);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showingBack, setShowingBack] = useState(false);
  const [theme, setTheme] = useState(() =>
    fallbackCoverTheme(`${record?.artists[0] ?? ""}:${record?.title ?? id}`),
  );

  const cover = detail?.cover_image ?? detail?.images[0]?.uri ?? record?.cover_image ?? null;
  const label = detail ? recordLabel(detail) : record ? recordLabel(record) : "Record";
  const money = formatMoney(stats.data?.lowest_price ?? detail?.lowest_price ?? null, stats.data?.currency ?? "USD");
  const forSale = stats.data?.num_for_sale ?? detail?.num_for_sale;

  useEffect(() => {
    let cancelled = false;
    const seed = `${record?.artists[0] ?? ""}:${record?.title ?? id}`;
    void sampleCoverTheme(cover, seed).then((next) => {
      if (!cancelled) setTheme(next);
    });
    return () => {
      cancelled = true;
    };
  }, [cover, record, id]);

  const applyTurn = (turnX: number, turnY: number, snap = false) => {
    const vinyl = vinylRef.current;
    if (!vinyl) return;
    const x = Math.max(-24, Math.min(24, turnX));
    const y = Math.max(-180, Math.min(180, turnY));
    dragRef.current.turnX = x;
    dragRef.current.turnY = y;
    vinyl.classList.toggle("is-snapping", snap);
    vinyl.style.setProperty("--turn-x", `${x.toFixed(2)}deg`);
    vinyl.style.setProperty("--turn-y", `${y.toFixed(2)}deg`);
    setShowingBack(Math.abs(y) >= 90);
  };

  const resetTurn = () => {
    applyTurn(0, 0, true);
    setShowingBack(false);
  };

  const snapTurn = () => {
    const currentY = dragRef.current.turnY;
    const targetY = Math.abs(currentY) >= 90 ? (currentY >= 0 ? 180 : -180) : 0;
    applyTurn(0, targetY, true);
  };

  const putBack = () => {
    if (returningRef.current) return;
    returningRef.current = true;
    foldingRef.current = false;
    foldAnimRef.current?.cancel();
    foldAnimRef.current = null;
    if (coverRef.current) {
      coverRef.current.style.transition = "";
      coverRef.current.style.transform = "rotateY(0deg)";
      coverRef.current.style.opacity = "1";
    }
    setOpen(false);
    openRef.current = false;
    resetTurn();

    // Show the wall sleeve under the flight so it never blanks when the stage unmounts.
    onReturnStartRef.current?.();

    const arrive = arriveRef.current;
    if (arrive && origin) {
      const rect = arrive.getBoundingClientRect();
      const fromX = rect.left + rect.width / 2;
      const fromY = rect.top + rect.height / 2;
      const toX = origin.x + origin.width / 2;
      const toY = origin.y + origin.height / 2;
      const scale = Math.max(0.12, Math.min(origin.width / Math.max(rect.width, 1), 0.45));
      arrive.style.setProperty("--return-x", `${(toX - fromX).toFixed(1)}px`);
      arrive.style.setProperty("--return-y", `${(toY - fromY).toFixed(1)}px`);
      arrive.style.setProperty("--return-scale", scale.toFixed(3));
      arrive.style.setProperty("--return-rot", `${origin.tilt.toFixed(2)}deg`);
    } else if (arrive) {
      arrive.style.setProperty("--return-x", "0px");
      arrive.style.setProperty("--return-y", "18vh");
      arrive.style.setProperty("--return-scale", "0.22");
      arrive.style.setProperty("--return-rot", "-8deg");
    }

    setReturning(true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onCloseRef.current();
    };
    window.setTimeout(finish, 880);
  };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onReturnStartRef.current = onReturnStart;
  }, [onReturnStart]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useLayoutEffect(() => {
    const arrive = arriveRef.current;
    if (!arrive) return;

    const rect = arrive.getBoundingClientRect();
    const toX = rect.left + rect.width / 2;
    const toY = rect.top + rect.height / 2;

    if (origin) {
      const fromX = origin.x + origin.width / 2;
      const fromY = origin.y + origin.height / 2;
      const scale = Math.max(0.14, Math.min(origin.width / Math.max(rect.width, 1), 0.48));
      arrive.style.setProperty("--pick-x", `${(fromX - toX).toFixed(1)}px`);
      arrive.style.setProperty("--pick-y", `${(fromY - toY).toFixed(1)}px`);
      arrive.style.setProperty("--pick-scale", scale.toFixed(3));
      arrive.style.setProperty("--pick-rot", `${origin.tilt.toFixed(2)}deg`);
    } else {
      arrive.style.setProperty("--pick-x", "0px");
      arrive.style.setProperty("--pick-y", "22vh");
      arrive.style.setProperty("--pick-scale", "0.28");
      arrive.style.setProperty("--pick-rot", "-10deg");
    }

    // Next frame so the browser commits the start pose before the pick-in animation.
    const raf = window.requestAnimationFrame(() => setPicking(true));
    return () => window.cancelAnimationFrame(raf);
  }, [origin]);

  useEffect(() => {
    if (!picking) return;
    const timer = window.setTimeout(() => setHeld(true), 820);
    return () => window.clearTimeout(timer);
  }, [picking]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (returningRef.current) return;
      if (openRef.current) {
        setOpen(false);
        resetTurn();
      } else {
        putBack();
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
  }, [origin]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current.down || openRef.current || returningRef.current) return;
      if (dragRef.current.pointerId !== -1 && event.pointerId !== dragRef.current.pointerId) return;

      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;

      applyTurn(dragRef.current.turnX - dy * 0.22, dragRef.current.turnY + dx * 0.8);
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
    };

    const onUp = (event: PointerEvent) => {
      if (dragRef.current.pointerId !== -1 && event.pointerId !== dragRef.current.pointerId) return;
      const wasDragging = dragRef.current.down;
      dragRef.current.down = false;
      dragRef.current.pointerId = -1;
      if (wasDragging && !openRef.current && !returningRef.current) snapTurn();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (open || returning) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.remove("is-snapping");
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      turnX: dragRef.current.turnX,
      turnY: dragRef.current.turnY,
      moved: false,
      down: true,
      pointerId: event.pointerId,
    };
  };

  const animateFold = (nextOpen: boolean) => {
    const coverEl = coverRef.current;
    if (!coverEl || foldingRef.current) return;

    foldingRef.current = true;
    foldAnimRef.current?.cancel();

    const from = nextOpen ? "rotateY(0deg)" : "rotateY(-178deg)";
    const to = nextOpen ? "rotateY(-178deg)" : "rotateY(0deg)";

    // Commit start pose, then animate so open isn't a class-swap snap.
    coverEl.style.transition = "none";
    coverEl.style.opacity = "1";
    coverEl.style.transform = from;
    void coverEl.offsetWidth;

    const anim = coverEl.animate(
      [{ transform: from }, { transform: to }],
      {
        duration: 820,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );
    foldAnimRef.current = anim;

    setOpen(nextOpen);
    openRef.current = nextOpen;

    anim.finished
      .then(() => {
        coverEl.style.transform = to;
        coverEl.style.opacity = "1";
        coverEl.style.transition = "";
        foldingRef.current = false;
      })
      .catch(() => {
        foldingRef.current = false;
      });
  };

  const onVinylClick = () => {
    if (returning || foldingRef.current || dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    if (!open) {
      // Face the front before folding open so the flap motion is visible.
      if (Math.abs(dragRef.current.turnY) >= 90) {
        resetTurn();
        window.setTimeout(() => animateFold(true), 420);
        return;
      }
      resetTurn();
      animateFold(true);
      return;
    }

    animateFold(false);
  };

  const themeStyle = {
    ["--theme-ink" as string]: theme.ink,
    ["--theme-groove" as string]: theme.groove,
    ["--theme-paper" as string]: theme.paper,
    ["--theme-paper-deep" as string]: theme.paperDeep,
    ["--theme-accent" as string]: theme.accent,
    ["--theme-accent-soft" as string]: theme.accentSoft,
    ["--theme-text" as string]: theme.text,
    ["--theme-muted" as string]: theme.muted,
    ["--theme-glow" as string]: theme.glow,
    ["--vinyl-ink" as string]: theme.ink,
    ["--vinyl-groove" as string]: theme.groove,
  } as CSSProperties;

  return (
    <div
      ref={overlayRef}
      className={`hand-overlay${returning ? " is-returning" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={themeStyle}
    >
      <button type="button" className="hand-dim" aria-label="Put the record back" onClick={putBack} />

      <div className="hand-chrome">
        <button type="button" data-autofocus className="hand-chip" onClick={putBack}>
          {returnLabel}
        </button>
        {detail ? (
          <a href={detail.uri} target="_blank" rel="noreferrer" className="hand-link">
            View on Discogs
          </a>
        ) : null}
      </div>

      <div className={`hand-space${open ? " is-open" : ""}`}>
        <div
          ref={arriveRef}
          className={`hand-arrive${picking ? " is-picking" : ""}${open ? " is-open" : ""}${returning ? " is-returning" : ""}`}
        >
          <div className={`hand-gate-disc${open ? " is-visible" : ""}`} aria-hidden={!open}>
            <span className="hand-gate-disc-face" />
            {cover ? (
              <span
                className="hand-gate-disc-label"
                style={{ backgroundImage: `url("${cover.replace(/"/g, "%22")}")` }}
              />
            ) : (
              <span className="hand-gate-disc-label is-plain" />
            )}
          </div>

          <div
            ref={vinylRef}
            className={`hand-vinyl${open ? " is-open" : ""}`}
            onPointerDown={beginDrag}
            onDragStart={(event) => event.preventDefault()}
            onClick={onVinylClick}
            role="button"
            tabIndex={0}
            aria-label={
              open
                ? `Close ${label}`
                : showingBack
                  ? `${label} track list. Click to open.`
                  : `${label}. Drag to turn, click to open.`
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onVinylClick();
              }
            }}
          >
            <div className="hand-vinyl-inside">
              {release.error ? (
                <ErrorNote error={release.error} />
              ) : (
                <InfoPanel
                  titleId={titleId}
                  detail={detail}
                  record={record}
                  money={money}
                  forSale={forSale}
                  statsLoading={stats.isLoading}
                />
              )}
            </div>

            <div ref={coverRef} className="hand-vinyl-cover">
              <span className="hand-face hand-face-front">
                {cover ? (
                  <CoverImage src={cover} alt={label} sizes="(max-width: 900px) 85vw, 520px" priority />
                ) : (
                  <span className="skeleton-shimmer absolute inset-0" />
                )}
              </span>
              <span className="hand-face hand-face-back" aria-hidden={!open && !showingBack}>
                <div className={`hand-back-tracks${open ? " is-hidden" : ""}`}>
                  <TrackBack detail={detail} record={record} loading={release.isLoading} />
                </div>
                <div className={`hand-back-open${open ? " is-visible" : ""}`} aria-hidden={!open}>
                  <span className="hand-sleeve-liner" aria-hidden />
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="hand-hint" aria-live="polite">
        {returning
          ? "Putting it back…"
          : !held
            ? pickingHint
            : open
              ? "Click the sleeve to fold it closed"
              : showingBack
                ? "Track list · click to open"
                : "Drag to turn · click to open"}
      </p>
    </div>
  );
}

function TrackBack({
  detail,
  record,
  loading,
}: {
  detail: ReleaseDetail | undefined;
  record: CollectionRecord | null;
  loading: boolean;
}) {
  const title = detail?.title ?? record?.title ?? "…";
  const artists = detail?.artists ?? record?.artists ?? [];
  const tracks = detail?.tracklist ?? [];
  const maxTracks = 12;
  const visible = tracks.slice(0, maxTracks);
  const hidden = Math.max(0, tracks.length - visible.length);

  return (
    <div className="wall-trackback">
      <p className="wall-trackback-kicker">{artistLine(artists)}</p>
      <h3 className="wall-trackback-title">{title}</h3>
      <p className="wall-trackback-label">Track list</p>
      {loading && !detail ? (
        <p className="wall-trackback-empty">Reading the sleeve notes…</p>
      ) : !detail || tracks.length === 0 ? (
        <p className="wall-trackback-empty">No tracklist on file.</p>
      ) : (
        <>
          <ol className="wall-trackback-list">
            {visible.map((track, index) =>
              track.type === "heading" ? (
                <li key={`${track.position}-${track.title}-${index}`} className="is-heading">
                  {track.title}
                </li>
              ) : (
                <li key={`${track.position}-${track.title}-${index}`}>
                  <span>{track.position}</span>
                  <span>{track.title}</span>
                  <span>{track.duration}</span>
                </li>
              ),
            )}
          </ol>
          {hidden > 0 ? <p className="wall-trackback-more">+{hidden} more</p> : null}
        </>
      )}
    </div>
  );
}

function InfoPanel({
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
  const chips = [...(detail?.genres ?? record?.genres ?? []), ...(detail?.styles ?? record?.styles ?? [])].slice(0, 4);

  return (
    <div className="hand-info">
      <p className="hand-info-kicker">{artistLine(artists)}</p>
      <h2 id={titleId} className="hand-info-title">
        {title}
      </h2>
      <p className="hand-info-meta">
        {[year || null, detail?.country, formats || null].filter(Boolean).join(" · ")}
      </p>

      {detail?.labels[0] ? (
        <p className="hand-info-meta">
          {detail.labels[0].catno ? `${detail.labels[0].name} — ${detail.labels[0].catno}` : detail.labels[0].name}
        </p>
      ) : record?.labels[0] ? (
        <p className="hand-info-meta">{record.labels[0]}</p>
      ) : null}

      {chips.length ? (
        <div className="hand-info-chips">
          {chips.map((chip) => (
            <span key={chip} className="hand-info-chip">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      <div className="hand-info-stats">
        <Stat label="Have" value={detail ? detail.community.have.toLocaleString() : "…"} />
        <Stat label="Want" value={detail ? detail.community.want.toLocaleString() : "…"} />
        <Stat label="Lowest" value={statsLoading && !money ? "…" : money ?? "—"} />
        <Stat label="For sale" value={forSale == null ? "…" : String(forSale)} />
      </div>

      <div className="hand-info-foot">
        {record && record.rating > 0 ? (
          <p className="hand-info-kicker hand-info-rating" aria-label={`Your rating: ${record.rating} out of 5`}>
            {"★".repeat(record.rating)}
            <span className="is-empty">{"★".repeat(5 - record.rating)}</span>
          </p>
        ) : null}
        {record?.date_added ? <p className="hand-info-meta">Added {formatAdded(record.date_added)}</p> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hand-info-stat">
      <p className="hand-info-stat-label">{label}</p>
      <p className="hand-info-stat-value">{value}</p>
    </div>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  const message =
    error instanceof CollectionError
      ? error.message
      : error instanceof Error
        ? error.message
        : "This sleeve would not come off the wall.";
  return (
    <p role="alert" className="hand-info-meta">
      {message}
    </p>
  );
}
