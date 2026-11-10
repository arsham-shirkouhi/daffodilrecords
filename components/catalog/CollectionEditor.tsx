"use client";

import { useState } from "react";
import type { CollectionField, CollectionFolder, CollectionRecord } from "@/lib/types";

function fieldByName(fields: CollectionField[], pattern: RegExp) {
  return fields.find((field) => pattern.test(field.name));
}

export function CollectionEditor({
  record,
  folders,
  fields,
  wanted,
  onRate,
  onMove,
  onField,
  onRemove,
  onWant,
}: {
  record: CollectionRecord;
  folders: CollectionFolder[];
  fields: CollectionField[];
  wanted: boolean;
  onRate: (rating: number) => void;
  onMove: (folderId: number) => void;
  onField: (fieldId: number, value: string) => void;
  onRemove: () => void;
  onWant: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const media = fieldByName(fields, /media/i);
  const sleeve = fieldByName(fields, /sleeve/i);
  const notes = fieldByName(fields, /^notes$/i) ?? fieldByName(fields, /note/i);
  const noteValue = (field: CollectionField | undefined) =>
    field ? record.notes.find((note) => note.fieldId === field.id)?.value ?? "" : "";
  const fileable = folders.filter((folder) => folder.id > 0);

  return (
    <div className="mt-6 space-y-4 border-t border-[#e6e1d6] pt-5">
      <div>
        <p className="text-[11px] tracking-[0.16em] text-[#8a847a] uppercase">Your rating</p>
        <div className="mt-1 flex gap-1" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              onClick={() => onRate(record.rating === star ? 0 : star)}
              className={`text-2xl ${star <= record.rating ? "text-[#c4a15a]" : "text-[#d9d3c6]"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className="text-[11px] tracking-[0.16em] text-[#8a847a] uppercase">Folder</span>
        <select
          value={record.folder_id}
          onChange={(event) => onMove(Number(event.target.value))}
          className="mt-1 h-11 w-full rounded-full border border-[#e6e1d6] bg-white px-3"
        >
          {fileable.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      <ConditionField label="Media condition" field={media} value={noteValue(media)} onField={onField} />
      <ConditionField label="Sleeve condition" field={sleeve} value={noteValue(sleeve)} onField={onField} />
      {notes ? (
        <label className="block text-sm">
          <span className="text-[11px] tracking-[0.16em] text-[#8a847a] uppercase">Notes</span>
          <textarea
            key={`${record.instance_id}-${noteValue(notes)}`}
            defaultValue={noteValue(notes)}
            rows={3}
            onBlur={(event) => {
              if (event.target.value !== noteValue(notes)) onField(notes.id, event.target.value);
            }}
            className="mt-1 w-full rounded-2xl border border-[#e6e1d6] bg-white px-3 py-2"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onWant} className="rounded-full border border-[#e6e1d6] px-4 py-2 text-sm">
          {wanted ? "Remove from wishlist" : "Add to wishlist"}
        </button>
        {confirming ? (
          <>
            <button type="button" onClick={onRemove} className="rounded-full bg-[#1c1b19] px-4 py-2 text-sm text-[#f6f3ec]">
              Yes, take it off the shelf
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-4 py-2 text-sm text-[#6f6a62]">
              Keep it
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-full px-4 py-2 text-sm text-[#8a4b3a]">
            Remove from collection
          </button>
        )}
      </div>
    </div>
  );
}

function ConditionField({
  label,
  field,
  value,
  onField,
}: {
  label: string;
  field: CollectionField | undefined;
  value: string;
  onField: (fieldId: number, value: string) => void;
}) {
  if (!field) return null;
  if (field.options.length > 0) {
    return (
      <label className="block text-sm">
        <span className="text-[11px] tracking-[0.16em] text-[#8a847a] uppercase">{label}</span>
        <select
          value={value}
          onChange={(event) => onField(field.id, event.target.value)}
          className="mt-1 h-11 w-full rounded-full border border-[#e6e1d6] bg-white px-3"
        >
          <option value="">Not set</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <span className="text-[11px] tracking-[0.16em] text-[#8a847a] uppercase">{label}</span>
      <input
        key={`${field.id}-${value}`}
        defaultValue={value}
        onBlur={(event) => {
          if (event.target.value !== value) onField(field.id, event.target.value);
        }}
        className="mt-1 h-11 w-full rounded-full border border-[#e6e1d6] bg-white px-3"
      />
    </label>
  );
}
