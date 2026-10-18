"use client";

import { Photo } from "@/lib/types";

export default function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
  onDelete,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete?: () => void;
}) {
  const photo = photos[index];
  if (!photo) return null;
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.caption || "Trip photo"}
          className="max-h-[80dvh] w-full rounded-2xl object-contain"
        />
        {photo.caption ? (
          <p className="mt-3 text-center text-sm text-sand">{photo.caption}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-paper/10 px-3 py-2 text-sm"
            onClick={onPrev}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg bg-paper/10 px-3 py-2 text-sm"
            onClick={onNext}
          >
            Next
          </button>
          {onDelete ? (
            <button
              type="button"
              className="rounded-lg bg-copper/30 px-3 py-2 text-sm"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg bg-paper/10 px-3 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
