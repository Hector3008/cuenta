import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  GUIA, ROLES_DE_EJEMPLO, permisosDeLaGuia, explicacionDe, ayudaDe, filtrarGuia, incluidoEn, agregarPermiso, quitarPermiso,
} from "../client/src/admin/permisos-guia.js";

const FORMATO = /^[a-z][a-z0-9_]*:[a-z0-9_]+$/;

test("cada permiso de la guía tiene formato válido, título y descripción, y no se repite", () => {
  const ids = permisosDeLaGuia().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of permisosDeLaGuia()) {
    assert.match(p.id, FORMATO);
    assert.ok(p.titulo.length > 2, p.id);
    assert.ok(p.descripcion.length > 20, p.id);
  }
});

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : /\.(jsx?|mjs)$/.test(n) ? [r] : [];
  });
}

test("todo permiso que este front menciona está explicado en la guía", () => {
  const usados = new Set();
  for (const f of archivos("client/src")) {
    if (f.endsWith("permisos-guia.js")) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/"([a-z_]+:[a-z_]+)"/g)) usados.add(m[1]);
  }
  const ignorados = (id) => id.startsWith("admin:"); // ids de pestañas, no permisos
  const faltan = [...usados].filter((id) => !ignorados(id) && FORMATO.test(id) && !explicacionDe(id));
  assert.deepEqual(faltan, []);
});

test("los roles de ejemplo solo usan permisos explicados", () => {
  for (const r of ROLES_DE_EJEMPLO) for (const p of r.permisos) assert.ok(explicacionDe(p), `${r.nombre}: ${p}`);
});

test("los reservados se marcan y los que dependen de tobt lo indican", () => {
  assert.equal(explicacionDe("estacion:carta").reservado, true);
  assert.equal(explicacionDe("estacion:cocina").reservado, undefined);
  assert.equal(explicacionDe("reporte:leer").servicio, "tobt");
  assert.equal(explicacionDe("catalogo:leer").servicio, undefined);
});

test("ayudaDe explica permisos, comodines y desconocidos", () => {
  assert.match(ayudaDe("catalogo:leer"), /^Ver el catálogo:/);
  assert.match(ayudaDe("*"), /total/i);
  assert.match(ayudaDe("documento:*"), /documento:leer.*documento:crear.*documento:editar/);
  assert.equal(ayudaDe("inventario:mover"), "");
  assert.equal(ayudaDe("inventario:*"), "");
});

test("filtrarGuia ignora tildes y mayúsculas, y busca en código, título y descripción", () => {
  assert.equal(filtrarGuia("").length, GUIA.length);
  const ids = (t) => filtrarGuia(t).flatMap((g) => g.permisos.map((p) => p.id));
  assert.ok(ids("CATALOGO").includes("catalogo:leer"));
  assert.ok(ids("cobrar").includes("estacion:administracion"));
  assert.ok(ids("catálogo").includes("catalogo:leer"));
  assert.deepEqual(ids("zzzz"), []);
  assert.ok(filtrarGuia("zzzz").every((g) => g.permisos.length) );
});

test("incluidoEn respeta comodines; agregar y quitar no duplican", () => {
  assert.equal(incluidoEn("*", "catalogo:leer"), true);
  assert.equal(incluidoEn("documento:*", "documento:editar"), true);
  assert.equal(incluidoEn("documento:*", "catalogo:leer"), false);
  assert.equal(incluidoEn("", "catalogo:leer"), false);
  assert.equal(agregarPermiso("", "catalogo:leer"), "catalogo:leer");
  assert.equal(agregarPermiso("catalogo:leer", "catalogo:leer"), "catalogo:leer");
  assert.equal(agregarPermiso("a:b  c:d", "e:f"), "a:b, c:d, e:f");
  assert.equal(quitarPermiso("a:b, c:d", "a:b"), "c:d");
  assert.equal(quitarPermiso("documento:*", "documento:leer"), "documento:*");
});
