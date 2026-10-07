import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Gallery from "./pages/Gallery";
import { Empty, Loading } from "./components/UI";
import "./styles/base.css";
const Admin = lazy(() => import("./pages/Admin"));
const Detail = lazy(() => import("./pages/ProjectDetail"));
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Gallery />} />
            <Route path="/p/:slug" element={<Detail />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route
              path="*"
              element={
                <Empty title="Page not found">
                  <Link to="/">Back to projects</Link>
                </Empty>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
