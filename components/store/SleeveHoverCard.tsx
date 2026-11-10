"use client";

import type { CSSProperties, ReactNode } from "react";
import { useVinylHover } from "@/components/store/useVinylHover";
import type { WallOrigin } from "@/components/store/WallRecordStage";
import { SleeveFace } from "@/components/store/Sleeve";
import type { CollectionRecord } from "@/lib/types";
import { fallbackVinylInk } from "@/lib/vinyl-ink";

/** Collection / wishlist sleeve with the same hover lift + disc slide as the wall. */
export function SleeveHoverCard({
  record,
  taken = false,
  sizes = "240px",
  onOpen,
  children,
}: {
  record: CollectionRecord;
  taken?: boolean;
  sizes?: string;
  onOpen: (id: number, origin?: WallOrigin | null) => void;
  children?: ReactNode;
}) {
  const seed = `${record.artists[0] ?? ""}:${record.title}`;
  const ink = fallbackVinylInk(seed);
  const { frameRef, hangRef, discRef, matRef, hoverProps } = useVinylHover(0);

  return (
    <button
      type="button"
      ref={(node) => {
        frameRef.current = node;
      }}
      className={`sleeve-hover-card${taken ? " is-taken" : ""}`}
      style={
        {
          ["--vinyl-ink" as string]: ink.ink,
          ["--vinyl-groove" as string]: ink.groove,
        } as CSSProperties
      }
      {...hoverProps}
      onClick={(event) => {
        const target = event.currentTarget.querySelector(".sleeve-hover-mat") ?? event.currentTarget;
        const rect = target.getBoundingClientRect();
        onOpen(record.id, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          tilt: 0,
        });
      }}
    >
      <span ref={hangRef} className="sleeve-hover-hang">
        <span ref={discRef} className="sleeve-hover-disc" aria-hidden />
        <span ref={matRef} className="sleeve-hover-mat">
          <SleeveFace record={record} sizes={sizes} />
        </span>
      </span>
      {children}
    </button>
  );
}
