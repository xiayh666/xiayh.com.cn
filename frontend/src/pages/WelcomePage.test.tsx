import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { NoteSummary } from "../api";
import { WelcomePage } from "./WelcomePage";

const recentNote: NoteSummary = {
  id: 1, path: "math.md", slug: "math", title: "Math", summary: "", type: "markdown",
  visibility: "public", published: true, pinned: false, status: "active",
  updatedAt: "2026-06-30T00:00:00.000Z", publishedAt: "2026-06-30T00:00:00.000Z", viewCount: 0, wordCount: 1200, previewPath: "",
};

describe("WelcomePage", () => {
  it("shows the blog archive in the workspace welcome page", () => {
    const { container } = render(<MemoryRouter><WelcomePage initialNotes={[recentNote]} /></MemoryRouter>);
    expect(screen.getByRole("region", { name: "博客概览" })).toBeInTheDocument();
    expect(screen.getByText("BLOG")).toBeInTheDocument();
    expect(screen.getByText("BLOG ARCHIVE.")).toBeInTheDocument();
    expect(screen.getByLabelText("最近十二个月文章发布频率热力图")).toBeInTheDocument();
    expect(screen.getByText("过去12个月: 1,200 字")).toBeInTheDocument();
    expect(container.querySelector('[data-welcome-mode="workspace"]')).toBeInTheDocument();
    expect(container.querySelector("[data-welcome-environment]")).not.toBeInTheDocument();
  });

  it("keeps the dashboard entry in fullscreen intro mode", () => {
    const { container } = render(<MemoryRouter><WelcomePage intro /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "进入工作区" })).not.toBeInTheDocument();
    expect(screen.getByText("WELCOME")).toBeInTheDocument();
    expect(screen.getByText("模型展示")).toBeInTheDocument();
    expect(container.querySelector('[data-welcome-mode="homepage"]')).toBeInTheDocument();
    expect(container.querySelector("[data-welcome-environment]")).toBeInTheDocument();
  });

  it("hands a homepage recent update to the workspace transition", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const onOpenNote = vi.fn();
    render(<MemoryRouter><WelcomePage intro initialNotes={[recentNote]} onOpenNote={onOpenNote} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Math/ }));
    expect(onOpenNote).toHaveBeenCalledWith("math");
  });

  it("uses the Model Display browse flow for the blog module", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const onBrowse = vi.fn();
    render(<MemoryRouter><WelcomePage intro onBrowse={onBrowse} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /博客/ }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

});
