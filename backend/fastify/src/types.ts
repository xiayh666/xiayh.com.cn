import type { DatabaseSync } from "node:sqlite";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "./config.js";

export type AdminJwt = {
  sub: string;
  role: "admin";
};

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: DatabaseSync;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AdminJwt;
    user: AdminJwt;
  }
}
