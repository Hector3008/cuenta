import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouter } from "../src/index.js";

function distFalso() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cuenta-"));
  fs.mkdirSync(path.join(dir, "assets"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>x</title>");
  fs.writeFileSync(path.join(dir, "assets", "a-123.js"), "console.log(1)");
  return dir;
}

async function conServidor(router, fn) {
  const app = express();
  app.use("/cuenta", router);
  const servidor = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${servidor.address().port}`);
  } finally {
    servidor.close();
  }
}

test("falla con un mensaje claro si no existe el build", () => {
  assert.throws(() => createRouter({ dist: "/no/existe" }), /npm run build/);
});

test("sirve index.html sin caché y los assets con caché larga", async () => {
  const router = createRouter({ dist: distFalso() });
  await conServidor(router, async (url) => {
    const html = await fetch(`${url}/cuenta/`);
    assert.equal(html.status, 200);
    assert.equal(html.headers.get("cache-control"), "no-cache");
    const js = await fetch(`${url}/cuenta/assets/a-123.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get("cache-control"), /immutable/);
  });
});

test("/cuenta sin barra final redirige a /cuenta/ (el cliente calcula la API desde ahí)", async () => {
  await conServidor(createRouter({ dist: distFalso() }), async (url) => {
    const r = await fetch(`${url}/cuenta`, { redirect: "manual" });
    assert.equal(r.status, 301);
    assert.match(r.headers.get("location"), /\/cuenta\/$/);
  });
});
