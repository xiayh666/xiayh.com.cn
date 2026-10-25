import { lazy } from "react";

export const LazyWelcomePage = lazy(() => import("./WelcomePage").then((module) => ({ default: module.WelcomePage })));
export const LazyNotePage = lazy(() => import("./NotePage").then((module) => ({ default: module.NotePage })));
export const LazyAdminPage = lazy(() => import("./AdminPage").then((module) => ({ default: module.AdminPage })));
export const LazyNewArticlePage = lazy(() => import("./ArticleEditor").then((module) => ({ default: module.NewArticlePage })));
