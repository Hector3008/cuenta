// El login enlaza a /recuperar del gateway (5.67). Es una ruta relativa: funciona igual con o sin BASE_PATH.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Login.jsx tiene el enlace «¿Olvidaste tu contraseña?» hacia ../recuperar", () => {
  const src = readFileSync(new URL("../client/src/pantallas/Login.jsx", import.meta.url), "utf8");
  assert.match(src, /<a href="\.\.\/recuperar">¿Olvidaste tu contraseña\?<\/a>/);
});
