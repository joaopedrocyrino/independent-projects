import { LoaderCircle, ArrowUpRight, Code2, Layers3 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Project, Status } from "../types";
import "./UI.css";
export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading…
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Layers3 size={32} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`button ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>{status}</span>
  );
}
export function Artwork({ project }: { project: Project }) {
  const media = project.media.find((m) => m.isCover) || project.media[0];
  if (media)
    return media.kind === "Video" ? (
      <video
        src={media.url}
        muted
        playsInline
        preload="metadata"
        aria-label={`${project.title} video preview`}
      />
    ) : (
      <img
        src={media.url}
        alt={media.caption || `${project.title} preview`}
        loading="lazy"
        decoding="async"
      />
    );
  return (
    <div className="artwork" data-tone={project.title.length % 3}>
      <div className="art-orbit" />
      <div className="art-symbol">
        <Code2 size={38} />
      </div>
      <span>{project.title}</span>
      <small>
        {project.tags
          .filter((t) => t.category === "Stack")
          .slice(0, 3)
          .map((t) => t.name)
          .join(" · ") || "Built with intention"}
      </small>
    </div>
  );
}
