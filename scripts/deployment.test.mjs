import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("SSH transport uploads an explicit allowlist, not server secrets", () => {
  const driver = read("scripts/deploy-production.sh");
  assert.match(
    driver,
    /tar -czf.*docker-compose.prod.yml scripts\/validate-server-env.py/,
  );
  assert.doesNotMatch(driver, /PRODUCTION_ENV|scp[^\n]*\.env|cat[^\n]*\.env/);
  assert.match(driver, /StrictHostKeyChecking=yes/);
});
test("backups precede migration and app replacement", () => {
  const remote = read("scripts/deploy-remote.sh");
  assert.ok(
    remote.indexOf("pg_dump") < remote.indexOf("run --rm --no-deps migrate"),
  );
  assert.ok(
    remote.indexOf("run --rm --no-deps migrate") <
      remote.indexOf("replaced=true"),
  );
  assert.match(remote, /Restored the previous app image/);
  assert.doesNotMatch(remote, /docker (?:system|volume) prune/);
});
test("production exposes only app through shared proxy", () => {
  const compose = read("docker-compose.prod.yml");
  assert.doesNotMatch(compose, /ports:/);
  assert.match(compose, /internal: true/);
  assert.match(compose, /caddy_ingress_network: proxy/);
  assert.match(compose, /media_data:\/var\/lib\/projects\/media/);
});
test("main pushes deploy to production", () => {
  const flow = read(".github/workflows/deploy.yml");
  assert.match(flow, /push:\s*\n\s*branches: \[main\]/);
  assert.doesNotMatch(flow, /pull_request:|PRODUCTION_ENV/);
  assert.match(flow, /projects.joaocyrino.com/);
});
test("runtime secrets and local media excluded from public source/image", () => {
  for (const file of [".gitignore", ".dockerignore"]) {
    const rules = read(file);
    assert.match(rules, /\.env/);
    assert.match(rules, /\.data/);
    assert.match(rules, /\*\.key/);
  }
});
