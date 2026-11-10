"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { recordLabel } from "@/lib/browse";
import { fallbackVinylInk, sampleVinylInk } from "@/lib/vinyl-ink";
import type { CollectionRecord } from "@/lib/types";
import type { WallOrigin } from "@/components/store/WallRecordStage";
import { SleeveFace } from "@/components/store/Sleeve";

export function WallVinylFrame({
  record,
  slot,
  tilt,
  taken,
  priority,
  onOpen,
  gridColumn,
  gridRow,
}: {
  record: CollectionRecord;
  slot: number;
  tilt: number;
  taken: boolean;
  priority?: boolean;
  onOpen: (id: number, origin: WallOrigin | null) => void;
  gridColumn?: number;
  gridRow?: number;
}) {
  const frameRef = useRef<HTMLButtonElement>(null);
  const hangRef = useRef<HTMLSpanElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  const matRef = useRef<HTMLSpanElement>(null);
  const animsRef = useRef<Animation[]>([]);
  const seed = `${record.artists[0] ?? ""}:${record.title}`;
  const [ink, setInk] = useState(() => fallbackVinylInk(seed));

  useEffect(() => {
    let cancelled = false;
    void sampleVinylInk(record.cover_image ?? record.thumb, seed).then((next) => {
      if (!cancelled) setInk(next);
    });
    return () => {
      cancelled = true;
    };
  }, [record.cover_image, record.thumb, seed]);

  useEffect(() => {
    return () => {
      animsRef.current.forEach((anim) => anim.cancel());
      animsRef.current = [];
    };
  }, []);

  const playHover = (hot: boolean) => {
    const frame = frameRef.current;
    const hang = hangRef.current;
    const disc = discRef.current;
    const mat = matRef.current;
    if (!frame || !hang || !disc || mat == null) return;

    // Capture live poses before cancel — cancel alone snaps to CSS rest and kills the return.
    const frameFrom = getComputedStyle(frame).transform;
    const hangFrom = getComputedStyle(hang).transform;
    const discFrom = getComputedStyle(disc).transform;
    const matFrom = getComputedStyle(mat).transform;

    animsRef.current.forEach((anim) => {
      try {
        anim.commitStyles();
      } catch {
        /* commitStyles unavailable */
      }
      anim.cancel();
    });
    animsRef.current = [];

    const side = frame.closest(".gallery-wall-left")
      ? "left"
      : frame.closest(".gallery-wall-right")
        ? "right"
        : "back";

    // Keep hover subtle — sleeves should stay on the wall, not float far out.
    const liftZ = side === "back" ? 22 : 28;
    const discX = side === "right" ? "-22%" : "22%";
    const discRot = side === "right" ? 3 : -3;
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    const duration = 520;

    const frameTo = hot
      ? `rotate(${tilt}deg) translateZ(${liftZ}px) translateY(-4px) scale(1.03)`
      : `rotate(${tilt}deg) translateZ(0px) translateY(0px) scale(1)`;
    const hangTo = hot ? "translateZ(2px)" : "translateZ(0px)";
    // Keep the disc behind the sleeve art (negative Z); only slide it out sideways.
    const discTo = hot
      ? `translate3d(${discX}, 0, -14px) scale(0.98) rotate(${discRot}deg)`
      : "translate3d(6%, 0, -12px) scale(0.95) rotate(0deg)";
    const matTo = hot ? "translateZ(6px) rotateY(-1.5deg)" : "translateZ(4px) rotateY(0deg)";

    const orNone = (value: string, fallback: string) =>
      !value || value === "none" ? fallback : value;

    animsRef.current = [
      frame.animate([{ transform: orNone(frameFrom, frameTo) }, { transform: frameTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
      hang.animate([{ transform: orNone(hangFrom, hangTo) }, { transform: hangTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
      disc.animate([{ transform: orNone(discFrom, discTo) }, { transform: discTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
      mat.animate([{ transform: orNone(matFrom, matTo) }, { transform: matTo }], {
        duration,
        easing,
        fill: "forwards",
      }),
    ];
  };

  return (
    <button
      ref={frameRef}
      type="button"
      className={`gallery-frame${taken ? " is-taken" : ""}`}
      style={
        {
          ["--slot" as string]: slot,
          ["--tilt" as string]: `${tilt}deg`,
          ["--vinyl-ink" as string]: ink.ink,
          ["--vinyl-groove" as string]: ink.groove,
          gridColumn,
          gridRow,
        } as CSSProperties
      }
      aria-label={recordLabel(record)}
      onPointerEnter={() => playHover(true)}
      onPointerLeave={() => playHover(false)}
      onFocus={() => playHover(true)}
      onBlur={() => playHover(false)}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onOpen(record.id, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          tilt,
        });
      }}
    >
      <span ref={hangRef} className="gallery-hang">
        <span ref={discRef} className="gallery-disc" aria-hidden />
        <span ref={matRef} className="gallery-mat">
          <SleeveFace record={record} sizes="(min-width: 900px) 12vw, 28vw" priority={priority} />
        </span>
      </span>
    </button>
  );
}
