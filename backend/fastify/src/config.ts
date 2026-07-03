import { resolve } from "node:path";

export type AppConfig = {
  host: string;
  port: number;
  databasePath: string;
  notesRepo: string;
  mediaRoot: string;
  imageUploadLimit: number;
  adminUsername: string;
  adminPassword: string;
  syncToken: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieName: string;
  cookieSecure: boolean;
  corsOrigins: string[];
  requestBodyLimit: number;
  trustProxy: boolean;
};

function integer(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function boolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const isTest = process.env.NODE_ENV === "test";
  if (!isTest && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  const syncToken = process.env.SYNC_TOKEN ?? "";
  if (!isTest && syncToken.length < 32) {
    throw new Error("SYNC_TOKEN must contain at least 32 characters");
  }

  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: integer("PORT", 8080),
    databasePath: resolve(process.env.DATABASE_PATH ?? "./data/blog.sqlite3"),
    notesRepo: resolve(process.env.NOTES_REPO ?? "./data/notes"),
    mediaRoot: resolve(process.env.MEDIA_ROOT ?? "./data/media"),
    imageUploadLimit: integer("IMAGE_UPLOAD_LIMIT", 5_242_880),
    adminUsername: process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "",
    syncToken,
    jwtSecret: jwtSecret || "test-only-secret-that-is-at-least-32-characters",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
    cookieName: process.env.COOKIE_NAME ?? "cm311_session",
    cookieSecure: boolean("COOKIE_SECURE", process.env.NODE_ENV === "production"),
    corsOrigins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    requestBodyLimit: integer("REQUEST_BODY_LIMIT", 1_048_576),
    trustProxy: boolean("TRUST_PROXY", false),
    ...overrides,
  };
}
