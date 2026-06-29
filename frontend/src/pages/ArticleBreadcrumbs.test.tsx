import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { NoteSummary } from "../api";
import { ArticleBreadcrumbs } from "./ArticleBreadcrumbs";

const notes: NoteSummary[] = [
  {
    id: 1, path: "web/http/cache.md", slug: "web/http/cache", title: "Cache", summary: "", type: "markdown",
    visibility: "public", published: true, pinned: false, status: "active", updatedAt: "", publishedAt: "", viewCount: 0, previewPath: "",
  },
  {
    id: 2, path: "web/react/query.md", slug: "web/react/query", title: "Query", summary: "", type: "markdown",
    visibility: "public", published: true, pinned: false, status: "active", updatedAt: "", publishedAt: "", viewCount: 0, previewPath: "",
  },
];

describe("ArticleBreadcrumbs", () => {
  it("opens folder pickers and exposes document headings", () => {
    const selectHeading = vi.fn();
    render(
      <MemoryRouter initialEntries={["/notes/web/http/cache"]}>
        <Routes>
          <Route path="/notes/*" element={(
            <ArticleBreadcrumbs
              path="web/http/cache.md"
              notes={notes}
              headings={[
                { id: "intro", text: "Introduction", level: 1 },
                { id: "details", text: "Details", level: 2 },
              ]}
              activeHeadingId="intro"
              onSelectHeading={selectHeading}
            />
          )} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "web" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /http/ }));
    expect(screen.getByRole("menuitem", { name: "cache.md" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Introduction" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Details" }));
    expect(selectHeading).toHaveBeenCalledWith("details");
  });
});
