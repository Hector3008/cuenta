// Pantalla de Reseñas (5.62): permisos, destino y lógica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { capacidades, seccionesVisibles } from "../client/src/admin/permisos.js";
import { DESTINOS } from "../client/src/destinos.js";
import { explicacionDe } from "../client/src/admin/permisos-guia.js";
import {
  SERVICIO_RESENAS, FILTROS_RESENA, FILTRO_RESENA_INICIAL, normalizarResena, estadoResena, estrellasTexto, fechaResena, textoVacioResenas,
} from "../client/src/admin/resenas-logica.js";

const ids = (p, s) => seccionesVisibles(p, s).map((x) => x.id);

test("la pestaña pide resena:leer y el servicio tobt; moderar también necesita leer", () => {
  assert.equal(SERVICIO_RESENAS, "tobt");
  assert.ok(ids(["*"], ["tobt"]).includes("resenas"));
  assert.ok(ids(["resena:leer"], ["tobt"]).includes("resenas"));
  assert.ok(ids(["resena:*"], ["tobt"]).includes("resenas"));
  assert.ok(!ids(["*"], ["siscore"]).includes("resenas"), "sin tobt no hay pestaña");
  assert.ok(!ids(["resena:gestionar"], ["tobt"]).includes("resenas"), "la lista pide resena:leer en el servidor");
  assert.ok(!ids(["anuncio:leer", "catalogo:leer"], ["tobt"]).includes("resenas"));
  assert.equal(capacidades(["resena:leer"]).resenas.gestionar, false);
  assert.equal(capacidades(["resena:gestionar"]).resenas.gestionar, false);
  assert.equal(capacidades(["resena:leer", "resena:gestionar"]).resenas.gestionar, true);
  assert.equal(capacidades(["*"]).resenas.gestionar, true);
});

test("el destino de Inicio abre la pantalla y pide el mismo permiso y servicio", () => {
  const d = DESTINOS.find((x) => x.id === "empresa.resenas");
  assert.equal(d.requiere, "resena:leer");
  assert.equal(d.servicio, "tobt");
  assert.equal(d.disponible, true);
  assert.deepEqual(d.abre, { pantalla: "admin:resenas" });
});

test("los dos permisos están explicados en la guía y son de tobt", () => {
  for (const id of ["resena:leer", "resena:gestionar"]) {
    const e = explicacionDe(id);
    assert.ok(e?.titulo && e.descripcion, id);
    assert.equal(e.servicio, "tobt");
  }
});

test("filtros: reportadas primero y es el inicial", () => {
  assert.equal(FILTRO_RESENA_INICIAL, "reportadas");
  assert.deepEqual(FILTROS_RESENA.map((f) => f[0]), ["reportadas", "todas", "ocultas"]);
});

test("normalizarResena: valores seguros ante una respuesta rara", () => {
  assert.deepEqual(normalizarResena(null), { id: "", itemCodigo: "", itemNombre: "", autor: "Anónimo", estrellas: 0, texto: null, oculta: false, reportes: 0, ts: null });
  const r = normalizarResena({ id: "r1", itemCodigo: "MOKA", itemNombre: "Moka", autor: "María P.", estrellas: 4, texto: "rico", oculta: true, reportes: 2, ts: "2026-10-20T12:00:00Z" });
  assert.equal(r.oculta, true);
  assert.equal(r.reportes, 2);
  assert.equal(normalizarResena({ itemCodigo: "X" }).itemNombre, "X");
  assert.equal(normalizarResena({ estrellas: "5", reportes: -1, texto: "" }).estrellas, 0);
  assert.equal(normalizarResena({ reportes: -1, texto: "" }).reportes, 0);
});

test("textos: estado, estrellas, fecha y vacíos", () => {
  assert.equal(estadoResena({ oculta: true, reportes: 3 }), "Oculta");
  assert.equal(estadoResena({ oculta: false, reportes: 1 }), "Visible · 1 reporte");
  assert.equal(estadoResena({ oculta: false, reportes: 2 }), "Visible · 2 reportes");
  assert.equal(estadoResena({ oculta: false, reportes: 0 }), "Visible");
  assert.equal(estrellasTexto(4), "★★★★☆");
  assert.equal(estrellasTexto(9), "★★★★★");
  assert.equal(estrellasTexto(0), "☆☆☆☆☆");
  assert.equal(fechaResena("2026-10-20T12:00:00Z"), "20 oct 2026");
  assert.equal(fechaResena(null), "");
  for (const f of ["reportadas", "ocultas", "todas"]) assert.ok(textoVacioResenas(f).length > 10);
});
