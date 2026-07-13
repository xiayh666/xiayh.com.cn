import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { NoteSummary } from "../api";
import { ExplorerTree } from "./ExplorerTree";

const note: NoteSummary = {
  id: 1,
  path: "cpp/basics/hello-world.md",
  slug: "cpp/basics/hello-world",
  title: "C++ Hello World",
  summary: "Example",
  type: "markdown",
  visibility: "public",
  published: true,
  pinned: false,
  status: "active",
  updatedAt: "2026-06-29T00:00:00.000Z",
  publishedAt: "2026-06-29T00:00:00.000Z",
  viewCount: 0,
  wordCount: 1200,
  previewPath: "",
};

describe("ExplorerTree", () => {
  it("opens and closes folders and links files to their article", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><ExplorerTree notes={[note]} /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByText("hello-world.md")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cpp/i }));
    fireEvent.click(screen.getByRole("button", { name: /basics/i }));

    expect(screen.getByRole("button", { name: "hello-world.md" })).toBeInTheDocument();
    expect(document.querySelector("a")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /cpp/i }));
    expect(screen.queryByText("hello-world.md")).not.toBeInTheDocument();
  });
});
