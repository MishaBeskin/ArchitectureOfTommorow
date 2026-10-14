import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { imageFixture } from "@/test/fixtures";
import { ProjectGallery } from "./project-gallery";

const images = [
  imageFixture({ id: "1", alt: "Facade", caption: "The south facade", credit: "Studio Photo" }),
  imageFixture({ id: "2", alt: "Atrium", sortOrder: 1 }),
  imageFixture({ id: "3", alt: "Reading room", sortOrder: 2 }),
];

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

const dialog = () => screen.getByRole("dialog", { name: "Library images" });
const counter = () => within(dialog()).getByText(/^Image \d+ of \d+$/);

describe("ProjectGallery", () => {
  it("renders nothing without images", () => {
    const { container } = render(<ProjectGallery images={[]} title="Library" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a lead image and a thumbnail for each other image, each telling how many there are", () => {
    render(<ProjectGallery images={images} title="Library" />);

    expect(screen.getByRole("button", { name: /Facade.*image 1 of 3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atrium.*image 2 of 3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reading room.*image 3 of 3/ })).toBeInTheDocument();
  });

  it("opens the lightbox on the chosen image and announces its position", async () => {
    render(<ProjectGallery images={images} title="Library" />);

    await userEvent.click(screen.getByRole("button", { name: /Atrium/ }));

    expect(dialog()).toBeVisible();
    expect(counter()).toHaveTextContent("Image 2 of 3");
    expect(within(dialog()).getByRole("img", { name: "Atrium" })).toBeInTheDocument();
  });

  it("moves with the buttons and wraps around at both ends", async () => {
    render(<ProjectGallery images={images} title="Library" />);
    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));

    await userEvent.click(within(dialog()).getByRole("button", { name: "Previous image" }));
    expect(counter()).toHaveTextContent("Image 3 of 3");

    await userEvent.click(within(dialog()).getByRole("button", { name: "Next image" }));
    expect(counter()).toHaveTextContent("Image 1 of 3");
  });

  it("moves with the arrow keys", async () => {
    render(<ProjectGallery images={images} title="Library" />);
    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));

    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(counter()).toHaveTextContent("Image 2 of 3");

    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(counter()).toHaveTextContent("Image 3 of 3");
  });

  it("shows the caption and credit of the current image", async () => {
    render(<ProjectGallery images={images} title="Library" />);

    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));

    expect(within(dialog()).getByText(/The south facade/)).toBeInTheDocument();
    expect(within(dialog()).getByText("Credit: Studio Photo")).toBeInTheDocument();
  });

  it("closes with the Close button and clears its content", async () => {
    render(<ProjectGallery images={images} title="Library" />);
    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));

    await userEvent.click(within(dialog()).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Image \d+ of \d+$/)).not.toBeInTheDocument();
  });

  it("closes when the backdrop is clicked but not when the image is", async () => {
    render(<ProjectGallery images={images} title="Library" />);
    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));

    await userEvent.click(within(dialog()).getByRole("img", { name: "Facade" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(dialog());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers no thumbnails or navigation for a single image", async () => {
    render(<ProjectGallery images={[images[0]!]} title="Library" />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));
    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    expect(counter()).toHaveTextContent("Image 1 of 1");
  });

  it("has no accessibility violations closed and open", async () => {
    const { container } = render(<ProjectGallery images={images} title="Library" />);
    expect((await axe(container)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: /Facade/ }));
    expect((await axe(container)).violations).toEqual([]);
  });
});
