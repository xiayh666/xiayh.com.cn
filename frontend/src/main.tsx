import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "katex/dist/katex.min.css";
import "./styles.css";
import { AppLayout } from "./shell/AppLayout";
import { WelcomePage } from "./pages/WelcomePage";
import { NotePage } from "./pages/NotePage";
import { AdminPage } from "./pages/AdminPage";
import { NewArticlePage } from "./pages/ArticleEditor";

type BootLoaderState = {
  fadeMs: number;
  minVisibleMs: number;
  readyClass: string;
  showDelayMs: number;
  showTimer?: number;
  shownAt: number;
  visibleClass: string;
};

declare global {
  interface Window {
    __bootLoader?: BootLoaderState;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <WelcomePage /> },
      { path: "notes/*", element: <NotePage /> },
      { path: "login", element: <AdminPage view="login" /> },
      { path: "settings", element: <AdminPage view="settings" /> },
      { path: "new", element: <NewArticlePage /> },
      { path: "admin", element: <Navigate to="/settings" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);

requestAnimationFrame(() => {
  const bootLoader = window.__bootLoader;
  const loaderElement = document.getElementById("boot-loader");

  if (!loaderElement) {
    return;
  }

  if (bootLoader?.showTimer) {
    window.clearTimeout(bootLoader.showTimer);
  }

  const visibleClass = bootLoader?.visibleClass ?? "boot-loader-visible";
  const readyClass = bootLoader?.readyClass ?? "app-ready";
  const fadeMs = bootLoader?.fadeMs ?? 260;
  const minVisibleMs = bootLoader?.minVisibleMs ?? 500;
  const isVisible = document.documentElement.classList.contains(visibleClass);
  const elapsedVisibleMs = bootLoader?.shownAt ? performance.now() - bootLoader.shownAt : 0;
  const remainingVisibleMs = isVisible ? Math.max(0, minVisibleMs - elapsedVisibleMs) : 0;

  window.setTimeout(() => {
    document.documentElement.classList.add(readyClass);
    document.documentElement.classList.remove(visibleClass);

    window.setTimeout(() => {
      loaderElement.remove();
      delete window.__bootLoader;
    }, fadeMs + 40);
  }, remainingVisibleMs);
});
