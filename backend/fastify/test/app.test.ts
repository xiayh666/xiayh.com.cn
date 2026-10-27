import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/database.js";
import { findNote, renderMarkdown } from "../src/services/notes.js";

test("markdown preserves fenced code languages while removing unsafe attributes", () => {
  const html = renderMarkdown('```typescript\nconst answer = 42;\n```\n\n<code class="language-js" onclick="alert(1)">safe</code>');
  assert.match(html, /class="language-typescript"/);
  assert.match(html, /class="language-js"/);
  assert.doesNotMatch(html, /onclick/);
});

test("reading an old article repairs cached code languages without synchronization", () => {
  const db = openDatabase(":memory:");
  try {
    const markdown = '# hello world\n\n```cpp\nstruct A {};\n```';
    db.prepare(`INSERT INTO documents (path, slug, title, content_hash, markdown, html, updated_at, published, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'public')`).run("hello world.md", "hello-world", "hello world", "old-hash", markdown,
      '<h1>hello world</h1><pre><code>struct A {};</code></pre>', "2026-10-27");
    const note = findNote(db, "hello-world", false);
    assert.match(note?.html ?? "", /class="language-cpp"/);
    assert.match((db.prepare("SELECT html FROM documents").get() as { html: string }).html, /class="language-cpp"/);
    assert.equal(findNote(db, "hello-world", false)?.html, note?.html);
  } finally {
    db.close();
  }
});

let app: FastifyInstance;
let cookie = "";
let notesRepo = "";

