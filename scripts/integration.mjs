import { request } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const base = process.env.BASE_URL || "http://127.0.0.1:" + env.API_PORT;
const anon = await request.newContext({
  baseURL: base,
  ignoreHTTPSErrors: process.env.TEST_LOCAL_TLS === "true",
});
const admin = await request.newContext({
  baseURL: base,
  ignoreHTTPSErrors: process.env.TEST_LOCAL_TLS === "true",
});
const ids = [];
let csrf;
async function body(response, status = 200) {
  assert.equal(response.status(), status, await response.text());
  return status === 204 ? null : response.json();
}
async function write(method, path, data) {
  return admin[method](path, {
    ...(data ? { data } : {}),
    headers: { "X-CSRF-TOKEN": csrf },
  });
}
try {
  for (let i = 0; i < 45; i++) {
    const r = await anon.get("/api/health/ready").catch(() => null);
    if (r?.ok()) break;
    if (i === 44) throw new Error("App never became ready.");
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal((await anon.get("/api/admin/projects")).status(), 401);
  csrf = (await body(await admin.get("/api/auth/csrf"))).token;
  await body(
    await write("post", "/api/auth/login", {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
      trustDevice: true,
    }),
  );
  csrf = (await body(await admin.get("/api/auth/csrf"))).token;
  const seed = {
    title: "Integration project",
    slug: "integration-" + Date.now(),
    summary: "A real CRUD smoke test.",
    description: "Test project.",
    demoUrl: "https://example.com/demo",
    githubUrl: "https://github.com/example/repo",
    websiteUrl: null,
    embedDemo: true,
    featured: false,
    sortOrder: 0,
    status: "Draft",
    stacks: [".NET", "React"],
    clouds: ["DigitalOcean"],
    types: ["Full stack web"],
    version: 0,
  };
  let project = await body(
    await write("post", "/api/admin/projects", seed),
    201,
  );
  ids.push(project.id);
  assert.equal((await anon.get("/api/projects/" + project.slug)).status(), 404);
  assert.equal(
    (await admin.post("/api/admin/projects", { data: seed })).status(),
    400,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0s8AAAAASUVORK5CYII=",
    "base64",
  );
  const media = await body(
    await admin.post(`/api/admin/projects/${project.id}/media`, {
      headers: { "X-CSRF-TOKEN": csrf },
      multipart: {
        file: { name: "preview.png", mimeType: "image/png", buffer: png },
      },
    }),
    201,
  );
  assert.equal((await anon.get(media.url)).status(), 404);
  assert.deepEqual(await (await admin.get(media.url)).body(), png);
  const bad = await admin.post(`/api/admin/projects/${project.id}/media`, {
    headers: { "X-CSRF-TOKEN": csrf },
    multipart: {
      file: {
        name: "bad.png",
        mimeType: "image/png",
        buffer: Buffer.from("<html>unsafe content</html>"),
      },
    },
  });
  assert.equal(bad.status(), 400);
  project = await body(await admin.get(`/api/admin/projects/${project.id}`));
  project = await body(
    await write("put", `/api/admin/projects/${project.id}`, {
      ...seed,
      version: project.version,
      status: "Published",
    }),
  );
  await body(await anon.get("/api/projects/" + project.slug));
  assert.deepEqual(await (await anon.get(media.url)).body(), png);
  const range = await anon.get(media.url, { headers: { Range: "bytes=0-9" } });
  assert.equal(range.status(), 206);
  assert.equal((await range.body()).length, 10);
  const filtered = await body(
    await anon.get(
      "/api/projects?stack=.net&cloud=digitalocean&type=" +
        encodeURIComponent("full stack web"),
    ),
  );
  assert.ok(filtered.items.some((p) => p.id === project.id));
  const wrong = await body(
    await anon.get("/api/projects?stack=next.js&cloud=aws"),
  );
  assert.ok(!wrong.items.some((p) => p.id === project.id));
  assert.equal(
    (
      await write("put", `/api/admin/projects/${project.id}`, {
        ...seed,
        version: 1,
        status: "Published",
      })
    ).status(),
    409,
  );
  const updated = await body(
    await write("put", `/api/admin/projects/${project.id}`, {
      ...seed,
      version: project.version,
      status: "Published",
      stacks: [".NET", "Next.js"],
      summary: "Updated",
    }),
  );
  assert.equal(updated.tags.filter((t) => t.category === "Stack").length, 2);
  const duplicate = await write("post", "/api/admin/projects", {
    ...seed,
    title: "Duplicate",
  });
  assert.equal(duplicate.status(), 409);
  await body(
    await write("put", `/api/admin/projects/${project.id}/media/${media.id}`, {
      caption: "Caption updated",
      sortOrder: 1,
      isCover: true,
    }),
  );
  project = await body(await admin.get(`/api/admin/projects/${project.id}`));
  await body(
    await write("put", `/api/admin/projects/${project.id}`, {
      ...seed,
      version: project.version,
      status: "Archived",
    }),
  );
  assert.equal((await anon.get(media.url)).status(), 404);
  project = await body(await admin.get(`/api/admin/projects/${project.id}`));
  await body(
    await write(
      "delete",
      `/api/admin/projects/${project.id}?version=${project.version}`,
    ),
    204,
  );
  ids.pop();
  await body(await write("post", "/api/auth/logout"), 204);
  assert.equal((await admin.get("/api/auth/me")).status(), 401);
  console.log(
    "Integration passed: auth/CSRF, CRUD, draft media, original bytes, ranges, combined filters, optimistic concurrency, publishing, archive and deletion.",
  );
} finally {
  for (const id of ids) {
    try {
      const p = await body(await admin.get("/api/admin/projects/" + id));
      await write("delete", `/api/admin/projects/${id}?version=${p.version}`);
    } catch {}
  }
  await admin.dispose();
  await anon.dispose();
}
