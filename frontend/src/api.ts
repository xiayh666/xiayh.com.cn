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
  markdown: string;
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

export type AdminProfile = {
  username: string;
  total: number;
  published: number;
  drafts: number;
  views: number;
};

export type NoteSource = { id: number; path: string; content: string };

async function uploadImage(file: File): Promise<{ ok: boolean; url: string; filename: string }> {
  const body = new FormData();
  body.append("image", file);
  const res = await fetch("/api/admin/uploads/images", { method: "POST", credentials: "include", body });
  if (!res.ok) {
    const payload = typeof res.json === "function" ? await res.json().catch(() => undefined) as { message?: string } | undefined : undefined;
    throw new Error(payload?.message || `Image upload failed (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean; url: string; filename: string }>;
}

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
    const body = typeof res.json === "function" ? await res.json().catch(() => undefined) as { message?: string } | undefined : undefined;
    throw new Error(body?.message || `${res.status} ${res.statusText}`);
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
  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST", body: "{}" }),
  adminProfile: () => request<AdminProfile>("/api/admin/profile"),
  noteSource: (id: number) => request<NoteSource>(`/api/admin/notes/${id}/source`),
  uploadImage,
  createNote: (input: { path: string; content: string; visibility: NoteSummary["visibility"]; published: boolean }) =>
    request<{ ok: boolean; id: number }>("/api/admin/notes", { method: "POST", body: JSON.stringify(input) }),
  updateNoteContent: (id: number, content: string) =>
    request<{ ok: boolean }>(`/api/admin/notes/${id}/content`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteNote: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/notes/${id}/delete`, { method: "POST", body: "{}" }),
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
