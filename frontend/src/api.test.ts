import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests notes with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.notes()).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      }),
    );
  });

  it("encodes search query text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.search("personal website");
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=personal%20website", expect.any(Object));
  });

  it("throws for non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    await expect(api.sync()).rejects.toThrow("401 Unauthorized");
  });

  // 验证编辑器图片使用 multipart 上传，并把服务端 URL 返回给 Markdown 编辑器。
  it("uploads an editor image as multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, url: "/api/media/image.png", filename: "image.png" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["png"], "diagram.png", { type: "image/png" });

    await expect(api.uploadImage(file)).resolves.toMatchObject({ url: "/api/media/image.png" });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/uploads/images", expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: expect.any(FormData),
    }));
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("headers");
  });
});
