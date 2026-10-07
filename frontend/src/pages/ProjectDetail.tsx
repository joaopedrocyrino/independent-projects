import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Code2, Copy, Github, Globe, Play, X } from "lucide-react";
import { api } from "../lib/api";
import type { Project } from "../types";
import { Artwork, Button, ErrorBox, External, Loading } from "../components/UI";
import "./ProjectDetail.css";
export default function ProjectDetail() {
  const { slug } = useParams();
  const query = useQuery({
    queryKey: ["project", slug],
    queryFn: () => api<Project>("/projects/" + encodeURIComponent(slug!)),
  });
  const [embed, setEmbed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (query.isLoading) return <Loading />;
  if (query.error)
    return (
      <div className="wrap detail">
        <Link to="/">← Back to projects</Link>
        <ErrorBox error={query.error} />
      </div>
    );
  const p = query.data!;
  return (
    <main className="wrap detail">
      <header className="detail-top">
        <Link to="/" className="back-link">
          <ArrowLeft size={17} /> All projects
        </Link>
        <Button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy size={15} />
          {copied ? "Link copied" : "Share project"}
        </Button>
      </header>
      <div className="detail-heading">
        <span className="eyebrow">
          {p.tags
            .filter((t) => t.category === "Type")
            .map((t) => t.name)
            .join(" · ")}
        </span>
        <h1>{p.title}</h1>
        <p>{p.summary}</p>
        <div className="detail-links">
          {p.demoUrl && (
            <External href={p.demoUrl}>
              <Play size={16} /> Open demo
            </External>
          )}
          {p.githubUrl && (
            <External href={p.githubUrl} className="secondary">
              <Github size={17} /> Source code
            </External>
          )}
          {p.websiteUrl && (
            <External href={p.websiteUrl} className="secondary">
              <Globe size={17} /> Website
            </External>
          )}
        </div>
      </div>
      <div className="detail-cover">
        <Artwork project={p} />
      </div>
      <div className="detail-columns">
        <section>
          <span className="eyebrow">Behind the project</span>
          <h2>What it’s all about</h2>
          <p className="description">{p.description || p.summary}</p>
        </section>
        <aside>
          {(["Stack", "Cloud", "Type"] as const).map((category) => (
            <div key={category}>
              <h3>{category}</h3>
              <div className="tags">
                {p.tags
                  .filter((t) => t.category === category)
                  .map((t) => (
                    <Link
                      key={t.id}
                      to={`/?${category.toLowerCase()}=${encodeURIComponent(t.key)}`}
                    >
                      {t.name}
                    </Link>
                  ))}
                {!p.tags.some((t) => t.category === category) && (
                  <small>Not specified</small>
                )}
              </div>
            </div>
          ))}
        </aside>
      </div>
      {p.media.length > 0 && (
        <section className="preview-section">
          <span className="eyebrow">A closer look</span>
          <h2>Images & video</h2>
          <div className="media-grid">
            {p.media.map((m) => (
              <figure key={m.id}>
                {m.kind === "Video" ? (
                  <video
                    src={m.url}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={m.caption || m.originalName}
                  />
                ) : (
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={m.url}
                      alt={m.caption || m.originalName}
                      loading="lazy"
                    />
                  </a>
                )}
                {m.caption && <figcaption>{m.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
      {p.embedDemo && p.demoUrl && (
        <section className="embed-section">
          <span className="eyebrow">Try it yourself</span>
          <h2>A working demo</h2>
          <p>
            This loads the project’s external website. If embedding is
            unavailable, use “Open demo”.
          </p>
          {embed ? (
            <>
              <Button className="secondary" onClick={() => setEmbed(false)}>
                <X size={16} /> Close demo
              </Button>
              <iframe
                src={p.demoUrl}
                title={`${p.title} interactive demo`}
                loading="lazy"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                referrerPolicy="no-referrer"
              />
            </>
          ) : (
            <Button onClick={() => setEmbed(true)}>
              <Play size={16} /> Load interactive demo
            </Button>
          )}
        </section>
      )}
      <footer className="detail-footer">
        <Code2 size={18} /> A project by João Cyrino
      </footer>
    </main>
  );
}
