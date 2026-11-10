"use client";

import { useMemo } from "react";
import { recordToVinyl, VinylTile } from "@/components/store/VinylTile";
import type { WallOrigin } from "@/components/store/WallRecordStage";
import type { CollectionRecord } from "@/lib/types";

const MOBILE_PAGE_SIZE = 6;

export function VinylCrate({
  records,
  onOpen,
  activeId = null,
}: {
  records: CollectionRecord[];
  onOpen: (id: number, origin?: WallOrigin | null) => void;
  activeId?: number | null;
}) {
  const vinyls = useMemo(() => records.map(recordToVinyl), [records]);
  const mobilePages = useMemo(() => {
    const pages: (typeof vinyls)[] = [];
    for (let index = 0; index < vinyls.length; index += MOBILE_PAGE_SIZE) {
      pages.push(vinyls.slice(index, index + MOBILE_PAGE_SIZE));
    }
    return pages;
  }, [vinyls]);

  const openFrom = (vinyl: (typeof vinyls)[number], element: HTMLElement) => {
    const sleeve = element.querySelector(".vinyl-sleeve") as HTMLElement | null;
    const rect = (sleeve ?? element).getBoundingClientRect();
    onOpen(vinyl.id, {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      tilt: 0,
    });
  };

  return (
    <div className="vinyl-crate-shell">
      <div className="vinyl-crate vinyl-crate--desktop mt-8" role="list">
        {vinyls.map((vinyl, index) => (
          <div key={vinyl.instanceId} role="listitem" className="vinyl-crate-cell">
            <VinylTile
              vinyl={vinyl}
              index={index}
              hidden={activeId === vinyl.id}
              onSelect={(item, element) => openFrom(item, element)}
            />
          </div>
        ))}
      </div>

      <div className="vinyl-crate-rail" aria-label="Records">
        {mobilePages.map((page, pageIndex) => (
          <div key={`crate-page-${pageIndex}`} className="vinyl-crate-page">
            <div className="vinyl-crate" role="list">
              {page.map((vinyl, index) => (
                <div key={vinyl.instanceId} role="listitem" className="vinyl-crate-cell">
                  <VinylTile
                    vinyl={vinyl}
                    index={pageIndex * MOBILE_PAGE_SIZE + index}
                    hidden={activeId === vinyl.id}
                    onSelect={(item, element) => openFrom(item, element)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {mobilePages.length > 1 ? (
        <p className="vinyl-crate-hint">Swipe for more · {vinyls.length} sleeves</p>
      ) : null}
    </div>
  );
}
