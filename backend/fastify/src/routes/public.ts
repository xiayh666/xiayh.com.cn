import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { findNote, listNotes, searchNotes } from "../services/notes.js";

async function isAdmin(request: FastifyRequest): Promise<boolean> {
  const hasToken = Boolean(request.cookies[request.server.config.cookieName] || request.headers.authorization);
  if (!hasToken) return false;
  try {
    await request.jwtVerify();
    return request.user.role === "admin";
  } catch {
    return false;
  }
}

function sourceMarkdown(root: string, path: string): string {
  const base = resolve(root);
  const target = resolve(base, path);
  if (target !== base && !target.startsWith(`${base}${sep}`)) return "";
  return existsSync(target) ? readFileSync(target, "utf8") : "";
}

function cachePublicRead(reply: FastifyReply, maxAgeSeconds: number): void {
  reply.header("cache-control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 5}`);
  const existing = reply.getHeader("vary");
  const values = new Set(
    (Array.isArray(existing) ? existing.join(",") : String(existing ?? ""))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  values.add("Cookie");
  values.add("Authorization");
  reply.header("vary", [...values].join(", "));
}

function cacheSessionRead(reply: FastifyReply): void {
  reply.header("cache-control", "no-store");
}

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/session", async (request) => {
    const authenticated = await isAdmin(request);
    return { authenticated, username: authenticated ? request.user.sub : null };
  });

  app.get("/notes", async (request, reply) => {
    const admin = await isAdmin(request);
    if (admin) cacheSessionRead(reply);
    else cachePublicRead(reply, 60);
    return { items: listNotes(app.db, admin) };
  });

  app.get("/stats", async (_request, reply) => {
    cachePublicRead(reply, 60);
    const content = app.db.prepare(`
      SELECT COUNT(*) AS blogCount, COALESCE(SUM(view_count), 0) AS totalViews
      FROM documents
      WHERE status = 'active' AND published = 1 AND visibility = 'public'
    `).get() as { blogCount: number; totalViews: number };
    const visits = app.db.prepare("SELECT value FROM site_metrics WHERE key = 'visits'").get() as { value: number };
    return { ...content, visits: visits.value };
  });

  app.post("/visits", async () => {
    return app.db.prepare(`
      UPDATE site_metrics SET value = value + 1 WHERE key = 'visits'
      RETURNING value AS visits
    `).get() as { visits: number };
  });

  app.get<{ Params: { "*": string } }>("/notes/*", {
    schema: { params: { type: "object", required: ["*"], properties: { "*": { type: "string", minLength: 1 } } } },
  }, async (request, reply) => {
    const admin = await isAdmin(request);
    const note = findNote(app.db, request.params["*"], admin);
    if (!note) return reply.notFound("Note not found");
    if (admin) cacheSessionRead(reply);
    else cachePublicRead(reply, 300);
    return { ...note, markdown: note.markdown || sourceMarkdown(app.config.notesRepo, note.path) };
  });

  app.post<{ Params: { "*": string } }>("/views/*", {
    schema: { params: { type: "object", required: ["*"], properties: { "*": { type: "string", minLength: 1 } } } },
  }, async (request, reply) => {
    const result = app.db.prepare(`
      UPDATE documents
      SET view_count = view_count + 1
      WHERE slug = ? AND status = 'active' AND published = 1 AND visibility = 'public'
      RETURNING view_count AS viewCount
    `).get(request.params["*"]) as { viewCount: number } | undefined;
    if (!result) return reply.notFound("Note not found");
    return result;
  });

  app.get("/tags", async (request, reply) => {
    const admin = await isAdmin(request);
    if (admin) cacheSessionRead(reply);
    else cachePublicRead(reply, 300);
    const items = admin
      ? app.db.prepare("SELECT id, name, slug, color FROM tags ORDER BY name").all()
      : app.db.prepare(`
          SELECT DISTINCT t.id, t.name, t.slug, t.color
          FROM tags t
          JOIN document_tags dt ON dt.tag_id = t.id
          JOIN documents d ON d.id = dt.document_id
          WHERE d.status = 'active' AND d.published = 1 AND d.visibility = 'public'
          ORDER BY t.name
        `).all();
    return { items };
  });

  app.get<{ Querystring: { q?: string } }>("/search", {
    schema: { querystring: { type: "object", properties: { q: { type: "string", maxLength: 200 } } } },
  }, async (request, reply) => {
    const query = request.query.q?.trim() ?? "";
    const admin = await isAdmin(request);
    if (admin) cacheSessionRead(reply);
    else cachePublicRead(reply, 60);
    return { items: query ? searchNotes(app.db, query, admin) : [] };
  });
}
