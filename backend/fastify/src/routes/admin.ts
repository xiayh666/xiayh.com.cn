import { slugify } from "../utils/slugify.js";
import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { verifyPassword } from "../lib/password.js";
import { syncNotes } from "../services/notes.js";

type LoginBody = { username: string; password: string };
type VisibilityBody = { visibility: "private" | "unlisted" | "public"; published: boolean };
type TagsBody = { tags: string[] };

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: LoginBody }>("/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["username", "password"],
        properties: {
          username: { type: "string", minLength: 1, maxLength: 100 },
          password: { type: "string", minLength: 1, maxLength: 1024 },
        },
      },
    },
  }, async (request, reply) => {
    const validUser = request.body.username === app.config.adminUsername;
    const validPassword = await verifyPassword(request.body.password, app.config.adminPassword);
    if (!validUser || !validPassword) return reply.unauthorized("Invalid credentials");

    const token = await reply.jwtSign({ sub: request.body.username, role: "admin" });
    reply.setCookie(app.config.cookieName, token, {
      path: "/",
      httpOnly: true,
      secure: app.config.cookieSecure,
      sameSite: "strict",
      maxAge: 8 * 60 * 60,
    });
    return { ok: true, csrfToken: "same-site-cookie" };
  });

  app.post("/logout", { preHandler: app.authenticate }, async (_request, reply) => {
    reply.clearCookie(app.config.cookieName, { path: "/" });
    return { ok: true };
  });

  app.post("/sync", {
    preHandler: async (request, reply) => {
      const header = request.headers["x-sync-token"];
      const token = Array.isArray(header) ? header[0] : header;
      const expected = app.config.syncToken;
      if (token && expected && token.length === expected.length
        && timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return;
      await app.authenticate(request, reply);
    },
  }, async () => syncNotes(app.db, app.config.notesRepo));

  app.post<{ Params: { id: number }; Body: VisibilityBody }>("/notes/:id/visibility", {
    preHandler: app.authenticate,
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["visibility", "published"],
        properties: {
          visibility: { enum: ["private", "unlisted", "public"] },
          published: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const result = app.db.prepare(`
      UPDATE documents
      SET visibility = ?,
          published = ?,
          published_at = CASE
            WHEN ? = 1 AND ? = 'public' THEN COALESCE(published_at, ?)
            ELSE published_at
          END
      WHERE id = ?
    `).run(
      request.body.visibility,
      request.body.published ? 1 : 0,
      request.body.published ? 1 : 0,
      request.body.visibility,
      new Date().toISOString(),
      request.params.id,
    );
    if (result.changes === 0) return reply.notFound("Note not found");
    return { ok: true };
  });

  app.post<{ Params: { id: number }; Body: TagsBody }>("/notes/:id/tags", {
    preHandler: app.authenticate,
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } },
      body: {
        type: "object",
        additionalProperties: false,
        required: ["tags"],
        properties: { tags: { type: "array", maxItems: 30, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 50 } } },
      },
    },
  }, async (request, reply) => {
    const exists = app.db.prepare("SELECT 1 FROM documents WHERE id = ?").get(request.params.id);
    if (!exists) return reply.notFound("Note not found");

    app.db.exec("BEGIN IMMEDIATE");
    try {
      app.db.prepare("DELETE FROM document_tags WHERE document_id = ?").run(request.params.id);
      const insertTag = app.db.prepare("INSERT INTO tags(name, slug) VALUES (?, ?) ON CONFLICT(name) DO NOTHING");
      const findTag = app.db.prepare("SELECT id FROM tags WHERE name = ?");
      const link = app.db.prepare("INSERT INTO document_tags(document_id, tag_id) VALUES (?, ?)");
      for (const rawName of request.body.tags) {
        const name = rawName.trim();
        if (!name) continue;
        insertTag.run(name, slugify(name));
        const tag = findTag.get(name) as { id: number };
        link.run(request.params.id, tag.id);
      }
      app.db.exec("COMMIT");
    } catch (error) {
      app.db.exec("ROLLBACK");
      throw error;
    }
    return { ok: true };
  });
}
