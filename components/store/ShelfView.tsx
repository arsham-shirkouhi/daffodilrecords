"use client";

import { groupShelves, recordLabel, sleeveGradient } from "@/lib/browse";
import type { CollectionRecord } from "@/lib/types";
import { focusRecordSibling } from "@/components/store/keyboard";

export function ShelfView({
  records,
  onOpen,
}: {
  records: CollectionRecord[];
  onOpen: (id: number) => void;
}) {
  const shelves = groupShelves(records);

  return (
    <div className="space-y-8">
      <p className="text-ink/75">Alphabetical, the way the bins are kept. Names that start with The are filed by the next word.</p>
      {shelves.map((shelf) => (
        <section key={shelf.letter} aria-label={`Shelf ${shelf.letter}`}>
          <h2 className="mb-2 font-display text-xl text-leaf">{shelf.letter}</h2>
          <div
            className="flex items-end gap-1 overflow-x-auto border-b-[14px] border-[#e2c15a] px-2 pt-2 pb-1 shadow-[0_12px_0_#7da85f]"
            onKeyDown={focusRecordSibling}
          >
            {shelf.records.map((record) => (
              <button
                key={record.instance_id}
                type="button"
                data-record={record.instance_id}
                className="spine relative h-52 w-9 shrink-0 overflow-hidden rounded-t-sm text-left shadow-[3px_6px_10px_rgba(0,0,0,0.35)] sm:h-60 sm:w-11"
                style={{ background: sleeveGradient(`${record.artists[0] ?? ""} ${record.title}`) }}
                aria-label={recordLabel(record)}
                onClick={() => onOpen(record.id)}
              >
                <span className="absolute inset-y-2 right-1 left-1 overflow-hidden font-display text-[11px] leading-tight text-ink [writing-mode:vertical-rl]">
                  {record.artists[0] || "Unknown"} — {record.title}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
