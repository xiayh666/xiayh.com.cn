import { slugify } from "../utils/slugify.js";
import type { FastifyInstance } from "fastify";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { verifyPassword } from "../lib/password.js";
import { syncNotes } from "../services/notes.js";

type LoginBody = { username: string; password: string };
type VisibilityBody = { visibility: "private" | "unlisted" | "public"; published: boolean };
type TagsBody = { tags: string[] };
type CreateNoteBody = VisibilityBody & { path: string; content: string };
type UpdateContentBody = { content: string };

const imageExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function hasImageSignature(content: Buffer, mime: string): boolean {
  if (mime === "image/png") return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg") return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(content.subarray(0, 6).toString("ascii"));
  if (mime === "image/webp") return content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function markdownSourcePath(root: string, relativePath: string): string | undefined {
  const normalized = relativePath.trim().replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) return;
  if (![".md", ".markdown"].includes(extname(normalized).toLowerCase())) return;
  const base = resolve(root);
  const target = resolve(base, normalized);
  if (target !== base && !target.startsWith(`${base}${sep}`)) return;
  return target;
}

function updatePublication(app: FastifyInstance, id: number, visibility: VisibilityBody["visibility"], published: boolean): void {
  app.db.prepare(`
    UPDATE documents
    SET visibility = ?, published = ?, published_at = CASE
      WHEN ? = 1 AND ? = 'public' THEN COALESCE(published_at, ?)
      ELSE published_at
    END
    WHERE id = ?
  `).run(visibility, published ? 1 : 0, published ? 1 : 0, visibility, new Date().toISOString(), id);
}

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

  app.get("/profile", { preHandler: app.authenticate }, async (request) => {
    const counts = app.db.prepare(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN published = 1 AND visibility = 'public' THEN 1 ELSE 0 END), 0) AS published,
        COALESCE(SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END), 0) AS drafts,
        COALESCE(SUM(view_count), 0) AS views
      FROM documents WHERE status = 'active'
    `).get() as { total: number; published: number; drafts: number; views: number };
    return { username: request.user.sub, ...counts };
  });

  app.post("/uploads/images", { preHandler: app.authenticate }, async (request, reply) => {
    const image = await request.file({ limits: { files: 1, fileSize: app.config.imageUploadLimit } });
    if (!image) return reply.badRequest("An image file is required");
    const extension = imageExtensions[image.mimetype];
    if (!extension) return reply.unsupportedMediaType("Only PNG, JPEG, WebP, and GIF images are supported");
    const content = await image.toBuffer();
    if (image.file.truncated) return reply.payloadTooLarge(`Images must not exceed ${app.config.imageUploadLimit} bytes`);
    if (!content.length) return reply.badRequest("The uploaded image is empty");
    if (!hasImageSignature(content, image.mimetype)) return reply.unsupportedMediaType("The file content does not match its image type");
    const filename = `${Date.now().toString(36)}-${randomUUID()}${extension}`;
    mkdirSync(app.config.mediaRoot, { recursive: true });
    writeFileSync(resolve(app.config.mediaRoot, filename), content, { flag: "wx" });
    return reply.code(201).send({ ok: true, filename, url: `/api/media/${filename}` });
  });

  app.get<{ Params: { id: number } }>("/notes/:id/source", {
    preHandler: app.authenticate,
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } } },
  }, async (request, reply) => {
    const note = app.db.prepare("SELECT id, path FROM documents WHERE id = ? AND status = 'active'").get(request.params.id) as { id: number; path: string } | undefined;
    if (!note) return reply.notFound("Note not found");
    const source = markdownSourcePath(app.config.notesRepo, note.path);
    if (!source || !existsSync(source)) return reply.notFound("Source file not found");
    return { ...note, content: readFileSync(source, "utf8") };
  });

  app.post<{ Body: CreateNoteBody }>("/notes", {
    preHandler: app.authenticate,
    schema: {
      body: {
        type: "object", additionalProperties: false, required: ["path", "content", "visibility", "published"],
        properties: {
          path: { type: "string", minLength: 3, maxLength: 300 },
          content: { type: "string", maxLength: 1_000_000 },
          visibility: { enum: ["private", "unlisted", "public"] }, published: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const source = markdownSourcePath(app.config.notesRepo, request.body.path);
    if (!source) return reply.badRequest("A safe .md or .markdown path is required");
    if (existsSync(source)) return reply.conflict("Source file already exists");
    mkdirSync(dirname(source), { recursive: true });
    writeFileSync(source, request.body.content, "utf8");
    syncNotes(app.db, app.config.notesRepo);
    const note = app.db.prepare("SELECT id FROM documents WHERE path = ?").get(request.body.path.replaceAll("/", sep)) as { id: number } | undefined
      ?? app.db.prepare("SELECT id FROM documents WHERE path = ?").get(request.body.path) as { id: number } | undefined;
    if (!note) return reply.internalServerError("Created note was not synchronized");
    updatePublication(app, note.id, request.body.visibility, request.body.published);
    return reply.code(201).send({ ok: true, id: note.id });
  });

  app.post<{ Params: { id: number }; Body: UpdateContentBody }>("/notes/:id/content", {
    preHandler: app.authenticate,
    schema: {
      params: { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } },
      body: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", maxLength: 1_000_000 } } },
    },
  }, async (request, reply) => {
    const note = app.db.prepare("SELECT path FROM documents WHERE id = ? AND status = 'active'").get(request.params.id) as { path: string } | undefined;
    if (!note) return reply.notFound("Note not found");
    const source = markdownSourcePath(app.config.notesRepo, note.path);
    if (!source) return reply.badRequest("Stored source path is invalid");
    mkdirSync(dirname(source), { recursive: true });
    writeFileSync(source, request.body.content, "utf8");
    syncNotes(app.db, app.config.notesRepo);
    return { ok: true };
  });

  app.post<{ Params: { id: number } }>("/notes/:id/delete", {
    preHandler: app.authenticate,
    schema: { params: { type: "object", required: ["id"], properties: { id: { type: "integer", minimum: 1 } } } },
  }, async (request, reply) => {
    const note = app.db.prepare("SELECT path FROM documents WHERE id = ? AND status = 'active'").get(request.params.id) as { path: string } | undefined;
    if (!note) return reply.notFound("Note not found");
    const source = markdownSourcePath(app.config.notesRepo, note.path);
    if (source && existsSync(source)) unlinkSync(source);
    app.db.prepare("UPDATE documents SET status = 'missing' WHERE id = ?").run(request.params.id);
    syncNotes(app.db, app.config.notesRepo);
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
    const result = app.db.prepare("SELECT 1 FROM documents WHERE id = ?").get(request.params.id);
    if (!result) return reply.notFound("Note not found");
    updatePublication(app, request.params.id, request.body.visibility, request.body.published);
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
