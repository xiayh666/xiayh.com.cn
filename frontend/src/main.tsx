import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "./styles.css";
import { api } from "./api";
import { loadWelcomePage } from "./pages/lazyRoutes";
import { AppLayout } from "./shell/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Begin critical route and shared data work before React's first effects run.
void loadWelcomePage().catch(() => undefined);
void queryClient.prefetchQuery({ queryKey: ["notes"], queryFn: api.notes });
void queryClient.prefetchQuery({ queryKey: ["stats"], queryFn: api.stats });
void queryClient.prefetchQuery({ queryKey: ["session"], queryFn: api.session, staleTime: 60_000 });

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true },
      { path: "notes/*" },
      { path: "login" },
      { path: "settings" },
      { path: "new" },
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
