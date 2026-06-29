import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "./styles.css";
import { AppLayout } from "./shell/AppLayout";
import { WelcomePage } from "./pages/WelcomePage";
import { NotePage } from "./pages/NotePage";
import { AdminPage } from "./pages/AdminPage";

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
