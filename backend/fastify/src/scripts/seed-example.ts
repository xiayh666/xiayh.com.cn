import { loadConfig } from "../config.js";
import { openDatabase } from "../database.js";
import { syncNotes } from "../services/notes.js";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const examplePaths = [
  "cpp/从 Hello World 开始理解 C++ 程序.md",
  "languages/Rust 所有权、借用与生命周期入门.md",
  "languages/TypeScript 可辨识联合与状态建模.md",
  "backend/fastify/Fastify 插件化架构与工程实践.md",
  "database/SQLite WAL 模式的原理与实践.md",
  "devops/docker/使用 Docker 多阶段构建精简生产镜像.md",
  "devops/linux/使用 systemd 可靠运行 Web 服务.md",
  "web/http/HTTP Cache-Control 缓存策略详解.md",
  "web/react/React Query 缓存设计与失效策略.md",
  "tools/git/使用交互式 Rebase 整理提交历史.md",
  "systems/WebAssembly 运行机制与应用边界.md",
];

try {
  const result = syncNotes(db, config.notesRepo);
  const publish = db.prepare(`
    UPDATE documents
    SET visibility = 'public', published = 1, published_at = COALESCE(published_at, updated_at)
    WHERE path = ?
  `);
  let published = 0;
  for (const path of examplePaths) published += Number(publish.run(path).changes);
  if (published !== examplePaths.length) {
    throw new Error(`Expected ${examplePaths.length} example notes, published ${published}`);
  }
  console.log(`Examples ready: scanned=${result.scanned}, changed=${result.changed}, published=${published}`);
} finally {
  db.close();
}
