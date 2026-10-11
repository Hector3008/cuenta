import test from "node:test";
import assert from "node:assert/strict";
import { DESTINOS, permite } from "../client/src/destinos.js";
import { capacidades, seccionesVisibles, empresaActiva } from "../client/src/admin/permisos.js";
import { parsearPrecio, formatoPrecio } from "../client/src/admin/formato.js";

// api.js calcula la ruta base con document.baseURI al importarse: se simula antes de cargar http.js.
globalThis.document ??= { baseURI: "http://localhost/cuenta/" };
const { conConsulta, comoLista, mensajeAdmin } = await import("../client/src/admin/http.js");
const { ErrorApi } = await import("../client/src/api.js");

const ids = (permisos) => seccionesVisibles(permisos).map((s) => s.id);

test("permisos del admin usan la misma `permite` que el registro de destinos", () => {
  assert.equal(permite(["catalogo:*"], "catalogo:crear"), true);
  assert.equal(permite(["catalogo:leer"], "catalogo:crear"), false);
});

test("admin (*) ve las tres pestañas y puede todo", () => {
  const c = capacidades(["*"]);
  assert.ok(c.equipo.crear && c.equipo.editar && c.equipo.baja);
  assert.ok(c.catalogo.crear && c.catalogo.editar && c.catalogo.baja);
  assert.ok(c.roles.ver && c.roles.gestionar);
  assert.deepEqual(ids(["*"]), ["equipo", "catalogo", "empresa"]);
});

test("mesero (catalogo:leer): ve Catálogo y Empresa, sin botones de escritura ni roles", () => {
  const permisos = ["catalogo:leer", "documento:crear", "cliente:crear"];
  const c = capacidades(permisos);
  assert.deepEqual(ids(permisos), ["catalogo", "empresa"]);
  assert.ok(c.catalogo.ver);
  assert.ok(!c.catalogo.crear && !c.catalogo.editar && !c.catalogo.baja);
  assert.ok(!c.equipo.ver && !c.roles.ver);
});

test("encargado de carta: crea y edita ítems pero no da de baja", () => {
  const c = capacidades(["catalogo:leer", "catalogo:crear", "catalogo:editar"]);
  assert.ok(c.catalogo.crear && c.catalogo.editar && !c.catalogo.baja);
});

test("gestor de equipo sin rol:gestionar ve los roles pero no los edita", () => {
  const c = capacidades(["usuario:gestionar"]);
  assert.ok(c.equipo.ver && c.roles.ver && !c.roles.gestionar);
});

test("sin permisos o con una respuesta rara: solo Empresa (fallo seguro)", () => {
  assert.deepEqual(ids([]), ["empresa"]);
  assert.deepEqual(ids(undefined), ["empresa"]);
  assert.deepEqual(ids(null), ["empresa"]);
});

test("cada destino que abre una pantalla de admin existe y respeta los permisos de su pestaña", () => {
  const abre = DESTINOS.filter((d) => d.disponible && d.abre?.pantalla?.startsWith("admin:"));
  assert.deepEqual(abre.map((d) => d.abre.pantalla).sort(), ["admin:catalogo", "admin:empresa", "admin:equipo"]);
  const equipo = abre.find((d) => d.abre.pantalla === "admin:equipo");
  assert.equal(equipo.requiere, "usuario:gestionar");
  const catalogo = abre.find((d) => d.abre.pantalla === "admin:catalogo");
  assert.equal(catalogo.requiere, "catalogo:leer");
});

test("empresaActiva sale de yo.empresas, como las demás pantallas", () => {
  const yo = { empresaActivaId: "e2", empresas: [{ id: "e1", nombre: "A" }, { id: "e2", nombre: "B", rol: "admin" }] };
  assert.equal(empresaActiva(yo).nombre, "B");
  assert.equal(empresaActiva({ empresas: [] }), null);
  assert.equal(empresaActiva(null), null);
});

test("parsearPrecio: 2 decimales máximo, vacío = sin precio", () => {
  assert.deepEqual(parsearPrecio(""), { ok: true, valor: null });
  assert.deepEqual(parsearPrecio("12,5"), { ok: true, valor: 12.5 });
  assert.deepEqual(parsearPrecio("0"), { ok: true, valor: 0 });
  for (const malo of ["1.234", "-3", "abc", "1e3"]) assert.equal(parsearPrecio(malo).ok, false, malo);
});

test("formatoPrecio: sin moneda conocida no inventa símbolo; null es «—»", () => {
  assert.equal(formatoPrecio(null, "PEN"), "—");
  assert.equal(formatoPrecio(12.5, null), "12.50");
  assert.match(formatoPrecio(12.5, "PEN"), /12[.,]50/);
  assert.equal(formatoPrecio(3, "XXXX-no-es-moneda"), "3.00 XXXX-no-es-moneda");
});

test("conConsulta y comoLista", () => {
  assert.equal(conConsulta("/catalogo/", { q: "zm", categoria: "", inactivos: 1, x: undefined }), "catalogo/?q=zm&inactivos=1");
  assert.equal(conConsulta("empleados/"), "empleados/");
  assert.deepEqual(comoLista([1]), [1]);
  assert.deepEqual(comoLista({ ok: true, items: [2] }), [2]);
  assert.deepEqual(comoLista(null), []);
});

test("mensajeAdmin: un 401 es sesión caducada (no «contraseña incorrecta») y el resto usa el mensaje del núcleo", () => {
  assert.match(mensajeAdmin(new ErrorApi(401, null, "x")), /sesión caducó/);
  assert.equal(mensajeAdmin(new ErrorApi(409, "ROL_EN_USO", "El rol tiene empleados asignados.")), "El rol tiene empleados asignados.");
  assert.equal(mensajeAdmin(new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor.")), "No se pudo conectar con el servidor.");
  assert.match(mensajeAdmin(new ErrorApi(500, null, "boom")), /problema/);
  assert.match(mensajeAdmin(new Error("otra cosa")), /inesperado/);
});
