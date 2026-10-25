import test from "node:test";
import assert from "node:assert/strict";
import {
  formularioDeAnuncio, parsearAnuncio, normalizarAnuncio, textoEvento, textoCuandoAnuncio, estadoAnuncio, hoyDeNavegador, SERVICIO_ANUNCIOS,
} from "../client/src/admin/anuncios-logica.js";
import { capacidades, seccionesVisibles } from "../client/src/admin/permisos.js";
import { DESTINOS, destinosAccesibles } from "../client/src/destinos.js";

const evento = (o = {}) => ({ ...formularioDeAnuncio(null), titulo: "Jazz en vivo", fecha: "2026-11-07", hora: "21:00", ...o });
const aviso = (o = {}) => ({ ...formularioDeAnuncio(null), tipo: "publicidad", titulo: "Happy hour doble", ...o });
const ok = (f) => {
  const r = parsearAnuncio(f);
  assert.equal(r.ok, true, r.error);
  return r.cuerpo;
};
const mal = (f, texto) => {
  const r = parsearAnuncio(f);
  assert.equal(r.ok, false);
  if (texto) assert.match(r.error, texto);
};

test("el formulario vacío es un evento activo", () => {
  const f = formularioDeAnuncio(null);
  assert.deepEqual([f.tipo, f.activo, f.titulo, f.imagen], ["evento", true, "", ""]);
});

test("un evento: el cuerpo lleva fecha, hora y lugar, y nada de vigencia", () => {
  assert.deepEqual(ok(evento({ lugar: "  Terraza " })), {
    tipo: "evento", titulo: "Jazz en vivo", descripcion: null, imagen: null, activo: true, fecha: "2026-11-07", hora: "21:00", lugar: "Terraza",
  });
  assert.equal("vigencia" in ok(evento()), false);
  assert.equal(ok(evento()).lugar, null);
});

test("una publicidad: vigencia opcional, y nada de fecha/hora/lugar", () => {
  const sin = ok(aviso());
  assert.equal(sin.vigencia, null);
  for (const k of ["fecha", "hora", "lugar"]) assert.equal(k in sin, false);
  assert.deepEqual(ok(aviso({ hasta: "2026-12-01" })).vigencia, { desde: null, hasta: "2026-12-01" });
});

test("avisa pronto y con palabras claras", () => {
  mal(evento({ titulo: "  " }), /título/);
  mal(evento({ titulo: "x".repeat(81) }), /80/);
  mal(evento({ descripcion: "x".repeat(301) }), /300/);
  mal(evento({ fecha: "" }), /día del evento/);
  mal(evento({ fecha: "2026-02-30" }), /válida/);
  mal(evento({ hora: "" }), /hora/);
  mal(evento({ hora: "9pm" }), /21:00/);
  mal(evento({ lugar: "x".repeat(81) }), /lugar/);
  mal(aviso({ desde: "2026-12-02", hasta: "2026-12-01" }), /antes/);
  mal(aviso({ desde: "2026-13-01" }), /válida/);
  mal({ ...evento(), tipo: "otro" }, /evento o una publicidad/);
});

test("la foto: solo https; vacía es null", () => {
  assert.equal(ok(evento({ imagen: " https://img.example.com/a.jpg " })).imagen, "https://img.example.com/a.jpg");
  assert.equal(ok(evento({ imagen: "" })).imagen, null);
  for (const u of ["http://x.com/a.png", "javascript:alert(1)", "https://u:p@x.com/a.png", "https://x.com/a b.png"]) mal(evento({ imagen: u }), /foto/);
});

test("editar: el formulario de un anuncio guardado vuelve al mismo cuerpo", () => {
  const guardado = normalizarAnuncio({ id: "1", tipo: "publicidad", titulo: "A", descripcion: "d", imagen: "https://x.com/a.png", vigencia: { desde: "2026-11-01", hasta: null }, activo: false });
  const f = formularioDeAnuncio(guardado);
  assert.deepEqual([f.desde, f.hasta, f.activo, f.descripcion], ["2026-11-01", "", false, "d"]);
  assert.deepEqual(ok(f), { tipo: "publicidad", titulo: "A", descripcion: "d", imagen: "https://x.com/a.png", activo: false, vigencia: { desde: "2026-11-01", hasta: null } });
});

