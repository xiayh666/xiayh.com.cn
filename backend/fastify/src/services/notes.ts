import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import sanitizeHtml from "sanitize-html";

type DocumentRow = {
  id: number;
  path: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  visibility: "private" | "unlisted" | "public";
  published: number;
  pinned: number;
  status: string;
  updatedAt: string;
  previewPath: string;
  publishedAt: string;
  viewCount: number;
  tags: string;
  html?: string;
  markdown?: string;
};

export type Note = Omit<DocumentRow, "published" | "pinned" | "tags"> & {
  published: boolean;
  pinned: boolean;
  tags: string[];
};

const summaryColumns = `
  id, path, slug, title, summary, type, visibility,
  published, pinned, status, updated_at AS updatedAt,
  preview_path AS previewPath,
  COALESCE(published_at, updated_at) AS publishedAt,
  view_count AS viewCount
  , COALESCE((SELECT json_group_array(t.name) FROM document_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.document_id = documents.id), '[]') AS tags
`;

function mapNote(row: DocumentRow): Note {
  return { ...row, published: Boolean(row.published), pinned: Boolean(row.pinned), tags: JSON.parse(row.tags) as string[] };
}

function visibilityClause(isAdmin: boolean): string {
  return isAdmin ? "status = 'active'" : "status = 'active' AND published = 1 AND visibility = 'public'";
}

export function listNotes(db: DatabaseSync, isAdmin: boolean): Note[] {
  const rows = db.prepare(`
    SELECT ${summaryColumns}
    FROM documents
    WHERE ${visibilityClause(isAdmin)}
    ORDER BY pinned DESC, updated_at DESC
  `).all() as unknown as DocumentRow[];
  return rows.map(mapNote);
}

export function findNote(db: DatabaseSync, slug: string, isAdmin: boolean): Note | undefined {
  const row = db.prepare(`
    SELECT ${summaryColumns}, html, markdown
    FROM documents
    WHERE slug = ? AND ${visibilityClause(isAdmin)}
  `).get(slug) as unknown as DocumentRow | undefined;
  return row ? mapNote(row) : undefined;
}

export function searchNotes(db: DatabaseSync, query: string, isAdmin: boolean): Note[] {
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = db.prepare(`
    SELECT ${summaryColumns}
    FROM documents
    WHERE ${visibilityClause(isAdmin)}
      AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR path LIKE ? ESCAPE '\\')
    ORDER BY pinned DESC, updated_at DESC
    LIMIT 100
  `).all(pattern, pattern, pattern) as unknown as DocumentRow[];
  return rows.map(mapNote);
}

function markdownFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && [".md", ".markdown"].includes(extname(entry.name).toLowerCase())) result.push(path);
    }
  };
  visit(root);
  return result;
}

function slugFor(path: string): string {
  return path
    .replace(/\.(md|markdown)$/i, "")
    .split(sep)
    .map((part) => part.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("/");
}

function metadata(content: string, filename: string): { title: string; summary: string } {
  const title = filename;
  const summary = content
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[`*_>\[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return { title, summary };
}

export function renderMarkdown(content: string): string {
  const mathFragments = new Map<string, string>();
  const markerPrefix = `katex-${randomUUID()}`;
  const katexExtension = markedKatex({
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxExpand: 1_000,
    maxSize: 20,
  });

  for (const extension of katexExtension.extensions ?? []) {
    if (!("renderer" in extension)) continue;
    const renderKatex = extension.renderer;
    extension.renderer = function renderMathPlaceholder(token) {
      const id = `${markerPrefix}-${mathFragments.size}`;
      const rendered = renderKatex.call(this, token);
      if (typeof rendered !== "string") return rendered;
      mathFragments.set(id, rendered);
      return `<span data-katex-placeholder="${id}"></span>`;
    };
  }

  const rendered = new Marked(katexExtension).parse(content, { async: false }) as string;
  const sanitized = sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title"],
      span: ["data-katex-placeholder"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });

  return sanitized.replace(
    /<span data-katex-placeholder="([^"]+)"><\/span>/g,
    (placeholder, id: string) => mathFragments.get(id) ?? placeholder,
  );
}

export function syncNotes(db: DatabaseSync, notesRepo: string): { status: string; scanned: number; changed: number } {
  const root = resolve(notesRepo);
  const files = markdownFiles(root);
  const activePaths = new Set<string>();
  let changed = 0;

  const previous = db.prepare("SELECT content_hash AS hash, markdown FROM documents WHERE path = ?");
  const upsert = db.prepare(`
    INSERT INTO documents (path, slug, title, summary, content_hash, markdown, html, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      summary = excluded.summary,
      content_hash = excluded.content_hash,
      markdown = excluded.markdown,
      html = excluded.html,
      updated_at = excluded.updated_at,
      status = 'active'
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const absolutePath of files) {
      const path = relative(root, absolutePath);
      if (path.startsWith(`..${sep}`) || path === "..") continue;
      activePaths.add(path);
      const content = readFileSync(absolutePath, "utf8");
      const hash = createHash("sha256").update(`filename-title-katex-v2\0${content}`).digest("hex");
      const old = previous.get(path) as { hash: string; markdown: string } | undefined;
      if (old?.hash === hash && old.markdown === content) continue;
      const filename = basename(path, extname(path));
      const { title, summary } = metadata(content, filename);
      const html = renderMarkdown(content);
      upsert.run(path, slugFor(path), title, summary, hash, content, html, statSync(absolutePath).mtime.toISOString());
      changed += 1;
    }

    const known = db.prepare("SELECT path FROM documents WHERE status = 'active'").all() as unknown as Array<{ path: string }>;
    const markMissing = db.prepare("UPDATE documents SET status = 'missing' WHERE path = ?");
    for (const row of known) {
      if (!activePaths.has(row.path)) markMissing.run(row.path);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { status: "ok", scanned: files.length, changed };
}
