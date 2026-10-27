import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { preloadArticle } from "./lazyRoutes";

vi.mock("./NotePage", () => ({ NotePage: () => null }));
vi.mock("./MarkdownReader", () => ({ MarkdownReader: () => null }));

describe("article preloading", () => {
  // Touch, focus and click may all fire for one visit; they must share one request and cached result.
  it("deduplicates intent requests and reuses the cached article on navigation", async () => {
    let resolveResponse!: (response: unknown) => void;
    const fetchMock = vi.fn((input: string) => { void input; return new Promise((resolve) => { resolveResponse = resolve; }); });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    preloadArticle(client, "cpp/hello world");
    preloadArticle(client, "cpp/hello world");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/notes/cpp/hello%20world");
    const article = { html: "<h1>Hello</h1>", markdown: "# Hello" };
    resolveResponse({ ok: true, json: async () => article });
    await vi.waitFor(() => expect(client.getQueryData(["note", "cpp/hello world"])).toEqual(article));
    const queryFn = vi.fn();
    expect(await client.fetchQuery({ queryKey: ["note", "cpp/hello world"], queryFn })).toEqual(article);
    expect(queryFn).not.toHaveBeenCalled();
    client.clear();
  });
});
