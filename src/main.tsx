import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import { loadApi } from "./data/api";
import { CONFIG_OK, IS_DEMO } from "./lib/env";

// Preview (demo) usa HashRouter: funciona em qualquer hospedagem estática sem rewrite.
const Router = IS_DEMO ? HashRouter : BrowserRouter;
import { AuthProvider } from "./auth/AuthProvider";
import { ConfirmProvider } from "./components/ui/Modal";
import { App } from "./App";
import { ConfigMissing } from "./pages/auth/ConfigMissing";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, e: any) => n < 1 && e?.code !== "42501", refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root")!);
if (!CONFIG_OK) {
  root.render(<ConfigMissing />);
} else {
  loadApi().then(() => {
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={qc}>
          <Router basename={IS_DEMO ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <ConfirmProvider>
                <App />
                <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ className: "!rounded-xl" }} />
              </ConfirmProvider>
            </AuthProvider>
          </Router>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  });
}
