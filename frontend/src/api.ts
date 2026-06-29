export type NoteSummary = {
  id: number;
  path: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  visibility: "private" | "unlisted" | "public";
  published: boolean;
  pinned: boolean;
  status: string;
  updatedAt: string;
  publishedAt: string;
  viewCount: number;
  previewPath: string;
};

export type Note = NoteSummary & {
  html: string;
};

export type Tag = {
  id: number;
  name: string;
  slug: string;
  color: string;
};

export type SiteStats = {
  blogCount: number;
  totalViews: number;
  visits: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  session: () => request<{ authenticated: boolean; username: string | null }>("/api/session"),
  notes: () => request<{ items: NoteSummary[] }>("/api/notes"),
  stats: () => request<SiteStats>("/api/stats"),
  recordVisit: () => request<{ visits: number }>("/api/visits", { method: "POST", body: "{}" }),
  note: (slug: string, signal?: AbortSignal) => request<Note>(
    `/api/notes/${slug.split("/").map(encodeURIComponent).join("/")}`,
    { signal },
  ),
  recordView: (slug: string) => request<{ viewCount: number }>(
    `/api/views/${slug.split("/").map(encodeURIComponent).join("/")}`,
    { method: "POST", body: "{}" },
  ),
  tags: () => request<{ items: Tag[] }>("/api/tags"),
  search: (q: string) => request<{ items: NoteSummary[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  login: (username: string, password: string) =>
    request<{ ok: boolean; csrfToken: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  sync: () =>
    request<{ status: string; scanned: number; changed: number }>("/api/admin/sync", {
      method: "POST",
      body: "{}",
    }),
  updateVisibility: (id: number, visibility: NoteSummary["visibility"], published: boolean) =>
    request<{ ok: boolean }>(`/api/admin/notes/${id}/visibility`, {
      method: "POST",
      body: JSON.stringify({ visibility, published }),
    }),
  setTags: (id: number, tags: string[]) =>
    request<{ ok: boolean }>(`/api/admin/notes/${id}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    }),
};
