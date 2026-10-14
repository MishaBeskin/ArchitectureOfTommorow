import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { ImageActionState } from "@/server/admin/handle-image";
import { ImageManager, type AttachImage, type ImageCardAction, type ManagedImage } from "./image-manager";

// jsdom does not implement the modal <dialog> API.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const image = (n: number, overrides: Partial<ManagedImage> = {}): ManagedImage => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  url: `https://storage.test/storage/v1/object/public/projects/p/${n}.webp`,
  width: 1600,
  height: 1000,
  alt: `Alt ${n}`,
  caption: null,
  credit: null,
  blurDataUrl: "data:image/webp;base64,AAAA",
  ...overrides,
});

const IMAGES = [image(1), image(2, { caption: "A caption", credit: "Jo" }), image(3)];

function setup(
  options: {
    images?: ManagedImage[];
    coverImageId?: string | null;
    actionResult?: ImageActionState;
    attachResult?: ImageActionState;
    uploadResult?: { ok: true; path: string } | { ok: false; message: string };
  } = {},
) {
  const action = vi.fn<ImageCardAction>(async () => options.actionResult ?? { status: "success", message: "Done." });
  const attach = vi.fn<AttachImage>(
    async () => options.attachResult ?? { status: "success", message: "The image was added." },
  );
  const upload = vi.fn(async () => options.uploadResult ?? { ok: true as const, path: "tmp/p/u" });
  const user = userEvent.setup();
  const images = options.images ?? IMAGES;
  const utils = render(
    <ImageManager
      projectId="11111111-1111-4111-8111-111111111111"
      images={images}
      coverImageId={options.coverImageId === undefined ? (images[0]?.id ?? null) : options.coverImageId}
      action={action}
      attach={attach}
      upload={upload}
    />,
  );
  return { action, attach, upload, user, ...utils };
}

const png = () => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], "photo.png", { type: "image/png" });

describe("ImageManager: the list", () => {
  it("shows every image with editable details, in order, and has no accessibility violations", async () => {
    const { container } = setup();

    expect(screen.getByRole("heading", { name: "Images (3)" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Image 1 description/)).toHaveValue("Alt 1");
    expect(screen.getByLabelText("Image 2 caption")).toHaveValue("A caption");
    expect(screen.getByLabelText("Image 2 credit")).toHaveValue("Jo");
    expect(screen.getByRole("img", { name: "Alt 3" })).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("marks the cover in words, and offers Set as cover on the others only", () => {
    setup();

    expect(screen.getAllByText("Cover image")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Make image 1 the cover" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make image 2 the cover" })).toBeInTheDocument();
  });

  it("disables moving the first image up and the last image down", () => {
    setup();

    expect(screen.getByRole("button", { name: "Move image 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move image 3 down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move image 2 up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move image 2 down" })).toBeEnabled();
  });

  it("says when there are no images", () => {
    setup({ images: [], coverImageId: null });

    expect(screen.getByText(/No images yet/)).toBeInTheDocument();
  });

  it.each([
    ["Save details of image 2", "save"],
    ["Move image 2 up", "up"],
    ["Move image 2 down", "down"],
    ["Make image 2 the cover", "cover"],
  ])("sends %s with the image id and its current details", async (name, intent) => {
    const { user, action } = setup();

    await user.click(screen.getByRole("button", { name }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0]![1];
    expect(data.get("intent")).toBe(intent);
    expect(data.get("imageId")).toBe(IMAGES[1]!.id);
    expect(data.get("alt")).toBe("Alt 2");
    expect(data.get("caption")).toBe("A caption");
    expect(data.get("credit")).toBe("Jo");
  });

  it("announces the outcome and moves focus to it", async () => {
    const { user } = setup({ actionResult: { status: "success", message: "The image moved up." } });
    await user.click(screen.getByRole("button", { name: "Move image 2 up" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("The image moved up.");
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("shows a field error under the right image only", async () => {
    const { user } = setup({
      actionResult: {
        status: "error",
        message: "Fix the problem below and save again.",
        imageId: IMAGES[1]!.id,
        errors: { alt: "Describe the image for people who cannot see it." },
      },
    });
    await user.click(screen.getByRole("button", { name: "Save details of image 2" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText(/^Image 2 description/)).toBeInvalid();
    expect(screen.getByLabelText(/^Image 1 description/)).toBeValid();
  });
});

describe("ImageManager: deleting", () => {
  it("asks first, with Cancel available, and Cancel deletes nothing", async () => {
    const { user, action } = setup();

    await user.click(screen.getByRole("button", { name: "Delete image 2" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this image?" });
    expect(dialog).toHaveTextContent("Image 2 will be permanently removed.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
  });

  it("deletes after confirmation, warning when it is the cover", async () => {
    const { user, action } = setup();

    await user.click(screen.getByRole("button", { name: "Delete image 1" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("It is the cover, so the next image becomes the cover.");
    await user.click(within(dialog).getByRole("button", { name: "Delete image" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0]![1];
    expect(data.get("intent")).toBe("delete");
    expect(data.get("imageId")).toBe(IMAGES[0]!.id);
  });
});

describe("ImageManager: adding an image", () => {
  const descriptionField = () => screen.getByRole("textbox", { name: /^Description/ });

  async function fill(user: ReturnType<typeof userEvent.setup>, { file = png(), alt = "A new facade" } = {}) {
    await user.upload(screen.getByLabelText(/^Image file/), file);
    if (alt) await user.type(descriptionField(), alt);
  }

  it("uploads the original, then attaches it with its details, and confirms", async () => {
    const { user, upload, attach } = setup({ images: [], coverImageId: null });
    await fill(user);
    await user.type(screen.getByLabelText(/^Caption/), "North side");
    await user.type(screen.getByLabelText(/^Credit/), "Studio");

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    await waitFor(() => expect(attach).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.any(File));
    expect(attach).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "tmp/p/u", {
      alt: "A new facade",
      caption: "North side",
      credit: "Studio",
    });
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("The image was added.");
    await waitFor(() => expect(status).toHaveFocus());
    expect(screen.getByLabelText(/^Caption/)).toHaveValue("");
  });

  it("asks for a file first, and for the description, without contacting the server", async () => {
    const { user, upload, attach } = setup({ images: [], coverImageId: null });

    await user.click(screen.getByRole("button", { name: "Upload image" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose an image file first.");

    await fill(user, { alt: "" });
    await user.click(screen.getByRole("button", { name: "Upload image" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Fix the problem below"));
    expect(descriptionField()).toBeInvalid();
    expect(upload).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });

  it("shows why the browser step failed and does not attach", async () => {
    const { user, attach } = setup({ uploadResult: { ok: false, message: "The file is larger than 30 MB." } });
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The file is larger than 30 MB.");
    expect(attach).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the file is refused, and keeps what was typed", async () => {
    const { user } = setup({
      attachResult: { status: "error", message: "Only JPEG, PNG, WebP and AVIF images are accepted." },
    });
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only JPEG, PNG, WebP and AVIF");
    expect(descriptionField()).toHaveValue("A new facade");
  });

  it("copes with the server action throwing", async () => {
    const { user, attach } = setup();
    attach.mockRejectedValueOnce(new Error("network"));
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Upload image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
