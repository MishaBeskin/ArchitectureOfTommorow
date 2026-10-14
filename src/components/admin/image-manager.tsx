"use client";

import Image from "next/image";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { IMAGE_ACCEPT, IMAGE_LIMITS } from "@/lib/image-rules";
import { uploadOriginal, type UploadOutcome } from "@/lib/upload-client";
import type { ImageActionState } from "@/server/admin/handle-image";

export interface ManagedImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
  blurDataUrl: string;
}

export type ImageCardAction = (previous: ImageActionState, formData: FormData) => Promise<ImageActionState>;
export type AttachImage = (
  projectId: string,
  tempPath: string,
  fields: { alt: string; caption: string; credit: string },
) => Promise<ImageActionState>;

const IDLE: ImageActionState = { status: "idle" };

interface AttachRequest {
  path: string;
  alt: string;
  caption: string;
  credit: string;
}

/** What the "Add an image" form shows after a try, whichever step it ended at. */
type UploadMessage = { kind: "done" | "error"; message: string; altError?: string };

export function ImageManager({
  projectId,
  images,
  coverImageId,
  action,
  attach,
  upload = uploadOriginal,
}: {
  projectId: string;
  images: ManagedImage[];
  coverImageId: string | null;
  action: ImageCardAction;
  attach: AttachImage;
  /** The browser-to-storage step. Replaceable so tests need no network. */
  upload?: (projectId: string, file: File) => Promise<UploadOutcome>;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [deleting, setDeleting] = useState<{ image: ManagedImage; number: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<{ message: string; altError?: string } | null>(null);
  // The server step runs through useActionState so it is a transition: the page refresh that follows
  // keeps this component mounted. Outside a transition the refresh can swap in the loading
  // placeholder, which would throw away the confirmation message.
  const [attachState, attachDispatch, attaching] = useActionState(
    async (_previous: ImageActionState, request: AttachRequest): Promise<ImageActionState> => {
      try {
        return await attach(projectId, request.path, {
          alt: request.alt,
          caption: request.caption,
          credit: request.credit,
        });
      } catch {
        return { status: "error", message: "Something went wrong. Please try again." };
      }
    },
    IDLE,
  );
  const cardMessageRef = useRef<HTMLDivElement>(null);
  const uploadMessageRef = useRef<HTMLDivElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const working = uploading || attaching;

  const uploadMessage: UploadMessage | null = clientError
    ? { kind: "error", ...clientError }
    : attachState.status === "success"
      ? { kind: "done", message: attachState.message }
      : attachState.status === "error"
        ? { kind: "error", message: attachState.message, altError: attachState.errors?.alt }
        : null;

  // Move focus to the outcome: after a delete or a move, the button that was pressed may be gone.
  useEffect(() => {
    if (state.status !== "idle") cardMessageRef.current?.focus();
  }, [state]);
  useEffect(() => {
    if (clientError || attachState.status !== "idle") uploadMessageRef.current?.focus();
  }, [clientError, attachState]);
  useEffect(() => {
    if (attachState.status === "success") uploadFormRef.current?.reset();
  }, [attachState]);

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => (typeof data.get(name) === "string" ? (data.get(name) as string) : "");
    const file = (form.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];

    if (!file || file.size === 0) {
      setClientError({ message: "Choose an image file first." });
      return;
    }
    if (text("alt").trim() === "") {
      setClientError({
        message: "Fix the problem below and upload again.",
        altError: "Describe the image for people who cannot see it.",
      });
      return;
    }

    setClientError(null);
    setUploading(true);
    let sent: UploadOutcome;
    try {
      sent = await upload(projectId, file);
    } catch {
      sent = { ok: false, message: "Something went wrong. Please try again." };
    }
    setUploading(false);
    if (!sent.ok) {
      setClientError({ message: sent.message });
      return;
    }
    startTransition(() =>
      attachDispatch({ path: sent.path, alt: text("alt"), caption: text("caption"), credit: text("credit") }),
    );
  }

  const imageError = state.status === "error" && state.imageId ? state : null;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="images-heading">
      <h2 id="images-heading" className="border-b border-border pb-2 font-display text-2xl">
        Images ({images.length})
      </h2>

      {state.status !== "idle" && (
        <div
          ref={cardMessageRef}
          tabIndex={-1}
          role={state.status === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border-2 p-4 font-medium",
            state.status === "error" ? "border-danger text-danger" : "border-border-strong",
          )}
        >
          {state.message}
        </div>
      )}

      {images.length === 0 ? (
        <p className="rounded-xl border border-border p-6 text-muted">No images yet. Add the first one below.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {images.map((image, index) => {
            const number = index + 1;
            const isCover = image.id === coverImageId;
            const errors = imageError?.imageId === image.id ? imageError.errors : undefined;
            return (
              <li key={image.id} className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row">
                <div className="shrink-0 sm:w-56">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    placeholder="blur"
                    blurDataURL={image.blurDataUrl}
                    sizes="224px"
                    className="h-auto w-full rounded-lg"
                  />
                  {isCover && <p className="mt-2 font-medium">Cover image</p>}
                </div>
                <form action={formAction} noValidate className="flex flex-1 flex-col gap-3">
                  <input type="hidden" name="imageId" value={image.id} />
                  <Field
                    label={`Image ${number} description`}
                    required
                    error={errors?.alt}
                    hint="Alt text, read aloud by screen readers."
                  >
                    {(c) => <Input name="alt" defaultValue={image.alt} {...c} />}
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={`Image ${number} caption`} error={errors?.caption}>
                      {(c) => <Input name="caption" defaultValue={image.caption ?? ""} {...c} />}
                    </Field>
                    <Field label={`Image ${number} credit`} error={errors?.credit}>
                      {(c) => <Input name="credit" defaultValue={image.credit ?? ""} {...c} />}
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* First submit button: it is what Enter in a text box presses. */}
                    <Button
                      type="submit"
                      name="intent"
                      value="save"
                      disabled={pending}
                      aria-label={`Save details of image ${number}`}
                    >
                      Save details
                    </Button>
                    <Button
                      type="submit"
                      name="intent"
                      value="up"
                      variant="secondary"
                      disabled={pending || index === 0}
                      aria-label={`Move image ${number} up`}
                    >
                      Move up
                    </Button>
                    <Button
                      type="submit"
                      name="intent"
                      value="down"
                      variant="secondary"
                      disabled={pending || index === images.length - 1}
                      aria-label={`Move image ${number} down`}
                    >
                      Move down
                    </Button>
                    {!isCover && (
                      <Button
                        type="submit"
                        name="intent"
                        value="cover"
                        variant="secondary"
                        disabled={pending}
                        aria-label={`Make image ${number} the cover`}
                      >
                        Set as cover
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Delete image ${number}`}
                      onClick={() => setDeleting({ image, number })}
                    >
                      Delete
                    </Button>
                  </div>
                </form>
              </li>
            );
          })}
        </ol>
      )}

      <form
        ref={uploadFormRef}
        onSubmit={onUpload}
        noValidate
        aria-labelledby="add-image-heading"
        className="flex flex-col gap-4 rounded-xl border border-border p-4"
      >
        <h3 id="add-image-heading" className="font-display text-xl">
          Add an image
        </h3>

        {uploadMessage && (
          <div
            ref={uploadMessageRef}
            tabIndex={-1}
            role={uploadMessage.kind === "error" ? "alert" : "status"}
            className={cn(
              "rounded-lg border-2 p-4 font-medium",
              uploadMessage.kind === "error" ? "border-danger text-danger" : "border-border-strong",
            )}
          >
            {uploadMessage.message}
          </div>
        )}

        <Field
          label="Image file"
          required
          hint={`JPEG, PNG, WebP or AVIF, up to 30 MB. It is resized to at most ${IMAGE_LIMITS.maxSide} pixels on the longest side.`}
        >
          {(c) => <Input name="file" type="file" accept={IMAGE_ACCEPT} className="py-2" {...c} />}
        </Field>
        <Field
          label="Description"
          required
          hint="Alt text for people who cannot see the image. Describe what it shows."
          error={uploadMessage?.kind === "error" ? uploadMessage.altError : undefined}
        >
          {(c) => <Input name="alt" maxLength={IMAGE_LIMITS.alt} {...c} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caption">{(c) => <Input name="caption" maxLength={IMAGE_LIMITS.caption} {...c} />}</Field>
          <Field label="Credit" hint="For example the photographer or studio.">
            {(c) => <Input name="credit" maxLength={IMAGE_LIMITS.credit} {...c} />}
          </Field>
        </div>
        <div>
          <Button type="submit" loading={working}>
            {working ? "Uploading…" : "Upload image"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this image?"
        description={
          deleting
            ? `Image ${deleting.number} will be permanently removed.${
                deleting.image.id === coverImageId ? " It is the cover, so the next image becomes the cover." : ""
              }`
            : ""
        }
      >
        {deleting && (
          <form action={formAction} onSubmit={() => setDeleting(null)} className="contents">
            <input type="hidden" name="imageId" value={deleting.image.id} />
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="submit" name="intent" value="delete" variant="danger">
              Delete image
            </Button>
          </form>
        )}
      </ConfirmDialog>
    </section>
  );
}
