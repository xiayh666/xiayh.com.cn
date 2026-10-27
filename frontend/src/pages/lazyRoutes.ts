import { lazy } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { loadMarkdownReader } from "./loadMarkdownReader";

export const loadWelcomePage = () => import("./WelcomePage").then((module) => ({ default: module.WelcomePage }));
const loadNotePage = () => import("./NotePage").then((module) => ({ default: module.NotePage }));

export const LazyWelcomePage = lazy(loadWelcomePage);
export const LazyNotePage = lazy(loadNotePage);
export const LazyAdminPage = lazy(() => import("./AdminPage").then((module) => ({ default: module.AdminPage })));
export const LazyNewArticlePage = lazy(() => import("./ArticleEditor").then((module) => ({ default: module.NewArticlePage })));

// Start all three in parallel; the query cache deduplicates intent and navigation requests.
export function preloadArticle(client: QueryClient, slug: string) {
  void loadNotePage().catch(() => undefined);
  void loadMarkdownReader().catch(() => undefined);
  void client.prefetchQuery({
    queryKey: ["note", slug],
    queryFn: ({ signal }) => api.note(slug, signal),
    staleTime: 30_000,
  });
}
