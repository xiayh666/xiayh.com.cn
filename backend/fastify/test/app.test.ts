import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

let app: FastifyInstance;
let cookie = "";

before(async () => {
  process.env.NODE_ENV = "test";
  const root = mkdtempSync(join(tmpdir(), "cm311-api-"));
  const notesRepo = join(root, "notes");
  mkdirSync(notesRepo);
  writeFileSync(join(notesRepo, "hello.md"), "# Hello\n\nA searchable note.");
  app = await buildApp({
    logger: false,
    config: {
      databasePath: ":memory:",
      notesRepo,
      adminUsername: "admin",
      adminPassword: "secret",
      syncToken: "test-sync-token-that-is-at-least-32-characters",
      jwtSecret: "test-only-secret-that-is-at-least-32-characters",
      cookieSecure: false,
    },
  });
});

after(async () => app.close());

test("health endpoint reports readiness", async () => {
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});

test("session endpoint reports an anonymous visitor", async () => {
  const response = await app.inject({ method: "GET", url: "/api/session" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { authenticated: false, username: null });
});

test("admin routes reject unauthenticated requests", async () => {
  const response = await app.inject({ method: "POST", url: "/api/admin/sync", payload: {} });
  assert.equal(response.statusCode, 401);
});

test("login issues JWT cookie and sync keeps new notes private", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/api/admin/login",
    payload: { username: "admin", password: "secret" },
  });
  assert.equal(login.statusCode, 200);
  const setCookie = login.headers["set-cookie"];
  cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(";")[0] ?? "";
  assert.match(cookie, /^cm311_session=/);

  const sync = await app.inject({ method: "POST", url: "/api/admin/sync", headers: { cookie }, payload: {} });
  assert.equal(sync.statusCode, 200);
  assert.deepEqual(sync.json(), { status: "ok", scanned: 1, changed: 1 });

  const publicList = await app.inject({ method: "GET", url: "/api/notes" });
  assert.deepEqual(publicList.json(), { items: [] });

  const adminList = await app.inject({ method: "GET", url: "/api/notes", headers: { cookie } });
  assert.equal(adminList.json().items[0].title, "hello");
});

test("admin can publish a note and public search can find it", async () => {
  const list = await app.inject({ method: "GET", url: "/api/notes", headers: { cookie } });
  const id = list.json().items[0].id as number;
  const update = await app.inject({
    method: "POST",
    url: `/api/admin/notes/${id}/visibility`,
    headers: { cookie },
    payload: { visibility: "public", published: true },
  });
  assert.equal(update.statusCode, 200);

  const search = await app.inject({ method: "GET", url: "/api/search?q=searchable" });
  assert.equal(search.json().items[0].slug, "hello");

  const view = await app.inject({ method: "POST", url: "/api/views/hello", payload: {} });
  assert.equal(view.statusCode, 200);
  assert.equal(view.json().viewCount, 1);

  const note = await app.inject({ method: "GET", url: "/api/notes/hello" });
  assert.equal(note.json().viewCount, 1);
  assert.ok(note.json().publishedAt);
});

test("cross-origin admin mutation is rejected", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/sync",
    headers: { cookie, origin: "https://attacker.example" },
    payload: {},
  });
  assert.equal(response.statusCode, 403);
});

test("service sync token can run synchronization without admin credentials", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/sync",
    headers: { "x-sync-token": "test-sync-token-that-is-at-least-32-characters" },
    payload: {},
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok", scanned: 1, changed: 0 });
});

test("nested note slugs resolve through the wildcard route", async () => {
  app.db.prepare(`
    INSERT INTO documents (path, slug, title, visibility, published, content_hash, html, updated_at)
    VALUES (?, ?, ?, 'public', 1, ?, ?, ?)
  `).run(
    "cpp/basics/nested.md",
    "cpp/basics/nested",
    "Nested note",
    "nested-hash",
    "<p>Nested content</p>",
    new Date().toISOString(),
  );

  const response = await app.inject({ method: "GET", url: "/api/notes/cpp/basics/nested" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().title, "Nested note");
});
