import { useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Code2,
  KeyRound,
  LogOut,
  Plus,
  Search,
} from "lucide-react";
import { ApiError, api, json, resetCsrf } from "../lib/api";
import type { Page } from "../types";
import {
  Artwork,
  Button,
  Empty,
  ErrorBox,
  Loading,
  StatusBadge,
} from "../components/UI";
import ProjectEditor from "./ProjectEditor";
import "./Admin.css";
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trust, setTrust] = useState(false);
  const client = useQueryClient();
  const login = useMutation({
    mutationFn: async () => {
      await api(
        "/auth/login",
        json("POST", { email, password, trustDevice: trust }),
      );
      resetCsrf();
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["session"] }),
  });
  return (
    <main className="login-screen">
      <Link to="/" className="login-brand">
        <Code2 size={22} /> projects
      </Link>
      <div className="login-card">
        <span className="eyebrow">Your workspace</span>
        <h1>Welcome back.</h1>
        <p>A good place for your next idea.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={trust}
              onChange={(e) => setTrust(e.target.checked)}
            />{" "}
            Trust this device for 15 days
          </label>
          {login.error && <ErrorBox error={login.error} />}
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
            <ArrowUpRight size={17} />
          </Button>
        </form>
      </div>
      <Link to="/" className="back-link">
        ← Back to the public gallery
      </Link>
    </main>
  );
}
function AdminList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("All");
  const q = useQuery({
    queryKey: ["admin-projects", search, page, filter],
    queryFn: () =>
      api<Page>(
        "/admin/projects?q=" +
          encodeURIComponent(search) +
          "&page=" +
          page +
          (filter === "All" ? "" : "&status=" + filter),
      ),
  });
  const projects = q.data?.items || [];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">The workspace</span>
          <h1>Your projects</h1>
          <p>Build, document, and share what you’re working on.</p>
        </div>
        <Link to="/admin/new" className="button">
          <Plus size={17} /> New project
        </Link>
      </div>
      <div className="admin-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            placeholder="Search your projects…"
            aria-label="Search your projects"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="admin-tabs">
          {["All", "Published", "Draft", "Archived"].map((s) => (
            <button
              className={filter === s ? "active" : ""}
              key={s}
              onClick={() => {
                setFilter(s);
                setPage(1);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : !projects.length ? (
        <Empty title="Room for your next idea">
          Create a project, add previews, then publish when it’s ready.
        </Empty>
      ) : (
        <div className="admin-project-grid">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/admin/projects/${p.id}`}
              className="admin-project"
            >
              <div className="admin-thumb">
                <Artwork project={p} />
              </div>
              <div>
                <StatusBadge status={p.status} />
                <h2>{p.title}</h2>
                <p>{p.summary}</p>
                <small>
                  {p.media.length} previews · Updated{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </small>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      )}
      {q.data && q.data.total > 50 && (
        <div className="pagination">
          <Button
            className="secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {Math.ceil(q.data.total / 50)}
          </span>
          <Button
            className="secondary"
            disabled={page * 50 >= q.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
function Password() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api("/auth/password", json("POST", { currentPassword, newPassword })),
    onSuccess: () => {
      setCurrent("");
      setNew("");
    },
  });
  return (
    <section className="settings-card">
      <h1>Change password</h1>
      <p>Other sessions will be signed out.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={16}
            maxLength={512}
            required
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <small>At least 16 characters.</small>
        </label>
        {save.error && <ErrorBox error={save.error} />}{" "}
        {save.isSuccess && <p className="success">Password updated.</p>}
        <Button disabled={save.isPending}>Update password</Button>
      </form>
    </section>
  );
}
export default function Admin() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api<{ email: string }>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 0,
  });
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", json("POST")),
    onSuccess: () => {
      resetCsrf();
      client.clear();
      navigate("/admin");
    },
  });
  if (session.isLoading) return <Loading />;
  if (session.error) return <ErrorBox error={session.error} />;
  if (!session.data) return <Login />;
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link to="/admin" className="brand">
          <span className="brand-mark">
            <Code2 size={20} />
          </span>
          projects<span className="workspace-badge">workspace</span>
        </Link>
        <nav>
          <Link to="/" title="Public gallery">
            <ArrowUpRight size={17} />
            <span>View gallery</span>
          </Link>
          <Link to="/admin/settings" title="Account settings">
            <KeyRound size={17} />
            <span>Settings</span>
          </Link>
          <Button
            className="icon-button secondary"
            aria-label="Sign out"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={17} />
          </Button>
        </nav>
      </header>
      {logout.error && <ErrorBox error={logout.error} />}
      <main className="admin-main">
        <Routes>
          <Route index element={<AdminList />} />
          <Route path="new" element={<ProjectEditor />} />
          <Route path="projects/:id" element={<ProjectEditor />} />
          <Route path="settings" element={<Password />} />
          <Route
            path="*"
            element={
              <Empty title="Page not found">
                <Link to="/admin">Return to workspace</Link>
              </Empty>
            }
          />
        </Routes>
      </main>
      <footer className="admin-footer">
        Your projects. One little corner of the internet.
      </footer>
    </div>
  );
}
