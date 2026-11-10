"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import {
  WALL_CAPS,
  WALL_COLS,
  WALL_FEATURES,
  WALL_ROWS,
  pickFavoriteWalls,
  reservedSlotsForWall,
} from "@/lib/favorites";
import type { CollectionRecord } from "@/lib/types";
import type { WallOrigin } from "@/components/store/WallRecordStage";
import { WallVinylFrame } from "@/components/store/WallVinylFrame";

const WALL_META = [
  { key: "left", label: "Left wall" },
  { key: "back", label: "Back wall" },
  { key: "right", label: "Right wall" },
] as const;

export function FavoritesWall({
  records,
  onOpen,
  activeId = null,
  collectionHref,
  exploreHref,
  wantlistHref,
}: {
  records: CollectionRecord[];
  onOpen: (id: number, origin: WallOrigin | null) => void;
  activeId?: number | null;
  collectionHref: string;
  exploreHref: string;
  wantlistHref: string;
}) {
  const walls = useMemo(() => pickFavoriteWalls(records), [records]);
  const mobileRecords = useMemo(
    () => walls.flat().filter((record): record is CollectionRecord => record != null),
    [walls],
  );
  const mobilePages = useMemo(() => {
    const size = 6;
    const pages: CollectionRecord[][] = [];
    for (let index = 0; index < mobileRecords.length; index += size) {
      pages.push(mobileRecords.slice(index, index + size));
    }
    return pages;
  }, [mobileRecords]);
  const count = mobileRecords.length;

  if (count === 0) {
    return (
      <div className="listening-status">
        <h1 className="font-display text-3xl">Empty walls</h1>
        <p className="mt-3 max-w-md text-[#6f6a62]">
          Rate a few records 4 or 5 stars and they hang here. Until then, your newest sleeves fill the room once they load.
        </p>
      </div>
    );
  }

  return (
    <div className="wall-room">
      {/* Phone app shelf — shown only on small screens */}
      <div className="wall-mobile">
        <div className="wall-mobile-rail" aria-label="Records">
          {mobilePages.map((page, pageIndex) => (
            <div key={`page-${pageIndex}`} className="wall-mobile-page">
              <div className="wall-mobile-grid">
                {page.map((record, index) => {
                  const slot = pageIndex * 6 + index;
                  return (
                    <div key={`mobile-${record.instance_id}`} className="wall-mobile-cell">
                      <WallVinylFrame
                        record={record}
                        slot={slot}
                        tilt={0}
                        taken={activeId === record.id}
                        priority={slot < 6}
                        onOpen={onOpen}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {mobilePages.length > 1 ? (
          <p className="wall-mobile-hint">Swipe · {count}</p>
        ) : null}
      </div>

      {/* Desktop 3D room */}
      <div className="wall-stage">
        <div className="wall-ceiling" aria-hidden />
        <div className="wall-floor" aria-hidden />

        {walls.map((wall, wallIndex) => {
          const meta = WALL_META[wallIndex];
          const slots = WALL_CAPS[wallIndex] ?? 9;
          const cols = WALL_COLS[wallIndex] ?? 3;
          const rows = WALL_ROWS[wallIndex] ?? 3;
          const reserved = reservedSlotsForWall(wallIndex);
          const feature =
            wallIndex === 0 ? WALL_FEATURES.left : wallIndex === 2 ? WALL_FEATURES.right : null;

          return (
            <section
              key={meta.key}
              className={`gallery-wall gallery-wall-${meta.key}`}
              aria-label={meta.label}
            >
              <div className="gallery-wall-face">
                <div className="gallery-wall-paper" aria-hidden />
                {feature?.kind === "door" || feature?.kind === "window" ? (
                  <div
                    className={`gallery-feature gallery-feature-${feature.kind}`}
                    aria-hidden
                  >
                    <img
                      src={feature.src}
                      alt=""
                      className="gallery-feature-img"
                      draggable={false}
                    />
                  </div>
                ) : null}
                <div
                  className="gallery-wall-grid"
                  style={
                    {
                      ["--wall-cols" as string]: cols,
                      ["--wall-rows" as string]: rows,
                    } as CSSProperties
                  }
                >
                  {Array.from({ length: slots }, (_, slot) => {
                    if (reserved.has(slot)) return null;
                    const gridColumn = (slot % cols) + 1;
                    const gridRow = Math.floor(slot / cols) + 1;
                    const record = wall[slot];
                    if (!record) {
                      return (
                        <div
                          key={`empty-${meta.key}-${slot}`}
                          className="gallery-frame is-empty"
                          style={
                            {
                              ["--slot" as string]: slot,
                              gridColumn,
                              gridRow,
                            } as CSSProperties
                          }
                          aria-hidden
                        />
                      );
                    }
                    const tilt = ((slot % cols) - 1) * 1.2;
                    return (
                      <WallVinylFrame
                        key={record.instance_id}
                        record={record}
                        slot={slot}
                        tilt={tilt}
                        taken={activeId === record.id}
                        priority={wallIndex === 1 && slot < 6}
                        gridColumn={gridColumn}
                        gridRow={gridRow}
                        onOpen={onOpen}
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="wall-floor-props">
        <div className="wall-prop wall-prop-pot" aria-hidden>
          <img
            src="/room/daffodil-pot.png"
            alt=""
            className="wall-prop-pot-img"
            width={492}
            height={958}
            draggable={false}
          />
        </div>

        <Link href={wantlistHref} className="wall-prop wall-prop-turntable" aria-label="Wantlist">
          <img
            src="/room/turntable.png"
            alt=""
            className="wall-prop-turntable-img"
            width={1024}
            height={935}
            draggable={false}
          />
          <span className="wall-prop-caption">
            <span className="wall-prop-kicker">Spin next</span>
            <span className="wall-prop-title">Wantlist</span>
          </span>
        </Link>

        <Link href={collectionHref} className="wall-prop wall-prop-boxes">
          <img
            src="/room/record-boxes.png"
            alt=""
            className="wall-prop-boxes-img"
            width={819}
            height={748}
            draggable={false}
          />
          <span className="wall-prop-caption">
            <span className="wall-prop-kicker">Browse</span>
            <span className="wall-prop-title">Your collection</span>
          </span>
        </Link>

        <Link href={exploreHref} className="wall-prop wall-prop-laptop">
          <img
            src="/room/laptop.png"
            alt=""
            className="wall-prop-laptop-img"
            width={1024}
            height={682}
            draggable={false}
          />
          <span className="wall-prop-caption">
            <span className="wall-prop-kicker">Discover</span>
            <span className="wall-prop-title">Explore Discogs</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