function multipartFile(content: Buffer, filename: string, mime: string) {
  const boundary = "----xiayh-site-test-boundary";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

before(async () => {
  process.env.NODE_ENV = "test";
  const root = mkdtempSync(join(tmpdir(), "xiayh-site-api-"));
  notesRepo = join(root, "notes");
  const mediaRoot = join(root, "media");
  mkdirSync(notesRepo);
  writeFileSync(join(notesRepo, "hello.md"), "# Hello\n\nA searchable note with $E = mc^2$.\n\n$$\n\\int_0^1 x^2 \\, dx = \\frac{1}{3}\n$$");
  app = await buildApp({
    logger: false,
    config: {
      databasePath: ":memory:",
      notesRepo,
      mediaRoot,
      imageUploadLimit: 16,
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
  assert.equal(response.headers["cache-control"], "no-store");
});

test("homepage stats count visits without inventing content data", async () => {
  const initial = await app.inject({ method: "GET", url: "/api/stats" });
  assert.deepEqual(initial.json(), { blogCount: 0, totalViews: 0, visits: 0 });

  const visit = await app.inject({ method: "POST", url: "/api/visits", payload: {} });
  assert.deepEqual(visit.json(), { visits: 1 });
  assert.equal(visit.headers["cache-control"], "no-store");

  const updated = await app.inject({ method: "GET", url: "/api/stats" });
  assert.equal(updated.json().visits, 1);
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
  assert.match(cookie, /^xiayh_site_session=/);

  const sync = await app.inject({ method: "POST", url: "/api/admin/sync", headers: { cookie }, payload: {} });
  assert.equal(sync.statusCode, 200);
  assert.deepEqual(sync.json(), { status: "ok", scanned: 1, changed: 1 });

  const publicList = await app.inject({ method: "GET", url: "/api/notes" });
  assert.deepEqual(publicList.json(), { items: [] });

  const adminList = await app.inject({ method: "GET", url: "/api/notes", headers: { cookie } });
  assert.equal(adminList.json().items[0].title, "hello");

  const mathNote = await app.inject({ method: "GET", url: "/api/notes/hello", headers: { cookie } });
  assert.match(mathNote.json().html, /class="katex"/);
  assert.match(mathNote.json().html, /class="katex-display"/);
  assert.match(mathNote.json().markdown, /searchable note/);
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
  assert.match(search.headers["cache-control"] ?? "", /public, max-age=60/);
  assert.match(search.headers.vary ?? "", /Cookie/);

  const adminSearch = await app.inject({ method: "GET", url: "/api/search?q=searchable", headers: { cookie } });
  assert.equal(adminSearch.headers["cache-control"], "no-store");

  const view = await app.inject({ method: "POST", url: "/api/views/hello", payload: {} });
  assert.equal(view.statusCode, 200);
  assert.equal(view.json().viewCount, 1);

  const note = await app.inject({ method: "GET", url: "/api/notes/hello" });
  assert.equal(note.json().viewCount, 1);
  assert.ok(note.json().publishedAt);
});

// 验证同步写入的全文内容会进入索引，同时公开搜索仍过滤未发布文章。
test("search index follows synchronization and preserves visibility", async () => {
  writeFileSync(join(notesRepo, "private-roadmap.md"), "# Roadmap\n\nThe vectorized lighthouse pipeline has a unique index token.");
  const sync = await app.inject({ method: "POST", url: "/api/admin/sync", headers: { cookie }, payload: {} });
  assert.equal(sync.statusCode, 200);

  const publicSearch = await app.inject({ method: "GET", url: "/api/search?q=vectorized" });
  assert.deepEqual(publicSearch.json(), { items: [] });

  const adminSearch = await app.inject({ method: "GET", url: "/api/search?q=lighthouse", headers: { cookie } });
  assert.equal(adminSearch.json().items[0].slug, "private-roadmap");
  assert.equal(adminSearch.headers["cache-control"], "no-store");
});

// 验证用户输入中的 FTS 保留字不会被当作查询语法而导致接口失败。
test("search handles FTS operator words as ordinary input", async () => {
  const response = await app.inject({ method: "GET", url: "/api/search?q=AND" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { items: [] });
});

// 验证管理员可通过安全的 Markdown 源文件闭环完成创建、读取、编辑和删除。
test("admin can manage repository-backed markdown sources", async () => {
  const created = await app.inject({
    method: "POST", url: "/api/admin/notes", headers: { cookie },
    payload: { path: "admin/new-post.md", content: "# Draft\n\nCreated online.", visibility: "private", published: false },
  });
  assert.equal(created.statusCode, 201);
  const id = created.json().id as number;

  const profile = await app.inject({ method: "GET", url: "/api/admin/profile", headers: { cookie } });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().username, "admin");
  assert.ok(profile.json().drafts >= 1);

  const source = await app.inject({ method: "GET", url: `/api/admin/notes/${id}/source`, headers: { cookie } });
  assert.equal(source.json().content, "# Draft\n\nCreated online.");

  const updated = await app.inject({
    method: "POST", url: `/api/admin/notes/${id}/content`, headers: { cookie }, payload: { content: "# Updated\n\nEdited online." },
  });
  assert.equal(updated.statusCode, 200);
  const updatedSource = await app.inject({ method: "GET", url: `/api/admin/notes/${id}/source`, headers: { cookie } });
  assert.match(updatedSource.json().content, /Edited online/);

  const unsafe = await app.inject({
    method: "POST", url: "/api/admin/notes", headers: { cookie },
    payload: { path: "../escape.md", content: "bad", visibility: "private", published: false },
  });
  assert.equal(unsafe.statusCode, 400);

  const deleted = await app.inject({ method: "POST", url: `/api/admin/notes/${id}/delete`, headers: { cookie }, payload: {} });
  assert.equal(deleted.statusCode, 200);
  const missing = await app.inject({ method: "GET", url: `/api/admin/notes/${id}/source`, headers: { cookie } });
  assert.equal(missing.statusCode, 404);
});

// 验证编辑器图片只能由管理员上传，并可通过返回的稳定 URL 公开读取。
test("admin can upload a supported editor image", async () => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const multipart = multipartFile(image, "diagram.png", "image/png");
  const anonymous = await app.inject({ method: "POST", url: "/api/admin/uploads/images", ...multipart });
  assert.equal(anonymous.statusCode, 401);

  const uploaded = await app.inject({ method: "POST", url: "/api/admin/uploads/images", headers: { ...multipart.headers, cookie }, payload: multipart.payload });
  assert.equal(uploaded.statusCode, 201);
  assert.match(uploaded.json().url, /^\/api\/media\/[a-z0-9-]+\.png$/);

  const served = await app.inject({ method: "GET", url: uploaded.json().url });
  assert.equal(served.statusCode, 200);
  assert.deepEqual(served.rawPayload, image);
  assert.match(served.headers["cache-control"] ?? "", /immutable/);
});

// 验证上传接口拒绝非图片类型和超过配置上限的文件。
test("editor image upload rejects unsafe inputs", async () => {
  const text = multipartFile(Buffer.from("not an image"), "payload.txt", "text/plain");
  const unsupported = await app.inject({ method: "POST", url: "/api/admin/uploads/images", headers: { ...text.headers, cookie }, payload: text.payload });
  assert.equal(unsupported.statusCode, 415);

  const spoofed = multipartFile(Buffer.from("not really png"), "spoofed.png", "image/png");
  const mismatched = await app.inject({ method: "POST", url: "/api/admin/uploads/images", headers: { ...spoofed.headers, cookie }, payload: spoofed.payload });
  assert.equal(mismatched.statusCode, 415);

  const large = multipartFile(Buffer.alloc(17, 1), "large.webp", "image/webp");
  const oversized = await app.inject({ method: "POST", url: "/api/admin/uploads/images", headers: { ...large.headers, cookie }, payload: large.payload });
  assert.equal(oversized.statusCode, 413);
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
  assert.equal(response.json().status, "ok");
  assert.equal(response.json().changed, 0);
  assert.ok(response.json().scanned >= 1);
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
