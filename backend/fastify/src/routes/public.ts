import type { FastifyInstance, FastifyRequest } from "fastify";
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

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/session", async (request) => {
    const authenticated = await isAdmin(request);
    return { authenticated, username: authenticated ? request.user.sub : null };
  });

  app.get("/notes", async (request) => ({ items: listNotes(app.db, await isAdmin(request)) }));

  app.get<{ Params: { "*": string } }>("/notes/*", {
    schema: { params: { type: "object", required: ["*"], properties: { "*": { type: "string", minLength: 1 } } } },
  }, async (request, reply) => {
    const note = findNote(app.db, request.params["*"], await isAdmin(request));
    if (!note) return reply.notFound("Note not found");
    return note;
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

  app.get("/tags", async (request) => {
    const admin = await isAdmin(request);
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
  }, async (request) => {
    const query = request.query.q?.trim() ?? "";
    return { items: query ? searchNotes(app.db, query, await isAdmin(request)) : [] };
  });
}
