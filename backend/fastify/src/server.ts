import { buildApp } from "./app.js";

const app = await buildApp();

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: app.config.host, port: app.config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
