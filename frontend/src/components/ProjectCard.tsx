import { Link } from "react-router-dom";
import { ArrowUpRight, Github, Play, Star } from "lucide-react";
import type { Project } from "../types";
import { Artwork } from "./UI";
import "./ProjectCard.css";
export default function ProjectCard({ project }: { project: Project }) {
  const stacks = project.tags.filter((t) => t.category === "Stack");
  const type = project.tags.find((t) => t.category === "Type");
  return (
    <article className="project-card">
      <Link
        to={`/p/${project.slug}`}
        className="project-image"
        aria-label={`Explore ${project.title}`}
      >
        <Artwork project={project} />
        {project.featured && (
          <span className="featured">
            <Star size={12} /> Featured
          </span>
        )}
        <span className="image-arrow">
          <ArrowUpRight size={19} />
        </span>
      </Link>
      <div className="project-copy">
        <span className="eyebrow">{type?.name || "Project"}</span>
        <Link to={`/p/${project.slug}`} className="project-title">
          <h2>{project.title}</h2>
        </Link>
        <p>{project.summary}</p>
        <div className="tags">
          {stacks.slice(0, 4).map((t) => (
            <span key={t.id}>{t.name}</span>
          ))}
          {stacks.length > 4 && <span>+{stacks.length - 4}</span>}
        </div>
        <div className="card-bottom">
          <Link to={`/p/${project.slug}`}>
            Explore project <ArrowUpRight size={15} />
          </Link>
          <div>
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${project.title} demo`}
              >
                <Play size={16} />
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.title} source code`}
              >
                <Github size={17} />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
