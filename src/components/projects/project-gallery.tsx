"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { ProjectImage } from "@/lib/types";

const lightboxButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/60 px-4 text-white hover:bg-white/15 focus-visible:outline-white";

/**
 * A large lead image plus thumbnails; every image opens in a lightbox. The lightbox is a native
 * modal <dialog>, so the browser provides the focus trap, Esc to close, an inert page behind it
 * and focus returning to the image that opened it. Arrow keys move between images.
 */
export function ProjectGallery({ images, title }: { images: ProjectImage[]; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const count = images.length;

  if (count === 0) return null;

  const current = index === null ? null : images[index];

  function open(next: number) {
    setIndex(next);
    setZoomed(false);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function move(delta: number) {
    setZoomed(false);
    setIndex((i) => (i === null ? i : (i + delta + count) % count));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (count < 2) return;
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  }

  const [lead, ...rest] = images as [ProjectImage, ...ProjectImage[]];

  return (
    <section aria-label={`${title} gallery`} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => open(0)}
        className="block overflow-hidden rounded-2xl bg-surface"
      >
        <Image
          src={lead.url}
          alt={lead.alt}
          width={lead.width}
          height={lead.height}
          sizes="(min-width: 1152px) 1104px, calc(100vw - 2rem)"
          placeholder="blur"
          blurDataURL={lead.blurDataUrl}
          preload
          className="h-auto w-full"
        />
        <VisuallyHidden>Open larger view, image 1 of {count}</VisuallyHidden>
      </button>

      {rest.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {rest.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => open(i + 1)}
                className="block w-full overflow-hidden rounded-xl bg-surface"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  sizes="(min-width: 1152px) 352px, (min-width: 640px) 33vw, 50vw"
                  placeholder="blur"
                  blurDataURL={image.blurDataUrl}
                  className="aspect-[4/3] w-full object-contain"
                />
                <VisuallyHidden>
                  Open larger view, image {i + 2} of {count}
                </VisuallyHidden>
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-label={`${title} images`}
        onClose={() => setIndex(null)}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-neutral-950 p-4 text-white backdrop:bg-black sm:p-8"
      >
        {current && (
          <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p aria-live="polite" className="text-white/90">
                Image {(index ?? 0) + 1} of {count}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  aria-pressed={zoomed}
                  onClick={() => setZoomed((z) => !z)}
                  className={lightboxButton}
                >
                  Zoom
                </button>
                <a href={current.url} target="_blank" rel="noopener noreferrer" className={lightboxButton}>
                  Open original
                  <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
                </a>
                <button type="button" onClick={close} className={lightboxButton}>
                  Close
                </button>
              </div>
            </div>
            <figure className="flex min-h-0 flex-1 flex-col items-center gap-3">
              {/* Zoomed: the image shows at full resolution and the area scrolls (pan) in both directions. */}
              <div
                tabIndex={zoomed ? 0 : undefined}
                role={zoomed ? "region" : undefined}
                aria-label={zoomed ? "Zoomed image, scroll to pan" : undefined}
                className={
                  zoomed
                    ? "min-h-0 w-full flex-1 overflow-auto"
                    : "flex min-h-0 w-full flex-1 items-center justify-center"
                }
              >
                <Image
                  key={current.id}
                  src={current.url}
                  alt={current.alt}
                  width={current.width}
                  height={current.height}
                  sizes={zoomed ? `${current.width}px` : "100vw"}
                  placeholder="blur"
                  blurDataURL={current.blurDataUrl}
                  className={
                    zoomed
                      ? "h-auto max-w-none"
                      : "h-auto max-h-[70vh] w-auto max-w-full object-contain"
                  }
                  style={zoomed ? { width: current.width } : undefined}
                />
              </div>
              {(current.caption || current.credit) && (
                <figcaption className="text-center text-white/90">
                  {current.caption}
                  {current.caption && current.credit && " · "}
                  {current.credit && <span>Credit: {current.credit}</span>}
                </figcaption>
              )}
            </figure>
            {count > 1 && (
              <div className="flex justify-center gap-3">
                <button type="button" onClick={() => move(-1)} className={lightboxButton}>
                  Previous image
                </button>
                <button type="button" onClick={() => move(1)} className={lightboxButton}>
                  Next image
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
