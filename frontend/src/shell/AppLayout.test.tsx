import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Note, NoteSummary } from "../api";
import { AdminPage } from "../pages/AdminPage";
import { NotePage } from "../pages/NotePage";
import { WelcomePage } from "../pages/WelcomePage";
import { AppLayout } from "./AppLayout";

const summaries: NoteSummary[] = [
  {
    id: 1, path: "one.md", slug: "one", title: "One", summary: "First", type: "markdown",
    visibility: "public", published: true, pinned: false, status: "active",
    updatedAt: "2026-06-29T00:00:00.000Z", publishedAt: "2026-06-29T00:00:00.000Z", viewCount: 4, wordCount: 1200, previewPath: "",
  },
  {
    id: 2, path: "two.md", slug: "two", title: "Two", summary: "Second", type: "markdown",
    visibility: "public", published: true, pinned: false, status: "active",
    updatedAt: "2026-06-29T00:00:00.000Z", publishedAt: "2026-06-29T00:00:00.000Z", viewCount: 8, wordCount: 1200, previewPath: "",
  },
];

describe("AppLayout editor tabs", () => {
  it("replaces the active Welcome tab when a homepage update opens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string) => {
      if (input === "/api/notes") return { ok: true, json: async () => ({ items: summaries }) };
      if (input === "/api/session") return { ok: true, json: async () => ({ authenticated: false, username: null }) };
      if (input === "/api/stats") return { ok: true, json: async () => ({ blogCount: 2, totalViews: 12, visits: 1 }) };
      const slug = input.split("/").at(-1);
      const summary = summaries.find((note) => note.slug === slug)!;
      return { ok: true, json: async () => ({ ...summary, html: `<h1>Article ${summary.title}</h1>`, markdown: `# Article ${summary.title}` }) };
    }));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<WelcomePage />} />
              <Route path="notes/*" element={<NotePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /One/ }));
    await screen.findByRole("heading", { name: "Article One" });
    expect(screen.getByRole("button", { name: "Close one.md" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close Welcome" })).not.toBeInTheDocument();
  });

  it("opens unique tabs, activates existing tabs, and selects a neighbor on close", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string) => {
      if (input === "/api/notes") return { ok: true, json: async () => ({ items: summaries }) };
      if (input === "/api/session") return { ok: true, json: async () => ({ authenticated: false, username: null }) };
      const slug = input.split("/").at(-1);
      const summary = summaries.find((note) => note.slug === slug)!;
      const note: Note = { ...summary, html: `<h1>Article ${summary.title}</h1>`, markdown: `# Article ${summary.title}` };
      return { ok: true, json: async () => note };
    }));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<WelcomePage />} />
              <Route path="notes/*" element={<NotePage />} />
              <Route path="login" element={<AdminPage view="login" />} />
              <Route path="settings" element={<AdminPage view="settings" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "进入工作区" })[0]);

    const explorerResizeHandle = screen.getByRole("separator", { name: "Resize Side Bar" });
    expect(explorerResizeHandle).toHaveAttribute("aria-valuenow", "300");
    fireEvent.keyDown(explorerResizeHandle, { key: "ArrowLeft" });
    expect(explorerResizeHandle).toHaveAttribute("aria-valuenow", "290");
    const activityBar = screen.getByLabelText("Activity Bar");
    fireEvent.click(within(activityBar).getByTitle("Search"));
    expect(screen.getByRole("textbox", { name: "Search articles" })).toBeInTheDocument();
    fireEvent.click(within(activityBar).getByTitle("Explorer"));

    const openTabSection = screen.getByRole("button", { name: /Open Tab/ });
    expect(openTabSection).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(openTabSection);
    expect(openTabSection).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(openTabSection);

    const blogSection = screen.getByRole("button", { name: /Blog/ });
    expect(blogSection).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(blogSection);
    expect(blogSection).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(blogSection);

    let explorer = await screen.findByRole("navigation", { name: "Article explorer" });
    fireEvent.click(screen.getByTitle("Settings"));
    await screen.findByRole("button", { name: "Close Settings" });
    expect(screen.getByRole("button", { name: "Close Welcome" })).toBeInTheDocument();

    fireEvent.click(await within(explorer).findByRole("button", { name: "one.md" }));
    await screen.findByRole("heading", { name: "Article One" });
    fireEvent.click(within(activityBar).getByTitle("Outline"));
    const outline = await screen.findByRole("navigation", { name: "Document outline" });
    expect(within(outline).getByRole("button", { name: "Article One" })).toBeInTheDocument();
    fireEvent.click(within(activityBar).getByTitle("Explorer"));
    explorer = await screen.findByRole("navigation", { name: "Article explorer" });
    expect(screen.getByRole("button", { name: "Close Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Welcome" })).toBeInTheDocument();

    fireEvent.click(within(explorer).getByRole("button", { name: "two.md" }));
    await screen.findByRole("heading", { name: "Article Two" });
    expect(screen.getAllByRole("button", { name: /^Close (one|two)\.md$/ })).toHaveLength(2);

    fireEvent.click(within(explorer).getByRole("button", { name: "one.md" }));
    await screen.findByRole("heading", { name: "Article One" });
    expect(screen.getAllByRole("button", { name: /^Close (one|two)\.md$/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Close one.md" }));
    await screen.findByRole("heading", { name: "Article Two" });
    fireEvent.click(screen.getByRole("button", { name: "Close two.md" }));
    await screen.findByText("Welcome back.");
    fireEvent.click(screen.getByRole("button", { name: "Close Settings" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "博客概览" })).toBeInTheDocument());

    const tabBar = screen.getByLabelText("Editor tabs");
    fireEvent.contextMenu(within(tabBar).getByTitle("Welcome"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Split Right" }));
    expect(screen.getAllByLabelText("Editor tabs")).toHaveLength(2);
    expect(screen.getAllByRole("region", { name: "博客概览" })).toHaveLength(2);
    const groupResizeHandle = screen.getByRole("separator", { name: "Resize editor groups" });
    expect(groupResizeHandle).toHaveAttribute("aria-valuenow", "50");
    fireEvent.keyDown(groupResizeHandle, { key: "ArrowRight" });
    expect(groupResizeHandle).toHaveAttribute("aria-valuenow", "52");

    const splitTabBars = screen.getAllByLabelText("Editor tabs");
    fireEvent.contextMenu(within(splitTabBars[0]).getByTitle("Welcome"));
    fireEvent.pointerEnter(screen.getByRole("menuitem", { name: /Split & Move/ }).parentElement!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move Right" }));
    expect(screen.getAllByLabelText("Editor tabs")).toHaveLength(1);
    expect(screen.getByTitle("Welcome")).toBeInTheDocument();
  });
});
