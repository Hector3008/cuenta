// Pantalla de Clientes (5.68): lógica pura (ficha ↔ API, textos) y permisos de cada botón.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FINALIDADES, MEDIOS, REDES, contactoDe, cuerpoDeFormulario, estadoCliente, fechaCliente, formularioDe, hayMas, nombreMostrado,
  normalizarCliente, textoConsentimiento, textoDuplicado, textoVacioClientes,
} from "../client/src/admin/clientes-logica.js";

globalThis.document = { baseURI: "http://localhost/cuenta/" };
const { capacidades, seccionesVisibles } = await import("../client/src/admin/permisos.js");

const CRUDO = {
  id: "c1", nombre: "Ana Quispe", telefono: "+51987654321", correo: "ana@x.com", redes: { instagram: "ana.q", tiktok: "" }, identificacion: { tipo: "DNI", numero: "12345678" },
  direccion: "Av. Sol 123", tieneCuenta: true, activo: true, anonimizado: false, creadoTs: "2026-10-27T15:00:00Z",
  consentimientos: { programaPuntos: { otorgado: true, ts: "2026-10-27T15:00:00Z", medio: "presencial" }, etiquetadoRedes: { otorgado: false, ts: null, medio: null } },
  historialConsentimientos: [{ finalidad: "programaPuntos", otorgado: true, ts: "2026-10-27T15:00:00Z", medio: "presencial" }],
};

test("las finalidades, redes y medios que ofrece la pantalla (los del núcleo, a mano)", () => {
  assert.deepEqual(FINALIDADES.map((f) => f[0]), ["programaPuntos", "etiquetadoRedes"]);
  assert.deepEqual(REDES.map((r) => r[0]), ["instagram", "tiktok", "facebook", "x"]);
  assert.deepEqual(MEDIOS.map((m) => m[0]).sort(), ["formulario", "mensaje", "presencial", "qr", "telefono"]);
});

test("normalizarCliente: valores seguros con datos faltantes o raros", () => {
  const c = normalizarCliente(CRUDO);
  assert.equal(c.nombre, "Ana Quispe");
  assert.deepEqual(c.redes, { instagram: "ana.q" }); // la red vacía no cuenta
  assert.equal(c.consentimientos.programaPuntos.otorgado, true);
  assert.equal(c.historial.length, 1);
  const vacio = normalizarCliente({});
  assert.equal(vacio.activo, true);
  assert.equal(vacio.historial, null); // la lista no trae historial
  assert.equal(vacio.consentimientos.etiquetadoRedes.otorgado, false);
  assert.deepEqual(normalizarCliente(null).redes, {});
  assert.equal(normalizarCliente({ redes: { malvada: "x" } }).redes.malvada, undefined);
});

test("formularioDe: todo como texto, vacío para una ficha nueva", () => {
  assert.deepEqual(formularioDe(null), { nombre: "", telefono: "", correo: "", instagram: "", tiktok: "", facebook: "", x: "", idTipo: "", idNumero: "", direccion: "" });
  const f = formularioDe(normalizarCliente(CRUDO));
  assert.equal(f.instagram, "ana.q");
  assert.equal(f.idTipo, "DNI");
});

test("cuerpoDeFormulario al crear: solo lo escrito, nombre obligatorio", () => {
  assert.match(cuerpoDeFormulario({ ...formularioDe(), nombre: "   " }).error, /nombre/);
  assert.deepEqual(cuerpoDeFormulario({ ...formularioDe(), nombre: "  Luis   Paz " }).cuerpo, { nombre: "Luis Paz" });
  const r = cuerpoDeFormulario({ ...formularioDe(), nombre: "Luis", telefono: " 987 654 321 ", instagram: "@Luis", idTipo: "DNI", idNumero: "1234" }).cuerpo;
  assert.deepEqual(r, { nombre: "Luis", telefono: "987 654 321", redes: { instagram: "@Luis" }, identificacion: { tipo: "DNI", numero: "1234" } });
  assert.match(cuerpoDeFormulario({ ...formularioDe(), nombre: "x".repeat(81) }).error, /80/);
});

test("cuerpoDeFormulario: documento a medias y correo evidentemente malo se avisan antes de enviar", () => {
  assert.match(cuerpoDeFormulario({ ...formularioDe(), nombre: "A", idTipo: "DNI" }).error, /número/);
  assert.match(cuerpoDeFormulario({ ...formularioDe(), nombre: "A", idNumero: "123" }).error, /tipo/);
  assert.match(cuerpoDeFormulario({ ...formularioDe(), nombre: "A", correo: "no-es-correo" }).error, /correo/);
});

