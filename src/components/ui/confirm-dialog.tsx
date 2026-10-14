"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal confirmation built on the native <dialog>, so the browser provides the focus trap, Esc
 * to close, an inert page behind it and focus returning to the button that opened it. Put the
 * safe choice (Cancel) first in `children`: the browser focuses the first control when it opens.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border-strong bg-background p-6 text-foreground backdrop:bg-black/60"
    >
      <h2 id={titleId} className="font-serif text-2xl font-medium">
        {title}
      </h2>
      <p id={descriptionId} className="mt-3 text-muted">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">{children}</div>
    </dialog>
  );
}
