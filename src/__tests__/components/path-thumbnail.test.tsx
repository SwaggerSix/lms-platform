import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PathThumbnail } from "@/components/paths/path-thumbnail";

describe("PathThumbnail", () => {
  it("renders the image with the path title as alt text", () => {
    render(<PathThumbnail url="/images/paths/mosaic-certification.jpg" title="Mosaic Certification" fallback={<span>icon</span>} />);
    const img = screen.getByRole("img", { name: "Mosaic Certification" });
    expect(img.getAttribute("src")).toBe("/images/paths/mosaic-certification.jpg");
    expect(img.className).toContain("object-cover");
    expect(screen.queryByText("icon")).toBeNull();
  });

  it("falls back when there is no image", () => {
    render(<PathThumbnail url={null} title="Mosaic Certification" fallback={<span>icon</span>} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("icon")).toBeTruthy();
  });
});