test("cuerpoDeFormulario al editar: lo vaciado se envía como null, lo que sigue vacío no se toca", () => {
  const original = normalizarCliente(CRUDO);
  const f = { ...formularioDe(original), telefono: "", instagram: "", direccion: "", idTipo: "", idNumero: "" };
  const { cuerpo } = cuerpoDeFormulario(f, original);
  assert.equal(cuerpo.telefono, null);
  assert.deepEqual(cuerpo.redes, { instagram: null });
  assert.equal(cuerpo.direccion, null);
  assert.equal(cuerpo.identificacion, null);
  assert.equal(cuerpo.correo, "ana@x.com");
  assert.ok(!("facebook" in cuerpo.redes)); // nunca tuvo Facebook: no se envía
  // sin cambios: el mismo cuerpo que ya tenía, sin nulls
  const igual = cuerpoDeFormulario(formularioDe(original), original).cuerpo;
  assert.ok(!Object.values(igual).includes(null));
  // un cliente sin correo que sigue sin correo no envía el campo
  const sinCorreo = normalizarCliente({ ...CRUDO, correo: null });
  assert.ok(!("correo" in cuerpoDeFormulario(formularioDe(sinCorreo), sinCorreo).cuerpo));
});

test("textoDuplicado dice qué dato choca", () => {
  assert.match(textoDuplicado({ datos: { campo: "telefono" } }), /teléfono/);
  assert.match(textoDuplicado({ datos: { campo: "correo" } }), /correo/);
  assert.equal(textoDuplicado({ message: "ya existe", datos: {} }), "ya existe");
});

test("textos de lista y ficha", () => {
  const c = normalizarCliente(CRUDO);
  assert.equal(contactoDe(c), "+51987654321 · ana@x.com · @ana.q");
  assert.equal(estadoCliente(c), "Activo");
  assert.equal(estadoCliente({ ...c, activo: false }), "Dado de baja");
  assert.equal(estadoCliente({ ...c, anonimizado: true }), "Anonimizado");
  assert.equal(nombreMostrado({ ...c, anonimizado: true }), "Cliente anonimizado");
  assert.equal(nombreMostrado({ ...c, nombre: "" }), "Sin nombre");
  assert.equal(fechaCliente("2026-10-27T15:00:00Z"), "27 oct 2026");
  assert.equal(fechaCliente("2026-10-28T02:00:00Z"), "27 oct 2026"); // hora de Lima
  assert.equal(fechaCliente(null), "—");
  assert.equal(fechaCliente("basura"), "—");
  assert.equal(textoConsentimiento(c.consentimientos.programaPuntos), "Sí · 27 oct 2026 · En persona");
  assert.equal(textoConsentimiento(c.consentimientos.etiquetadoRedes), "No");
  assert.match(textoConsentimiento({ otorgado: false, ts: "2026-10-27T15:00:00Z" }), /retirado el 27 oct 2026/);
  assert.equal(hayMas(50), true);
  assert.equal(hayMas(49), false);
  assert.match(textoVacioClientes("zz", "activos"), /«zz»/);
  assert.match(textoVacioClientes("", "activos"), /activos/);
});

test("permisos: cada botón pide lo mismo que la ruta del núcleo y siempre también cliente:leer", () => {
  const cap = (p) => capacidades(p).clientes;
  assert.deepEqual(cap(["cliente:leer"]), { ver: true, crear: false, editar: false, gestionar: false });
  assert.deepEqual(cap(["cliente:leer", "cliente:crear"]), { ver: true, crear: true, editar: false, gestionar: false });
  assert.deepEqual(cap(["cliente:crear", "cliente:editar", "cliente:gestionar"]), { ver: false, crear: false, editar: false, gestionar: false }); // la lista pide cliente:leer en el servidor
  assert.deepEqual(cap(["cliente:*"]), { ver: true, crear: true, editar: true, gestionar: true });
  assert.deepEqual(cap(["*"]), { ver: true, crear: true, editar: true, gestionar: true });
  assert.deepEqual(cap([]), { ver: false, crear: false, editar: false, gestionar: false });
  assert.ok(seccionesVisibles(["cliente:leer"], ["siscore"]).some((s) => s.id === "clientes"), "no depende de un servicio: los clientes son de la empresa");
  assert.ok(!seccionesVisibles(["catalogo:leer"], []).some((s) => s.id === "clientes"));
});
