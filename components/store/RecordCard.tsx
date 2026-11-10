"use client";

import { recordLabel } from "@/lib/browse";
import type { CollectionRecord } from "@/lib/types";
import { SleeveFace } from "@/components/store/Sleeve";

export function RecordButton({
  record,
  onOpen,
  priority = false,
  className = "w-[9.25rem] sm:w-[10.5rem]",
  sizes = "(max-width: 640px) 42vw, 180px",
}: {
  record: CollectionRecord;
  onOpen: (id: number) => void;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <button
      type="button"
      data-record={record.instance_id}
      aria-label={recordLabel(record)}
      onClick={() => onOpen(record.id)}
      className={`record-lift relative aspect-square shrink-0 overflow-hidden rounded-[3px] bg-[#f6e7a2] shadow-[8px_16px_24px_rgba(140,110,30,0.16),inset_0_0_0_1px_rgba(255,255,255,0.5)] ${className}`}
    >
      <SleeveFace record={record} priority={priority} sizes={sizes} />
    </button>
  );
}