test("textos: evento con lugar, publicidad con vigencia o «Siempre»", () => {
  assert.equal(textoEvento({ fecha: "2026-11-07", hora: "21:00", lugar: "Terraza" }), "7 nov 2026 · 21:00 · Terraza");
  assert.equal(textoCuandoAnuncio({ tipo: "evento", fecha: "2026-11-07", hora: "21:00", lugar: null }), "7 nov 2026 · 21:00");
  assert.equal(textoCuandoAnuncio({ tipo: "publicidad", vigencia: null }), "Siempre");
  assert.equal(textoCuandoAnuncio({ tipo: "publicidad", vigencia: { desde: "2026-11-01", hasta: "2026-11-30" } }), "Del 1 nov 2026 al 30 nov 2026");
  assert.equal(textoCuandoAnuncio({ tipo: "publicidad", vigencia: { desde: null, hasta: "2026-11-30" } }), "Hasta el 30 nov 2026");
});

test("estado: pausado, pasó, próximamente o en la carta (el día del evento todavía cuenta)", () => {
  const hoy = "2026-10-22";
  assert.equal(estadoAnuncio({ activo: false, tipo: "evento", fecha: "2026-12-01" }, hoy), "pausado");
  assert.equal(estadoAnuncio({ activo: true, tipo: "evento", fecha: "2026-10-22" }, hoy), "en la carta");
  assert.equal(estadoAnuncio({ activo: true, tipo: "evento", fecha: "2026-10-21" }, hoy), "pasó");
  assert.equal(estadoAnuncio({ activo: true, tipo: "publicidad", vigencia: { hasta: "2026-10-21" } }, hoy), "pasó");
  assert.equal(estadoAnuncio({ activo: true, tipo: "publicidad", vigencia: { hasta: "2026-10-22" } }, hoy), "en la carta");
  assert.equal(estadoAnuncio({ activo: true, tipo: "publicidad", vigencia: { desde: "2026-10-23" } }, hoy), "próximamente");
  assert.equal(estadoAnuncio({ activo: true, tipo: "publicidad", vigencia: null }, hoy), "en la carta");
  assert.equal(hoyDeNavegador(new Date(2026, 9, 2)), "2026-10-02");
});

test("permisos: la pestaña pide anuncio:leer y el servicio tobt; gestionar también necesita leer", () => {
  const ids = (p, s) => seccionesVisibles(p, s).map((x) => x.id);
  assert.ok(ids(["*"], ["tobt"]).includes("anuncios"));
  assert.ok(ids(["anuncio:leer"], ["tobt"]).includes("anuncios"));
  assert.ok(ids(["anuncio:*"], ["tobt"]).includes("anuncios"));
  assert.ok(!ids(["*"], ["siscore"]).includes("anuncios"), "sin tobt no hay pestaña");
  assert.ok(!ids(["anuncio:gestionar"], ["tobt"]).includes("anuncios"), "la lista pide anuncio:leer en el servidor");
  assert.ok(!ids(["promocion:leer", "catalogo:leer"], ["tobt"]).includes("anuncios"));
  assert.deepEqual([capacidades(["anuncio:leer"]).anuncios.gestionar, capacidades(["anuncio:gestionar"]).anuncios.gestionar], [false, false]);
  assert.equal(capacidades(["anuncio:leer", "anuncio:gestionar"]).anuncios.gestionar, true);
  assert.equal(SERVICIO_ANUNCIOS, "tobt");
});

test("destino: Anuncios abre admin:anuncios con su permiso y servicio", () => {
  const d = DESTINOS.find((x) => x.id === "empresa.anuncios");
  assert.deepEqual([d.requiere, d.servicio, d.abre], ["anuncio:leer", "tobt", { pantalla: "admin:anuncios" }]);
  const ve = (permisos, servicios) => destinosAccesibles({ permisos, servicios }).some((x) => x.id === "empresa.anuncios");
  assert.equal(ve(["anuncio:leer"], ["tobt"]), true);
  assert.equal(ve(["anuncio:leer"], ["siscore"]), false);
  assert.equal(ve(["catalogo:leer"], ["tobt"]), false);
});
