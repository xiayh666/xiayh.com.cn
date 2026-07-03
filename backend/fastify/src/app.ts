import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { mkdirSync } from "node:fs";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./database.js";
import { adminRoutes } from "./routes/admin.js";
import { publicRoutes } from "./routes/public.js";
import "./types.js";

export type BuildAppOptions = {
  config?: Partial<AppConfig>;
  logger?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = loadConfig(options.config);
  const app = Fastify({
    logger: options.logger ?? process.env.NODE_ENV !== "test",
    bodyLimit: config.requestBodyLimit,
    trustProxy: config.trustProxy,
  });

  app.decorate("config", config);
  app.decorate("db", openDatabase(config.databasePath));

  await app.register(sensible);
  await app.register(multipart, {
    limits: { files: 1, fileSize: config.imageUploadLimit, fields: 0, parts: 1 },
  });
  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    origin: config.corsOrigins.length ? config.corsOrigins : false,
    methods: ["GET", "POST", "OPTIONS"],
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: config.cookieName, signed: false },
    sign: { expiresIn: config.jwtExpiresIn },
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
      if (request.user.role !== "admin") throw new Error("Invalid role");
    } catch {
      await reply.unauthorized("Authentication required");
    }
  });

  mkdirSync(config.mediaRoot, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.mediaRoot,
    prefix: "/api/media/",
    decorateReply: false,
    immutable: true,
    maxAge: "1y",
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "GET" || !request.url.startsWith("/api/admin/")) return;
    const origin = request.headers.origin;
    if (!origin) return;
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === request.headers.host;
    } catch {
      // Invalid origins are rejected below.
    }
    if (!sameHost && !config.corsOrigins.includes(origin)) {
      await reply.forbidden("Origin is not allowed");
    }
  });

  await app.register(publicRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api/admin" });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    void reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : error.name,
      message: statusCode === 500 ? "An unexpected error occurred" : error.message,
      statusCode,
    });
  });

  app.addHook("onClose", async () => {
    app.db.close();
  });

  return app;
}
