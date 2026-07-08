import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourseCover } from "@/components/course/course-cover";

describe("CourseCover", () => {
  it("renders the stored image with the title as alt text", () => {
    render(
      <CourseCover
        thumbnailUrl="https://abc.supabase.co/storage/v1/object/public/course-images/x.jpg"
        title="Intro to Grants"
        gradientClassName="bg-gradient-to-br from-blue-500 to-primary-600"
        className="h-40"
      />
    );
    const img = screen.getByRole("img", { name: "Intro to Grants" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img.getAttribute("src")).toContain("course-images");
  });

  it("uses eager loading when requested", () => {
    render(
      <CourseCover
        thumbnailUrl="https://abc.supabase.co/img.jpg"
        title="Hero Course"
        eager
      />
    );
    expect(screen.getByRole("img", { name: "Hero Course" })).toHaveAttribute("loading", "eager");
  });

  it("falls back to the gradient (no image) when thumbnailUrl is empty", () => {
    const { container } = render(
      <CourseCover
        thumbnailUrl={null}
        title="No Cover Course"
        gradientClassName="bg-gradient-to-br from-amber-500 to-orange-600"
        className="h-40"
      >
        <span>Placeholder content</span>
      </CourseCover>
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Placeholder content")).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toMatch(/from-amber-500/);
  });

  it("renders overlaid children above a stored image", () => {
    render(
      <CourseCover thumbnailUrl="https://abc.supabase.co/img.jpg" title="With Overlay">
        <h4>Course Title Overlay</h4>
      </CourseCover>
    );
    expect(screen.getByRole("img", { name: "With Overlay" })).toBeInTheDocument();
    expect(screen.getByText("Course Title Overlay")).toBeInTheDocument();
  });
});
