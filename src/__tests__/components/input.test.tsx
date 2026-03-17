import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders a text input", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("renders with a label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("generates id from label", () => {
    render(<Input label="First Name" />);
    const input = screen.getByLabelText("First Name");
    expect(input.id).toBe("first-name");
  });

  it("uses provided id over generated one", () => {
    render(<Input label="Email" id="custom-id" />);
    expect(screen.getByLabelText("Email").id).toBe("custom-id");
  });

  it("shows error message", () => {
    render(<Input label="Email" error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("sets aria-invalid when error exists", () => {
    render(<Input label="Email" error="Invalid" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows helper text when no error", () => {
    render(<Input label="Email" helperText="Enter your email" />);
    expect(screen.getByText("Enter your email")).toBeInTheDocument();
  });

  it("hides helper text when error is shown", () => {
    render(<Input label="Email" error="Bad" helperText="Enter your email" />);
    expect(screen.queryByText("Enter your email")).not.toBeInTheDocument();
    expect(screen.getByText("Bad")).toBeInTheDocument();
  });

  it("handles user input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "hello");
    expect(onChange).toHaveBeenCalled();
  });

  it("applies error styling", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText("Email").className).toMatch(/border-red-300/);
  });

  it("applies small size", () => {
    render(<Input inputSize="sm" placeholder="small" />);
    expect(screen.getByPlaceholderText("small").className).toMatch(/h-8/);
  });
});
