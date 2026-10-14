"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

/**
 * Uses a native modal <dialog>: the browser provides the focus trap, Esc to close,
 * inert background and focus return to the trigger.
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <div className="md:hidden">
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={show}
      >
        Menu
      </Button>
      <dialog
        ref={dialogRef}
        id="mobile-nav"
        aria-label="Main menu"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // Clicks on the backdrop target the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-background p-6 text-foreground backdrop:bg-black/50"
      >
        <div className="flex justify-end">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
        <nav aria-label="Main">
          <NavLinks
            className="mt-6 flex flex-col gap-2"
            linkClassName="font-display text-3xl"
            onNavigate={close}
          />
        </nav>
      </dialog>
    </div>
  );
}
