"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CollectionError } from "@/lib/errors";
import { searchCatalog } from "@/lib/client-api";
import type { CollectionFolder, SearchRelease } from "@/lib/types";
import { SleeveFace } from "@/components/store/Sleeve";

function looksLikeBarcode(code: string) {
  const compact = code.replace(/[\s-]/g, "");
  return /^\d{8,18}$/.test(compact);
}

export function AddRecordDialog({
  folders,
  ownedIds,
  wantedIds,
  onClose,
  onAdd,
  onWant,
  initialTab = "scan",
}: {
  folders: CollectionFolder[];
  ownedIds: Set<number>;
  wantedIds: Set<number>;
  onClose: () => void;
  onAdd: (release: SearchRelease, folderId: number) => Promise<void>;
  onWant: (release: SearchRelease) => Promise<void>;
  initialTab?: "search" | "scan";
}) {
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tab, setTab] = useState<"search" | "scan">(initialTab);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [results, setResults] = useState<SearchRelease[]>([]);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [secure, setSecure] = useState(true);
  const [folderId, setFolderId] = useState(
    () => folders.find((folder) => folder.id === 1)?.id ?? folders.find((folder) => folder.id > 0)?.id ?? 1,
  );
  const fileable = folders.filter((folder) => folder.id > 0);

  useEffect(() => {
    setSecure(window.isSecureContext);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;
    const timer = window.setTimeout(() => {
      setStatus("Looking through the racks…");
      void searchCatalog({ q: needle })
        .then((body) => {
          setResults(body.results);
          setStatus(body.results.length === 0 ? "Nothing matched that." : "");
        })
        .catch((error: unknown) => {
          setStatus(error instanceof CollectionError ? error.message : "The search could not finish.");
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const applyCodeResults = (body: Awaited<ReturnType<typeof searchCatalog>>, emptyMessage: string) => {
    setResults(body.results);
    setTab("search");
    setStatus(body.results.length === 0 ? emptyMessage : `${body.results.length} match${body.results.length === 1 ? "" : "es"} — add one to your shelf.`);
  };

  const lookupCode = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setStatus("Looking up that code…");
    const request = looksLikeBarcode(value)
      ? searchCatalog({ barcode: value.replace(/[\s-]/g, "") })
      : searchCatalog({ catno: value });
    void request
      .then((body) => {
        if (body.results.length === 0 && !looksLikeBarcode(value)) {
          return searchCatalog({ q: value }).then((fallback) =>
            applyCodeResults(fallback, "No pressing matched that code."),
          );
        }
        applyCodeResults(body, "No pressing matched that code.");
      })
      .catch((error: unknown) => {
        setStatus(error instanceof CollectionError ? error.message : "That code could not be looked up.");
      });
  };

  useEffect(() => {
    if (tab !== "scan") return;
    const video = videoRef.current;
    if (!video) return;
    if (!window.isSecureContext) return;

    let stopped = false;
    let stop: (() => void) | undefined;
    const warn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && first.includes("MultiFormatReader:")) return;
      warn(...args);
    };

    void (async () => {
      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 1200,
        });
        // Vinyl barcodes are retail 1D codes — skip QR/MicroQR noise.
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ];
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result, error) => {
          if (stopped) return;
          if (error || !result) return;
          stopped = true;
          const scanned = result.getText();
          setCode(scanned);
          lookupCode(scanned);
          controls.stop();
        });
        stop = () => controls.stop();
      } catch {
        if (!stopped) setStatus("The camera needs permission. You can type the code instead.");
      }
    })();
    return () => {
      stopped = true;
      stop?.();
      console.warn = warn;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const run = async (release: SearchRelease, task: () => Promise<void>) => {
    setBusyId(release.id);
    try {
      await task();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close add a record" className="absolute inset-0 bg-[#1c1b19]/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#fbf9f4] shadow-2xl sm:max-w-3xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-[#e6e1d6] px-5 py-4">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#a8843a] uppercase">Signed in</p>
            <h2 id={titleId} className="font-display text-3xl">
              Add to collection
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-[#6f6a62] hover:text-[#1c1b19]">
            Close
          </button>
        </div>
        <div className="flex gap-2 px-5 pt-4">
          {(["scan", "search"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-4 py-1.5 text-sm ${tab === item ? "bg-[#1c1b19] text-[#f6f3ec]" : "bg-white text-[#1c1b19]"}`}
            >
              {item === "scan" ? "Scan / enter code" : "Search"}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {tab === "search" ? (
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Album, artist, or label"
              className="h-12 w-full rounded-full border border-[#e6e1d6] bg-white px-4 outline-none"
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#6f6a62]">
                Point the camera at the barcode, or type a barcode / catalog number.
              </p>
              <video ref={videoRef} className="aspect-video w-full rounded-2xl bg-black object-cover" muted playsInline />
              {!secure ? (
                <p className="text-sm text-[#6f6a62]">
                  The camera needs a secure page. Open the shop over HTTPS, or type the code below.
                </p>
              ) : null}
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  lookupCode(code);
                }}
              >
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Barcode or catalog no."
                  inputMode="text"
                  autoCapitalize="characters"
                  className="h-11 flex-1 rounded-full border border-[#e6e1d6] bg-white px-4 outline-none"
                />
                <button type="submit" className="h-11 rounded-full bg-[#1c1b19] px-4 text-sm text-[#f6f3ec]">
                  Look up
                </button>
              </form>
            </div>
          )}
          <label className="mt-4 flex items-center gap-3 text-sm text-[#6f6a62]">
            File it in
            <select
              value={folderId}
              onChange={(event) => setFolderId(Number(event.target.value))}
              className="h-10 rounded-full border border-[#e6e1d6] bg-white px-3 text-[#1c1b19]"
            >
              {fileable.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          {status ? <p className="mt-4 text-sm text-[#6f6a62]">{status}</p> : null}
          <ul className="mt-4 space-y-3">
            {results.map((release) => {
              const owned = ownedIds.has(release.id);
              const wanted = wantedIds.has(release.id);
              return (
                <li key={release.id} className="flex gap-3 rounded-2xl border border-[#e6e1d6] bg-white p-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-[#ece7dc]">
                    <SleeveFace
                      record={{
                        artists: release.artist ? [release.artist] : [],
                        title: release.title,
                        cover_image: release.cover_image,
                        year: release.year,
                      }}
                      sizes="80px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-tight">{release.title}</p>
                    <p className="text-sm text-[#6f6a62]">{release.artist || "Unknown artist"}</p>
                    <p className="mt-1 text-xs tracking-wide text-[#8a847a] uppercase">
                      {[release.year || null, release.format, release.label, release.catno, release.country]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {owned ? (
                      <p className="mt-2 inline-block rounded-full bg-[#f3e6b0] px-2 py-0.5 text-xs">
                        Already in your collection
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === release.id || owned}
                        onClick={() => void run(release, () => onAdd(release, folderId))}
                        className="rounded-full bg-[#1c1b19] px-3 py-1.5 text-sm text-[#f6f3ec] disabled:opacity-40"
                      >
                        Add to my shelf
                      </button>
                      <button
                        type="button"
                        disabled={busyId === release.id || wanted}
                        onClick={() => void run(release, () => onWant(release))}
                        className="rounded-full border border-[#e6e1d6] px-3 py-1.5 text-sm disabled:opacity-40"
                      >
                        {wanted ? "On the wishlist" : "Add to wishlist"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
