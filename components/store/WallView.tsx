"use client";

import { artistLine } from "@/lib/browse";
import type { CollectionRecord } from "@/lib/types";
import { focusRecordSibling } from "@/components/store/keyboard";
import { RecordButton } from "@/components/store/RecordCard";

export function WallView({
  featured,
  records,
  onOpen,
}: {
  featured: CollectionRecord[];
  records: CollectionRecord[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="space-y-12">
      {featured.length > 0 ? (
        <section aria-label="New arrivals">
          <h2 className="font-display text-3xl text-ink">Just in</h2>
          <p className="mt-1 text-sm text-ink/60">The twelve most recently added from this stack.</p>
          <div
            className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6"
            onKeyDown={focusRecordSibling}
          >
            {featured.map((record, index) => (
              <figure key={record.instance_id} className="rise" style={{ animationDelay: `${index * 35}ms` }}>
                <RecordButton record={record} onOpen={onOpen} priority={index < 2} className="w-full" sizes="(max-width: 640px) 45vw, 180px" />
                <Caption record={record} />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {records.length > 0 ? (
        <section aria-label="All records on the wall">
          <h2 className="font-display text-3xl text-ink">The wall</h2>
          <div
            className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
            onKeyDown={focusRecordSibling}
          >
            {records.map((record) => (
              <figure key={record.instance_id}>
                <RecordButton record={record} onOpen={onOpen} className="w-full" sizes="(max-width: 640px) 45vw, 180px" />
                <Caption record={record} />
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Caption({ record }: { record: CollectionRecord }) {
  return (
    <figcaption className="mt-2">
      <p className="truncate font-display text-sm">{record.title}</p>
      <p className="truncate text-xs text-ink/60">{artistLine(record.artists)}</p>
    </figcaption>
  );
}
