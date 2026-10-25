# Xiayh 的个人网站

这是 Xiayh 的个人网站，用于发布文章、展示项目与兴趣，以及维护个人在线主页。项目采用轻量化自托管方案，可部署在运行 Armbian Ubuntu 的服务器上。

私有 GitHub 笔记仓库仅作为原始内容来源。文章发布信息、渲染缓存、登录会话、分享令牌、同步日志和搜索索引均存储在 SQLite 中。

## 项目结构

```text
backend/fastify/  TypeScript/Fastify API 服务
frontend/         React + Vite 静态网站
deploy/           Nginx、Caddy 与 systemd 部署模板
data/             本地 SQLite、媒体文件和笔记仓库，不提交到 Git
```

## 后端开发环境

```bash
pnpm --dir backend/fastify install
cp deploy/blog.env .env
# 编辑 .env，替换所有密钥和示例值。
pnpm --dir backend/fastify dev
```

首次运行前，可初始化本地示例文章：

```bash
pnpm --dir backend/fastify seed:examples
```

为 `ADMIN_PASSWORD` 生成密码哈希：

```bash
pnpm --dir backend/fastify hash-password 'your-password'
```

JWT 密钥和同步密钥必须分别生成，例如：

```bash
openssl rand -hex 32
```

API 默认监听 `127.0.0.1:8080`。Vite 开发服务器会将 `/api` 请求代理到该地址。

## 日常开发命令

项目保留前后端独立的 lockfile，以使 Docker 镜像和裸机部署能够各自使用 `--frozen-lockfile`；仓库根目录提供统一的开发命令入口。首次开发仍需分别安装两个活跃应用的依赖：

```bash
pnpm --dir backend/fastify install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
```

之后从根目录运行：

```bash
pnpm dev:api       # API 开发服务
pnpm dev:web       # Vite 开发服务
pnpm lint          # 前端 ESLint
pnpm typecheck     # 前后端 TypeScript 检查
pnpm test          # 前后端回归测试
pnpm build         # 前后端生产构建
pnpm quality       # lint + typecheck + test + build
```

## 构建

```bash
pnpm --dir backend/fastify build
pnpm --dir frontend install
pnpm --dir frontend build
```

也可以通过以下命令生成可部署的软件包：

```bash
xmake package
```

## 测试

```bash
pnpm --dir backend/fastify typecheck
pnpm --dir backend/fastify test
pnpm --dir frontend test
```

也可以通过顶层任务运行前后端测试：

```bash
xmake test
```

## 后端架构

- `src/app.ts`：Fastify 应用组合入口与安全插件配置。
- `src/routes`：供前端调用的稳定 HTTP 接口。
- `src/services`：与 Web 框架解耦的文章同步和查询服务。
- `src/database.ts`：SQLite 数据结构和连接生命周期管理。
- `src/config.ts`：环境配置读取与启动校验。

Fastify 使用明确的 CORS 允许列表、Helmet 安全响应头、请求体和频率限制、JSON Schema 校验、JWT 身份验证、HttpOnly SameSite Cookie，以及管理操作的 Origin 校验。定时同步任务使用独立的 `SYNC_TOKEN`，不会存储或传输管理员密码。

公开读取接口使用短生命周期的 HTTP 缓存策略，登录态和写操作均为 `no-store`；媒体文件与 Vite 哈希资源可长期缓存。文章搜索由 SQLite FTS5 提供全文索引，索引随文章同步和编辑自动维护。具体模块边界、缓存契约和上线检查见 [架构与性能指南](doc/architecture-performance-hardening/architecture.md)。

## 初始化文章同步

使用只读 SSH Deploy Key 克隆私有笔记仓库：

```bash
git clone git@github.com:OWNER/PRIVATE-NOTES.git data/notes
```

可以在管理界面中执行同步，也可以直接调用接口：

```bash
curl -X POST http://127.0.0.1:8080/api/admin/sync \
  -H "x-sync-token: $SYNC_TOKEN" \
  -H 'content-type: application/json' \
  --data '{}'
```

新发现的 Markdown 文件默认设置为 `visibility = private` 和 `published = false`，不会直接公开发布。

个人网站编辑器上传的图片保存在 `MEDIA_ROOT` 下，并通过 `/api/media/` 提供访问。默认单张图片上限为 5 MiB，可使用 `IMAGE_UPLOAD_LIMIT` 调整。

## 部署说明

- 将构建产物放在 `/opt/xiayh-personal-site`。
- 将 `deploy/blog.env` 复制到 `/opt/xiayh-personal-site/blog.env`，限制服务用户的文件权限，并替换所有密钥。
- 使用 `pnpm --dir /opt/xiayh-personal-site/backend install --prod --frozen-lockfile` 安装生产依赖。
- 安装 `deploy/blog-api.service`、`deploy/blog-sync.service` 和 `deploy/blog-sync.timer`。
- Nginx 部署时，确认 `deploy/nginx.conf` 中的域名和部署路径正确，然后安装并启用配置：

  ```bash
  sudo cp deploy/nginx.conf /etc/nginx/sites-available/xiayh-personal-site
  sudo ln -s /etc/nginx/sites-available/xiayh-personal-site /etc/nginx/sites-enabled/xiayh-personal-site
  sudo nginx -t
  sudo systemctl reload nginx
  ```

- 域名解析到服务器且 HTTP 可访问后，签发 HTTPS 证书。生产环境的登录 Cookie 设置了 `Secure`，因此管理功能必须通过 HTTPS 使用：

  ```bash
  sudo certbot --nginx -d xiayh.com.cn -d www.xiayh.com.cn
  sudo nginx -t
  sudo systemctl reload nginx
  ```

- 如果继续使用 Caddy，则确认 `deploy/Caddyfile` 使用实际域名；Nginx 与 Caddy 不应同时监听 80/443 端口。
- 不要直接暴露 `data/notes`、`.git` 或 `.excalidraw` 源文件。

## 当前限制

- JWT 登出会清除浏览器 Cookie，但暂未维护服务端令牌吊销列表，因此登录令牌使用较短的有效期。
- 同步任务目前只扫描 Markdown 文件；Excalidraw 预览映射仍作为 API 模型中的预留能力。
- Milkdown/CodeMirror 编辑器只在管理编辑路径下载；如果未来需要进一步压缩编辑路径，应先以真实编辑器使用数据决定是否替换该功能集。
