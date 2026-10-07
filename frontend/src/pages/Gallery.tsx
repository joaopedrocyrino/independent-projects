import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUpRight,
  Code2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import type { Page, Tag } from "../types";
import { Button, Empty, ErrorBox, Loading } from "../components/UI";
import ProjectCard from "../components/ProjectCard";
import "./Gallery.css";
export default function Gallery() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const [mobileFilters, setMobileFilters] = useState(false);
  const normalized = new URLSearchParams();
  for (const key of ["q", "stack", "cloud", "type", "page"])
    for (const value of params.getAll(key)) normalized.append(key, value);
  const query = normalized.toString();
  const projects = useQuery({
    queryKey: ["projects", query],
    queryFn: () => api<Page>("/projects?" + query),
  });
  const facets = useQuery({
    queryKey: ["facets"],
    queryFn: () => api<Tag[]>("/facets"),
  });
  useEffect(() => {
    setSearch(params.get("q") || "");
  }, [params.get("q")]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== (params.get("q") || "")) {
        const next = new URLSearchParams(params);
        next.delete("page");
        if (search) next.set("q", search);
        else next.delete("q");
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, params, setParams]);
  const selected = ["stack", "cloud", "type"].flatMap((key) =>
    params.getAll(key).map((value) => ({ key, value })),
  );
  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params);
    const values = next.getAll(key);
    next.delete(key);
    for (const v of values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value])
      next.append(key, v);
    next.delete("page");
    setParams(next);
  }
  const page = projects.data?.page || 1;
  const pages = Math.ceil(
    (projects.data?.total || 0) / (projects.data?.pageSize || 12),
  );
  return (
    <>
      <header className="site-header wrap">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Code2 size={20} />
          </span>
          cyrino<span className="brand-divider">/</span>
          <b>projects</b>
        </Link>
        <nav>
          <a
            href="https://github.com/joaopedrocyrino"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub <ArrowUpRight size={15} />
          </a>
          <Link to="/admin" className="admin-link">
            Admin
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero wrap">
          <div className="hero-label">
            <span /> Independent projects. Working ideas.
          </div>
          <h1>
            A little curiosity.
            <br />
            <span>A lot of building.</span>
          </h1>
          <p>
            A collection of things I’ve made — from first experiments to fully
            working applications. Explore the demos and the code behind them.
          </p>
          <a href="#projects" className="hero-cta">
            Explore the projects <ArrowDown size={17} />
          </a>
          <div className="hero-decoration" aria-hidden="true">
            <div className="code-window">
              <div className="window-dots">
                <i />
                <i />
                <i />
                <span>ideas.ts</span>
              </div>
              <p>
                <em>const</em> curiosity = <b>"always on"</b>;
              </p>
              <p>
                <em>while</em> (learning) {"{"}
              </p>
              <p className="indent">
                build.something(<b>meaningful</b>);
              </p>
              <p>{"}"}</p>
              <div className="window-footer">
                <span /> Ready for the next idea
              </div>
            </div>
            <span className="floating-label">Made to be explored ↗</span>
          </div>
        </section>
        <section id="projects" className="catalog wrap">
          <div className="catalog-heading">
            <div>
              <span className="eyebrow">The collection</span>
              <h2>
                Projects, in the wild
                <span className="count-pill">
                  {projects.data?.total ?? "…"}
                </span>
              </h2>
            </div>
            <p>Different stacks. Same love for building.</p>
          </div>
          <div className="filter-bar">
            <label className="search">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
              />
            </label>
            <Button
              className="secondary mobile-filter"
              onClick={() => setMobileFilters(!mobileFilters)}
            >
              <SlidersHorizontal size={16} /> Filters{" "}
              {selected.length > 0 && `(${selected.length})`}
            </Button>
            <div className={`filter-groups ${mobileFilters ? "open" : ""}`}>
              {(
                [
                  ["stack", "Stack"],
                  ["cloud", "Cloud"],
                  ["type", "Type"],
                ] as const
              ).map(([key, label]) => (
                <details key={key} className="filter-menu">
                  <summary>
                    {label}
                    <span>{params.getAll(key).length || "⌄"}</span>
                  </summary>
                  <div className="filter-options">
                    {(facets.data || [])
                      .filter((t) => t.category.toLowerCase() === key)
                      .map((t) => (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            checked={params.getAll(key).includes(t.key)}
                            onChange={() => toggle(key, t.key)}
                          />
                          <span>{t.name}</span>
                          <small>{t.count}</small>
                        </label>
                      ))}
                    {!(facets.data || []).some(
                      (t) => t.category.toLowerCase() === key,
                    ) && <p>No tags yet</p>}
                  </div>
                </details>
              ))}
            </div>
          </div>
          {selected.length > 0 && (
            <div className="selected-filters">
              {selected.map(({ key, value }) => (
                <button key={key + value} onClick={() => toggle(key, value)}>
                  {facets.data?.find(
                    (t) => t.key === value && t.category.toLowerCase() === key,
                  )?.name || value}
                  <X size={12} />
                </button>
              ))}
              <button
                className="clear"
                onClick={() => {
                  setParams({});
                  setSearch("");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {projects.isLoading ? (
            <Loading />
          ) : projects.error ? (
            <ErrorBox error={projects.error} />
          ) : projects.data?.items.length ? (
            <div className="project-grid">
              {projects.data.items.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                params.size
                  ? "No projects match these filters"
                  : "The next idea starts here"
              }
            >
              {params.size
                ? "Try another stack, cloud, or project type."
                : "Projects will appear here when they are published through the admin portal."}
            </Empty>
          )}
          {pages > 1 && (
            <div className="pagination">
              <Button
                className="secondary"
                disabled={page === 1}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(page - 1));
                  setParams(next);
                }}
              >
                Previous
              </Button>
              <span>
                Page {page} of {pages}
              </span>
              <Button
                className="secondary"
                disabled={page >= pages}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(page + 1));
                  setParams(next);
                }}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer wrap">
        <span>Designed, developed, and constantly improved.</span>
        <span>
          João Cyrino <span className="footer-dot">✳</span>{" "}
          {new Date().getFullYear()}
        </span>
      </footer>
    </>
  );
}
