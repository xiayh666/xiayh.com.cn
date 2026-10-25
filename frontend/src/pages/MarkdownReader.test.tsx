import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownReader } from "./MarkdownReader";

describe("MarkdownReader", () => {
  it("renders the server HTML projection and prepares article affordances", async () => {
    const onReady = vi.fn();
    render(<MarkdownReader html="<h1>Fast reader</h1><pre><code>const fast = true;</code></pre>" onReady={onReady} />);

    expect(screen.getByRole("heading", { name: "Fast reader" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  });
});
