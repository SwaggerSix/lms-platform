import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        Content
      </Modal>
    );
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        Modal body
      </Modal>
    );
    expect(screen.getByText("Modal body")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Title">
        Content
      </Modal>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("has dialog role", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Dialog">
        Content
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has aria-modal attribute", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Dialog">
        Content
      </Modal>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Content
      </Modal>
    );
    await user.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Content
      </Modal>
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Content
      </Modal>
    );
    // Click the overlay (aria-hidden div)
    const overlay = document.querySelector("[aria-hidden='true']");
    if (overlay) await user.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
