import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/island/works/idea-pilot/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the idea clarifier", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MVP Clarifier · 想法明确工具<\/title>/i);
  assert.match(html, /MVP CLARIFIER/);
  assert.match(html, /项目初诊/);
  assert.match(html, /当前诊断/);
  assert.match(html, /先写下你的项目念头，一句话也可以/);
  assert.match(html, /这一题只收念头，不急着判断 MVP 或伪需求/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("external evidence example is not self-disqualifying", async () => {
  const source = await import("node:fs/promises")
    .then((fs) => fs.readFile(new URL("../app/page.tsx", import.meta.url), "utf8"));
  const externalEvidenceBlock = source.match(/id: "externalEvidence"[\s\S]*?placeholder: "([^"]+)"/)?.[1] ?? "";

  assert.match(externalEvidenceBlock, /访谈|用户|试用|反馈/);
  assert.doesNotMatch(externalEvidenceBlock, /暂无|没有|尚无|还没|未访谈|未验证/);
});

test("ships the MVP clarifier visual workflow", async () => {
  const source = await import("node:fs/promises")
    .then((fs) => fs.readFile(new URL("../app/page.tsx", import.meta.url), "utf8"));
  const css = await import("node:fs/promises")
    .then((fs) => fs.readFile(new URL("../app/globals.css", import.meta.url), "utf8"));

  assert.match(source, /MVP CLARIFIER/);
  assert.match(source, /把模糊想法，变成可执行的/);
  assert.match(source, /产品价值/);
  assert.match(source, /className="topbar"/);
  assert.match(css, /\.workspace-grid\{display:grid;grid-template-columns:250px minmax\(0,1fr\) 350px/);
  assert.match(css, /\.stage-item\.current\{[^}]*linear-gradient/);
  assert.match(css, /\.insight-callout\{/);
  assert.match(css, /@media \(max-width:760px\)/);
});
