import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { NoteSummary } from "../api";
import { AdminPage } from "./AdminPage";
import { ArticleEditor, NewArticlePage } from "./ArticleEditor";

const note: NoteSummary = {
  id: 7, path: "ops/network.md", slug: "ops/network", title: "Network", summary: "", type: "markdown",
  visibility: "private", published: false, pinned: false, status: "active", updatedAt: "2026-06-26T00:00:00Z",
  publishedAt: "2026-06-26T00:00:00Z", viewCount: 0, wordCount: 1200, previewPath: "",
};

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function response(json: unknown) { return { ok: true, json: async () => json }; }

describe("AdminPage", () => {
  // 验证匿名访问不会泄露管理内容，并提供可提交的登录表单。
  it("shows owner login for an anonymous session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authenticated: false, username: null })));
    renderWithProviders(<AdminPage view="login" />);
    expect(await screen.findByText("Welcome back.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeDisabled();
  });

  it("keeps settings separate from owner login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authenticated: false, username: null })));
    renderWithProviders(<AdminPage view="settings" />);
    expect(await screen.findByText("SETTINGS")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Login" })).not.toBeInTheDocument();
  });

  // 验证已认证管理员可更新现有文章的可见性和发布状态。
  it("saves visibility metadata for a managed note", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (input === "/api/session") return response({ authenticated: true, username: "admin" });
      if (input === "/api/notes") return response({ items: [note] });
      if (input === "/api/admin/profile") return response({ username: "admin", total: 1, published: 0, drafts: 1, views: 0 });
      return response({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<AdminPage view="login" />);
    await screen.findByText("Network");
    await userEvent.selectOptions(screen.getByLabelText("Visibility for Network"), "public");
    await userEvent.click(screen.getByLabelText("Published Network"));
    await userEvent.click(screen.getByRole("button", { name: "Save Network" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/notes/7/visibility", expect.objectContaining({ method: "POST", body: JSON.stringify({ visibility: "public", published: true }) })));
  });

  // 验证 Explorer 新建页会把路径、Markdown 和发布元数据提交到创建接口。
  it("creates a repository-backed markdown article", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (input === "/api/session") return response({ authenticated: true, username: "admin" });
      if (input === "/api/notes") return response({ items: [] });
      if (input === "/api/admin/profile") return response({ username: "admin", total: 0, published: 0, drafts: 0, views: 0 });
      if (input === "/api/admin/notes") return response({ ok: true, id: 9 });
      return response({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<MemoryRouter><NewArticlePage /></MemoryRouter>);
    await userEvent.type(screen.getByPlaceholderText("section/article-name.md"), "cpp/new.md");
    await userEvent.click(await screen.findByRole("button", { name: /Source/ }));
    await userEvent.type(screen.getByLabelText("Markdown content"), "# New article");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/notes", expect.objectContaining({ method: "POST", body: JSON.stringify({ path: "cpp/new.md", content: "# New article", visibility: "private", published: false }) })));
  });

  // 回归：已有文章第二次进入编辑时，source 可能从缓存/异步查询到达；编辑器不能先以空内容初始化后丢失正文。
  it("hydrates an existing article editor from delayed source content", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string) => {
      if (input === "/api/admin/notes/7/source") return response({ id: 7, path: "ops/network.md", content: "# Existing article\n\nkeep me" });
      return response({ ok: true });
    }));
    renderWithProviders(<MemoryRouter><ArticleEditor note={note} onSaved={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText("Markdown content")).toHaveValue("# Existing article\n\nkeep me"));
  });
});
