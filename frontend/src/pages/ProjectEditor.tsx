import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Save,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { api, json } from "../lib/api";
import type { Media, Project, ProjectInput } from "../types";
import { Button, ErrorBox, Loading, StatusBadge } from "../components/UI";
import "./ProjectEditor.css";
const blank: ProjectInput = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  demoUrl: "",
  githubUrl: "",
  websiteUrl: "",
  embedDemo: false,
  featured: false,
  sortOrder: 0,
  status: "Draft",
  version: 0,
  stacks: [],
  clouds: [],
  types: [],
};
const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
function TagsInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value.join(",")]);
  return (
    <label>
      {label}
      <input
        value={text}
        placeholder={placeholder}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        onBlur={() =>
          onChange([
            ...new Set(
              text
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            ),
          ])
        }
      />
      <small>Separate tags with commas.</small>
    </label>
  );
}
function MediaRow({
  media,
  projectId,
  onChange,
}: {
  media: Media;
  projectId: string;
  onChange: () => void;
}) {
  const [caption, setCaption] = useState(media.caption);
  const [order, setOrder] = useState(media.sortOrder);
  const update = useMutation({
    mutationFn: (cover: boolean) =>
      api(
        `/admin/projects/${projectId}/media/${media.id}`,
        json("PUT", { caption, sortOrder: order, isCover: cover }),
      ),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: () =>
      api(`/admin/projects/${projectId}/media/${media.id}`, json("DELETE")),
    onSuccess: onChange,
  });
  return (
    <div className="media-editor-row">
      <div className="media-mini">
        {media.kind === "Image" ? (
          <img src={media.url} alt={media.caption || media.originalName} />
        ) : (
          <video src={media.url} controls playsInline preload="metadata" />
        )}
      </div>
      <div className="media-fields">
        <label>
          Caption
          <input
            maxLength={300}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
        <label>
          Display order
          <input
            type="number"
            min={0}
            max={100000}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </label>
        <small>
          {media.originalName} · {(media.size / 1048576).toFixed(1)} MiB
        </small>
        <div className="media-actions">
          <Button
            className="secondary small"
            onClick={() => update.mutate(media.isCover)}
            disabled={update.isPending}
          >
            Save caption/order
          </Button>
          <Button
            className={`secondary small ${media.isCover ? "cover-active" : ""}`}
            onClick={() => update.mutate(true)}
            disabled={update.isPending}
          >
            <Star size={13} />
            {media.isCover ? "Cover" : "Set as cover"}
          </Button>
          <Button
            className="danger small"
            aria-label={`Delete ${media.originalName}`}
            disabled={remove.isPending}
            onClick={() => {
              if (confirm("Delete this preview permanently?")) remove.mutate();
            }}
          >
            <Trash2 size={13} />
          </Button>
        </div>
        {(update.error || remove.error) && (
          <ErrorBox error={update.error || remove.error} />
        )}
      </div>
    </div>
  );
}
export default function ProjectEditor() {
  const typesQuery = useQuery({
    queryKey: ["project-types"],
    queryFn: () => api<string[]>("/project-types"),
  });
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<ProjectInput>({ ...blank });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const query = useQuery({
    queryKey: ["admin-project", id],
    queryFn: () => api<Project>("/admin/projects/" + id),
    enabled: !!id,
  });
  useEffect(() => {
    const p = query.data;
    if (p && !dirty)
      setForm({
        title: p.title,
        slug: p.slug,
        summary: p.summary,
        description: p.description,
        demoUrl: p.demoUrl || "",
        githubUrl: p.githubUrl || "",
        websiteUrl: p.websiteUrl || "",
        embedDemo: p.embedDemo,
        featured: p.featured,
        sortOrder: p.sortOrder,
        status: p.status,
        version: p.version,
        stacks: p.tags.filter((t) => t.category === "Stack").map((t) => t.name),
        clouds: p.tags.filter((t) => t.category === "Cloud").map((t) => t.name),
        types: p.tags.filter((t) => t.category === "Type").map((t) => t.name),
      });
  }, [query.data, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function field<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["admin-project", id] });
    client.invalidateQueries({ queryKey: ["admin-projects"] });
    client.invalidateQueries({ queryKey: ["projects"] });
    client.invalidateQueries({ queryKey: ["facets"] });
    client.invalidateQueries({ queryKey: ["project"] });
  };
  const save = useMutation({
    mutationFn: () =>
      api<Project>(
        "/admin/projects" + (id ? "/" + id : ""),
        json(id ? "PUT" : "POST", form),
      ),
    onSuccess: (p) => {
      setDirty(false);
      setSaved(true);
      client.setQueryData(["admin-project", p.id], p);
      invalidate();
      if (!id) navigate("/admin/projects/" + p.id, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      api("/admin/projects/" + id + "?version=" + form.version, json("DELETE")),
    onSuccess: () => {
      invalidate();
      navigate("/admin");
    },
  });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      setUploadError("");
      for (const file of files) {
        const image = file.type.startsWith("image/");
        const allowed = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/webm",
        ];
        if (
          !allowed.includes(file.type) ||
          file.size > (image ? 20971520 : 104857600)
        )
          throw new Error(
            "Use JPEG, PNG, WebP (20 MiB max), MP4 or WebM (100 MiB max).",
          );
        const data = new FormData();
        data.append("file", file);
        await api("/admin/projects/" + id + "/media", {
          method: "POST",
          body: data,
        });
      }
    },
    onSuccess: invalidate,
    onError: (e) => {
      setUploadError(e.message);
      invalidate();
    },
  });
  if (id && query.isLoading) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} />;
  const busy = save.isPending || upload.isPending || remove.isPending;
  return (
    <>
      <Link
        to="/admin"
        className="back-link"
        onClick={(e) => {
          if (dirty && !confirm("Leave without saving your project changes?"))
            e.preventDefault();
        }}
      >
        <ArrowLeft size={16} /> All projects
      </Link>
      <div className="admin-page-heading editor-heading">
        <div>
          <span className="eyebrow">Make something worth sharing</span>
          <h1>{id ? "Edit project" : "A new project"}</h1>
        </div>
        <StatusBadge status={form.status} />
      </div>
      <form
        className="editor-layout"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="editor-primary">
          <section className="editor-card">
            <h2>The essentials</h2>
            <p>Give your project a name and a reason to explore it.</p>
            <label>
              Project title
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  const oldSlug = slugify(form.title);
                  field("title", title);
                  if (!id && (form.slug === "" || form.slug === oldSlug))
                    field("slug", slugify(title));
                }}
                placeholder="A name for your next idea"
              />
            </label>
            <label>
              URL slug
              <input
                required
                maxLength={100}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={form.slug}
                onChange={(e) => field("slug", e.target.value)}
                placeholder="your-project"
              />
              <small>Public URL: /p/{form.slug || "your-project"}</small>
            </label>
            <label>
              Short description
              <textarea
                aria-label="Short description"
                required
                rows={3}
                maxLength={300}
                value={form.summary}
                onChange={(e) => field("summary", e.target.value)}
                placeholder="What does it do, and why does it exist?"
              />
              <small>{form.summary.length}/300 characters</small>
            </label>
            <label>
              Full description
              <textarea
                aria-label="Full description"
                rows={8}
                maxLength={10000}
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="The story, key features, and what you learned."
              />
              <small>Plain text. Paragraph breaks are preserved.</small>
            </label>
          </section>
          <section className="editor-card">
            <h2>Links & demos</h2>
            <p>Add any combination of links. All are optional.</p>
            <label>
              Live demo
              <input
                type="url"
                value={form.demoUrl}
                onChange={(e) => field("demoUrl", e.target.value)}
                placeholder="https://your-demo.com"
              />
            </label>
            <label>
              GitHub repository
              <input
                type="url"
                value={form.githubUrl}
                onChange={(e) => field("githubUrl", e.target.value)}
                placeholder="https://github.com/you/project"
              />
            </label>
            <label>
              Project website
              <input
                type="url"
                value={form.websiteUrl}
                onChange={(e) => field("websiteUrl", e.target.value)}
                placeholder="https://your-project.com"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.embedDemo}
                onChange={(e) => field("embedDemo", e.target.checked)}
                disabled={!form.demoUrl}
              />{" "}
              Offer an interactive embedded demo
            </label>
            <small>
              The demo site must allow iframe embedding. Visitors choose when to
              load it.
            </small>
          </section>
        </div>
        <aside className="editor-sidebar">
          <section className="editor-card">
            <h2>Publishing</h2>
            <label>
              Visibility
              <select
                value={form.status}
                onChange={(e) =>
                  field("status", e.target.value as ProjectInput["status"])
                }
              >
                <option value="Draft">Draft — only you</option>
                <option value="Published">
                  Published — visible to everyone
                </option>
                <option value="Archived">Archived — hidden</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => field("featured", e.target.checked)}
              />{" "}
              Feature this project
            </label>
            <label>
              Display order
              <input
                type="number"
                min={0}
                max={100000}
                value={form.sortOrder}
                onChange={(e) => field("sortOrder", Number(e.target.value))}
              />
              <small>
                Lower numbers appear first within each featured group.
              </small>
            </label>
            {(save.error || remove.error) && (
              <>
                <ErrorBox error={save.error || remove.error} />
                <Button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (confirm("Reload and discard unsaved changes?")) {
                      setDirty(false);
                      query.refetch();
                      save.reset();
                    }
                  }}
                >
                  Reload project
                </Button>
              </>
            )}{" "}
            {saved && (
              <p className="success" role="status">
                Project saved.
              </p>
            )}
            <Button type="submit" disabled={busy}>
              <Save size={16} />
              {save.isPending ? "Saving…" : "Save project"}
            </Button>
            {id && form.status === "Published" && (
              <Link
                to={"/p/" + form.slug}
                className="button secondary"
                target="_blank"
              >
                <ExternalLink size={16} /> View public project
              </Link>
            )}
            {id && (
              <Button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Permanently delete this project and all its previews?",
                    )
                  )
                    remove.mutate();
                }}
              >
                <Trash2 size={16} /> Delete project
              </Button>
            )}
          </section>
          <section className="editor-card">
            <h2>Find its people</h2>
            <TagsInput
              label="Stack"
              value={form.stacks}
              onChange={(v) => field("stacks", v)}
              placeholder="React, .NET, PostgreSQL"
            />
            <TagsInput
              label="Cloud"
              value={form.clouds}
              onChange={(v) => field("clouds", v)}
              placeholder="AWS, DigitalOcean"
            />
            <span className="field-label">Project type</span>
            {typesQuery.error && <ErrorBox error={typesQuery.error} />}
            <div className="type-choices">
              {(typesQuery.data || []).map((t) => (
                <label className="check" key={t}>
                  <input
                    type="checkbox"
                    checked={form.types.includes(t)}
                    onChange={(e) =>
                      field(
                        "types",
                        e.target.checked
                          ? [...form.types, t]
                          : form.types.filter((v) => v !== t),
                      )
                    }
                  />
                  {t}
                </label>
              ))}
            </div>
          </section>
        </aside>
      </form>
      <section className="editor-card media-editor">
        <div className="media-section-heading">
          <div>
            <h2>Show, don’t just tell.</h2>
            <p>
              Screenshots, short walkthroughs, and a glimpse of the experience.
            </p>
          </div>
          <ImagePlus size={27} />
        </div>
        {id ? (
          <>
            <label
              className={`upload-area ${upload.isPending ? "upload-busy" : ""}`}
            >
              <Upload size={24} />
              <strong>
                {upload.isPending
                  ? "Uploading previews…"
                  : "Choose images or videos"}
              </strong>
              <span>JPEG, PNG, WebP: 20 MiB · MP4, WebM: 100 MiB</span>
              <small>
                {dirty
                  ? "Save project changes before uploading."
                  : "Up to 20 previews per project. Originals are kept without recompression."}
              </small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                multiple
                disabled={busy || dirty}
                onChange={(e) => {
                  if (e.target.files?.length)
                    upload.mutate(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />
            </label>
            {uploadError && <ErrorBox error={uploadError} />}
            <div>
              {query.data?.media.map((m) => (
                <MediaRow
                  key={m.id}
                  media={m}
                  projectId={id}
                  onChange={invalidate}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="upload-placeholder">
            Save your project first, then add its previews.
          </div>
        )}
      </section>
    </>
  );
}
