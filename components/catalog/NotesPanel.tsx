"use client";

import { useState } from "react";
import { CollectionError } from "@/lib/errors";
import { postJson } from "@/lib/client-api";
import type { CollectionFolder } from "@/lib/types";

export function NotesPanel({
  folders,
  canEdit,
  onChanged,
  onToast,
}: {
  folders: CollectionFolder[];
  canEdit: boolean;
  onChanged: () => Promise<unknown>;
  onToast: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const visible = folders.filter((folder) => folder.id !== 0);

  const save = async (task: () => Promise<unknown>, ok: string) => {
    try {
      await task();
      await onChanged();
      onToast(ok);
    } catch (error) {
      onToast(error instanceof CollectionError ? error.message : "Discogs could not save that folder.");
    }
  };

  return (
    <section className="notes-panel mx-auto max-w-2xl py-8">
      <p className="text-xs tracking-[0.22em] text-[#8a847a] uppercase">Little notes</p>
      <h2 className="notes-panel-title mt-2 font-display text-4xl">The shelves she keeps.</h2>
      <p className="notes-panel-copy mt-3 max-w-xl text-[#6f6a62]">
        Folders are the crates on Discogs. Rename one, make a new one, or clear out an empty shelf.
      </p>
      <ul className="mt-8 divide-y divide-[#e6e1d6] border-y border-[#e6e1d6]">
        {visible.map((folder) => {
          const locked = folder.id === 1 || !canEdit;
          return (
            <li key={folder.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {locked ? (
                  <p className="font-display text-2xl">{folder.name}</p>
                ) : (
                  <input
                    value={drafts[folder.id] ?? folder.name}
                    onChange={(event) => setDrafts((current) => ({ ...current, [folder.id]: event.target.value }))}
                    className="w-full bg-transparent font-display text-2xl outline-none"
                  />
                )}
                <p className="text-sm text-[#8a847a]">{folder.count} {folder.count === 1 ? "record" : "records"}</p>
              </div>
              {canEdit && folder.id !== 1 ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = (drafts[folder.id] ?? folder.name).trim();
                      if (!next || next === folder.name) return;
                      void save(() => postJson(`/api/folders/${folder.id}`, "POST", { name: next }), "Folder renamed.");
                    }}
                    className="rounded-full border border-[#e6e1d6] px-3 py-1.5 text-sm"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void save(() => postJson(`/api/folders/${folder.id}`, "DELETE"), "Folder put away.")}
                    className="rounded-full px-3 py-1.5 text-sm text-[#8a4b3a]"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            if (!next) return;
            void save(async () => {
              await postJson("/api/folders", "POST", { name: next });
              setName("");
            }, "A new folder is on the shelf.");
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New folder name"
            className="h-12 flex-1 rounded-full border border-[#e6e1d6] bg-white px-4 outline-none"
          />
          <button type="submit" className="h-12 rounded-full bg-[#1c1b19] px-5 text-sm text-[#f6f3ec]">
            Create folder
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-[#6f6a62]">Log in with Discogs to rearrange the folders.</p>
      )}
    </section>
  );
}
