import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownReader } from "./MarkdownReader";

describe("MarkdownReader", () => {
  it("highlights fenced code without changing its text and leaves unknown languages readable", async () => {
    const source = 'const message = "<hello>";\n';
    const { container } = render(<MarkdownReader html={'<pre><code class="language-js">const message = &quot;&lt;hello&gt;&quot;;\n</code></pre><pre><code class="language-unknown">plain code</code></pre>'} />);
    await waitFor(() => expect(container.querySelector("code span[style]")).toBeInTheDocument(), { timeout: 10000 });
    expect(container.querySelector("code")?.textContent).toBe(source);
    expect(container.querySelector(".language-unknown")?.textContent).toBe("plain code");
    expect(screen.getAllByRole("button", { name: "Copy code" })).toHaveLength(2);
  });

  it("keeps C++ highlighting when the parent updates after the reader is ready", async () => {
    const html = '<pre><code class="language-cpp">struct A { static constexpr char * name = "name is A"; };</code></pre>';
    const { container, rerender } = render(<MarkdownReader html={html} onReady={() => undefined} />);
    await waitFor(() => expect(container.querySelector("code span[style]")).toBeInTheDocument(), { timeout: 10000 });
    rerender(<MarkdownReader html={html} onReady={() => undefined} />);
    expect(container.querySelector("code span[style]")).toBeInTheDocument();
  });

  it("renders the server HTML projection and prepares article affordances", async () => {
    const onReady = vi.fn();
    render(<MarkdownReader html="<h1>Fast reader</h1><pre><code>const fast = true;</code></pre>" onReady={onReady} />);

    expect(screen.getByRole("heading", { name: "Fast reader" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  });
});
