"use client";

import type { BrowseFilters, ShopView, SortKey } from "@/lib/browse";

const VIEWS: { id: ShopView; label: string }[] = [
  { id: "crates", label: "Crates" },
  { id: "wall", label: "Wall" },
  { id: "shelves", label: "Shelves" },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "added", label: "Newest added" },
  { id: "artist", label: "Artist A–Z" },
  { id: "year", label: "Year" },
  { id: "price", label: "Price" },
];

export function ViewToggle({ view, onChange }: { view: ShopView; onChange: (view: ShopView) => void }) {
  return (
    <div role="radiogroup" aria-label="Shop view" className="inline-flex rounded-full bg-[#f6e7b0] p-1">
      {VIEWS.map((item) => {
        const selected = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm sm:px-4 ${selected ? "bg-leaf font-semibold text-white" : "text-ink/75 hover:text-ink"}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  genres,
  styles,
  decades,
  formats,
  shown,
  total,
  onDig,
  onClear,
  showClear,
  canDig,
}: {
  filters: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
  genres: string[];
  styles: string[];
  decades: string[];
  formats: string[];
  shown: number;
  total: number;
  onDig: () => void;
  onClear: () => void;
  showClear: boolean;
  canDig: boolean;
}) {
  const set = (patch: Partial<BrowseFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-line bg-[#fff8ea]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1 text-[11px] tracking-[0.16em] text-ink/60 uppercase sm:col-span-2">
            Search
            <input
              type="search"
              value={filters.query}
              onChange={(event) => set({ query: event.target.value })}
              placeholder="Title, artist, or label"
              className="field-control"
            />
          </label>
          <Select label="Genre" value={filters.genre} onChange={(genre) => set({ genre })} options={genres} all="All genres" />
          <Select label="Style" value={filters.style} onChange={(style) => set({ style })} options={styles} all="All styles" />
          <Select label="Decade" value={filters.decade} onChange={(decade) => set({ decade })} options={decades} all="All decades" />
          <Select label="Format" value={filters.format} onChange={(format) => set({ format })} options={formats} all="All formats" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="grid gap-1 text-[11px] tracking-[0.16em] text-ink/60 uppercase">
            Sort
            <select
              value={filters.sort}
              onChange={(event) => set({ sort: event.target.value as SortKey })}
              className="field-control"
            >
              {SORTS.map((sort) => (
                <option key={sort.id} value={sort.id}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onDig}
            disabled={!canDig}
            className="mt-5 h-10 rounded-full bg-amber px-4 text-sm font-semibold text-ink hover:bg-[#ffe58a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dig for something
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink/70">
        <p aria-live="polite">
          Showing {shown} of {total} {total === 1 ? "record" : "records"}.
        </p>
        {showClear ? (
          <button type="button" onClick={onClear} className="text-leaf underline-offset-2 hover:underline">
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  all: string;
}) {
  return (
    <label className="grid gap-1 text-[11px] tracking-[0.16em] text-ink/60 uppercase">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      >
        <option value="all">{all}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
