import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="my-card">Content</Card>);
    expect(container.firstChild).toHaveClass("my-card");
  });

  it("has default styling", () => {
    const { container } = render(<Card>Content</Card>);
    expect((container.firstChild as HTMLElement).className).toMatch(/rounded-lg/);
    expect((container.firstChild as HTMLElement).className).toMatch(/border/);
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText("Header")).toBeInTheDocument();
  });
});

describe("CardTitle", () => {
  it("renders as h3", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Title");
  });
});

describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>Some description</CardDescription>);
    expect(screen.getByText("Some description")).toBeInTheDocument();
  });
});

describe("CardContent", () => {
  it("renders content", () => {
    render(<CardContent>Content body</CardContent>);
    expect(screen.getByText("Content body")).toBeInTheDocument();
  });
});

describe("CardFooter", () => {
  it("renders footer content", () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});

describe("Card composition", () => {
  it("renders a full card with all subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
          <CardDescription>A description</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
        <CardFooter>Footer action</CardFooter>
      </Card>
    );

    expect(screen.getByRole("heading")).toHaveTextContent("My Card");
    expect(screen.getByText("A description")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Footer action")).toBeInTheDocument();
  });
});
