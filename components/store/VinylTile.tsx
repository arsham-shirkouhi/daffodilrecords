"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useVinylHover } from "@/components/store/useVinylHover";
import { artistLine, recordLabel } from "@/lib/browse";
import { canOptimizeImage } from "@/lib/images";
import type { CollectionRecord } from "@/lib/types";
import { fallbackVinylInk, sampleVinylInk } from "@/lib/vinyl-ink";

export interface VinylData {
  id: number;
  instanceId: number;
  title: string;
  artist: string;
  album: string;
  art: string | null;
  ink: string;
  year?: number;
}

export function recordToVinyl(record: CollectionRecord): VinylData {
  const artist = artistLine(record.artists);
  return {
    id: record.id,
    instanceId: record.instance_id,
    title: record.title,
    artist,
    album: record.title,
    art: record.cover_image ?? record.thumb,
    ink: fallbackVinylInk(`${artist}:${record.title}`).ink,
    year: record.year || undefined,
  };
}

export function VinylTile({
  vinyl,
  index,
  hidden = false,
  onSelect,
  tileRef,
}: {
  vinyl: VinylData;
  index: number;
  hidden?: boolean;
  onSelect: (vinyl: VinylData, element: HTMLElement) => void;
  tileRef?: (node: HTMLElement | null) => void;
}) {
  const [ink, setInk] = useState(() => fallbackVinylInk(`${vinyl.artist}:${vinyl.title}`, vinyl.ink));
  const { frameRef, hangRef, discRef, matRef, hoverProps } = useVinylHover(0);

  useEffect(() => {
    let cancelled = false;
    void sampleVinylInk(vinyl.art, `${vinyl.artist}:${vinyl.title}`, vinyl.ink).then((next) => {
      if (!cancelled) setInk(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vinyl.art, vinyl.artist, vinyl.title, vinyl.ink]);

  return (
    <button
      type="button"
      ref={(node) => {
        frameRef.current = node;
        tileRef?.(node);
      }}
      data-vinyl-id={vinyl.instanceId}
      aria-label={recordLabel({ artists: [vinyl.artist], title: vinyl.title })}
      className={`vinyl-tile${hidden ? " is-flying" : ""}`}
      style={
        {
          ["--i" as string]: index,
          ["--vinyl-ink" as string]: ink.ink,
          ["--vinyl-groove" as string]: ink.groove,
          visibility: hidden ? "hidden" : "visible",
        } as CSSProperties
      }
      {...hoverProps}
      onClick={(event) => onSelect(vinyl, event.currentTarget)}
    >
      <span ref={hangRef} className="vinyl-hang">
        <span ref={discRef} className="vinyl-disc" aria-hidden />
        <span ref={matRef} className="vinyl-sleeve relative">
          <SleeveArt art={vinyl.art} title={vinyl.title} artist={vinyl.artist} />
        </span>
      </span>
      <span className="vinyl-meta">
        <span className="vinyl-title">{vinyl.title}</span>
        <span className="vinyl-artist">
          {vinyl.artist}
          {vinyl.year ? ` · ${vinyl.year}` : ""}
        </span>
      </span>
    </button>
  );
}

function SleeveArt({ art, title, artist }: { art: string | null; title: string; artist: string }) {
  const [failed, setFailed] = useState(false);
  const alt = `${artist} – ${title}`;

  if (!art || failed) {
    return (
      <span className="vinyl-sleeve-fallback" aria-hidden>
        {title}
      </span>
    );
  }

  if (!canOptimizeImage(art)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={art} alt={alt} className="vinyl-art" loading="lazy" onError={() => setFailed(true)} />
    );
  }

  return (
    <Image
      src={art}
      alt={alt}
      fill
      sizes="(max-width: 768px) 45vw, 280px"
      className="vinyl-art object-cover"
      onError={() => setFailed(true)}
    />
  );
}
