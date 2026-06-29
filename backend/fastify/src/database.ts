import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'markdown',
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active',
  content_hash TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  preview_path TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#89b4fa'
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS documents_public_idx
  ON documents(status, published, visibility, updated_at DESC);
`;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(schema);
  const columns = new Set(
    (db.prepare("PRAGMA table_info(documents)").all() as unknown as Array<{ name: string }>).map((column) => column.name),
  );
  if (!columns.has("published_at")) db.exec("ALTER TABLE documents ADD COLUMN published_at TEXT");
  if (!columns.has("view_count")) db.exec("ALTER TABLE documents ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0");
  return db;
}
