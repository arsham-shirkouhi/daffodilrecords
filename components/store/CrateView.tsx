"use client";

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { groupCrates } from "@/lib/browse";
import type { CollectionRecord } from "@/lib/types";
import { focusRecordSibling } from "@/components/store/keyboard";
import { RecordButton } from "@/components/store/RecordCard";

export function CrateView({
  records,
  genre,
  onOpen,
}: {
  records: CollectionRecord[];
  genre: string;
  onOpen: (id: number) => void;
}) {
  const crates = groupCrates(records, genre);

  return (
    <div className="space-y-10">
      <p className="sr-only">Use the left and right arrow keys to move between records. Press Enter to pull one out.</p>
      {crates.map((crate, index) => (
        <Crate key={crate.genre} crate={crate} index={index} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Crate({
  crate,
  index,
  onOpen,
}: {
  crate: { genre: string; records: CollectionRecord[] };
  index: number;
  onOpen: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, scroll: 0, moved: false });
  const label = crate.records.length === 1 ? "1 record" : `${crate.records.length} records`;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { down: true, startX: event.clientX, scroll: el.scrollLeft, moved: false };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !drag.current.down) return;
    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    el.scrollLeft = drag.current.scroll - dx;
  };

  const onPointerUp = () => {
    drag.current.down = false;
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  };

  return (
    <section className="rise" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }} aria-label={`${crate.genre} crate`}>
      <div className="relative z-10 -mb-2 ml-4 w-fit -rotate-2 rounded-sm border border-line bg-petal px-4 py-2 text-ink shadow-[0_10px_18px_rgba(160,120,30,0.16)] sm:ml-8">
        <h2 className="font-display text-2xl leading-none sm:text-3xl">{crate.genre}</h2>
        <p className="mt-1 text-sm leading-none text-leaf">{label}</p>
      </div>
      <div className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-b from-[#ffe98a] via-[#f6d34a] to-[#e8bc3a] shadow-[0_18px_32px_rgba(180,140,40,0.22)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 11px, rgba(255,255,255,0.28) 11px 13px)",
          }}
        />
        <div
          ref={scrollRef}
          className="crate-scroll relative flex cursor-grab items-end gap-3 overflow-x-auto px-4 pt-12 pb-3 select-none active:cursor-grabbing sm:px-6"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          onKeyDown={focusRecordSibling}
        >
          {crate.records.map((record, recordIndex) => (
            <RecordButton
              key={record.instance_id}
              record={record}
              onOpen={onOpen}
              priority={index === 0 && recordIndex < 4}
            />
          ))}
        </div>
        <div className="relative z-20 h-5 bg-gradient-to-b from-[#7da85f] to-[#3f6b38] shadow-[inset_0_6px_8px_rgba(36,48,28,0.18)]" />
      </div>
    </section>
  );
}
