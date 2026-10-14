"use client";

import { useRef, useState, type ComponentProps } from "react";
import { ProjectDescription } from "@/components/projects/project-description";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/controls";

/**
 * A plain textarea with a Write / Preview switch. The textarea stays mounted (just hidden) while
 * previewing, so its text is still part of the form. The preview uses the same renderer as the
 * public page, so what is shown here is what visitors will see, including the safety rules:
 * no raw HTML and no images.
 */
export function MarkdownEditor(props: Omit<ComponentProps<typeof Textarea>, "hidden">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button type="button" variant="secondary" aria-pressed={previewText === null} onClick={() => setPreviewText(null)}>
          Write
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-pressed={previewText !== null}
          onClick={() => setPreviewText(ref.current?.value ?? "")}
        >
          Preview
        </Button>
      </div>
      <Textarea ref={ref} rows={14} hidden={previewText !== null} {...props} />
      {previewText !== null && (
        <div role="region" aria-label="Preview of the description" className="rounded-lg border border-border p-4">
          {previewText.trim() === "" ? (
            <p className="text-muted">Nothing to preview yet.</p>
          ) : (
            <ProjectDescription markdown={previewText} />
          )}
        </div>
      )}
    </div>
  );
}
