import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("AdminPage", () => {
  it("saves visibility metadata for a note", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 7,
              path: "ops/network.md",
              slug: "ops/network",
              title: "Network",
              summary: "",
              type: "markdown",
              visibility: "private",
              published: false,
              pinned: false,
              status: "active",
              updatedAt: "2026-06-26T00:00:00Z",
              publishedAt: "2026-06-26T00:00:00Z",
              viewCount: 0,
              previewPath: "",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<AdminPage />);
    await waitFor(() => expect(screen.getByText("Network")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByDisplayValue("private"), "public");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/notes/7/visibility",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ visibility: "public", published: true }),
        }),
      ),
    );
  });
});
