"use client";

import Image from "next/image";
import { useState } from "react";
import { artistLine, sleeveGradient } from "@/lib/browse";
import { canOptimizeImage } from "@/lib/images";
import type { CollectionRecord } from "@/lib/types";

export function SleeveFace({
  record,
  priority = false,
  sizes = "180px",
}: {
  record: Pick<CollectionRecord, "artists" | "title" | "cover_image" | "year">;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cover = record.cover_image;
  const alt = `${artistLine(record.artists)} – ${record.title}`;

  if (!cover || failed) {
    return <Placeholder record={record} />;
  }

  if (!canOptimizeImage(cover)) {
    return (
      // Discogs occasionally serves art from a host outside the image allowlist.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cover} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
    );
  }

  return (
    <Image
      src={cover}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function Placeholder({
  record,
}: {
  record: Pick<CollectionRecord, "artists" | "title" | "year">;
}) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex flex-col justify-between p-3 text-left"
      style={{ background: sleeveGradient(`${record.artists[0] ?? ""} ${record.title}`) }}
    >
      <p className="line-clamp-4 font-display text-sm leading-tight text-ink sm:text-base">{record.title}</p>
      <div>
        <p className="line-clamp-2 text-[11px] tracking-wide text-ink/75 uppercase">{artistLine(record.artists)}</p>
        {record.year ? <p className="mt-1 text-[11px] text-ink/60">{record.year}</p> : null}
      </div>
    </div>
  );
}

export function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center p-6 text-center font-display text-2xl text-ink"
        style={{ background: sleeveGradient(alt) }}
      >
        {alt}
      </div>
    );
  }
  if (!canOptimizeImage(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      draggable={false}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
