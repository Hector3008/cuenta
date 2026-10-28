import test from "node:test";
import assert from "node:assert/strict";
import {
  formularioDePromocion, parsearPromocion, textoQueHace, textoCuando, fechaCorta,
  parsearItemsPrueba, lineaDePrueba, ahoraDeNavegador, DIAS_SEMANA, SERVICIO_PROMOCIONES,
} from "../client/src/admin/promociones-logica.js";
import { capacidades, seccionesVisibles } from "../client/src/admin/permisos.js";
import { DESTINOS, destinosAccesibles } from "../client/src/destinos.js";

const form = (o = {}) => ({ ...formularioDePromocion(null), nombre: "2x1 en lattes", objetivoValor: "LATTE", ...o });
const ok = (f) => {
  const r = parsearPromocion(f);
  assert.equal(r.ok, true, r.error);
  return r.cuerpo;
};
const mal = (f, texto) => {
  const r = parsearPromocion(f);
  assert.equal(r.ok, false);
  if (texto) assert.match(r.error, texto);
};

test("el formulario vacío es un 2x1 listo para rellenar", () => {
  const f = formularioDePromocion(null);
  assert.deepEqual([f.tipo, f.n, f.m, f.prioridad, f.activa, f.acumulable, f.objetivoTipo], ["nxm", "2", "1", "100", true, false, "item"]);
});

test("un 2x1: el cuerpo lleva solo lo del tipo, y vigencia, días y horario en null cuando están vacíos", () => {
  assert.deepEqual(ok(form()), {
    nombre: "2x1 en lattes", descripcion: null, tipo: "nxm", prioridad: 100, acumulable: false, activa: true,
    objetivo: { itemCodigo: "LATTE" }, n: 2, m: 1, vigencia: null, dias: null, horario: null,
  });
});

test("un combo lleva disparador, efecto y valor; un directo gratis lleva valor null", () => {
  const combo = ok(form({ tipo: "combo", disparadorValor: "SAND", objetivoTipo: "categoria", objetivoValor: "Cafés", efecto: "porcentaje", valor: "50" }));
  assert.deepEqual([combo.disparador, combo.objetivo, combo.efecto, combo.valor], [{ itemCodigo: "SAND" }, { categoria: "Cafés" }, "porcentaje", 50]);
  assert.equal("n" in combo, false);
  const gratis = ok(form({ tipo: "directo", efecto: "gratis", valor: "99" }));
  assert.deepEqual([gratis.efecto, gratis.valor], ["gratis", null]);
  assert.equal("disparador" in gratis, false);
});

test("acepta coma decimal, y valida el descuento como el núcleo", () => {
  assert.equal(ok(form({ tipo: "directo", efecto: "monto", valor: "2,5" })).valor, 2.5);
  for (const valor of ["", "0", "-1", "abc", "1,234"]) mal(form({ tipo: "directo", efecto: "monto", valor }), /valor del descuento/);
  mal(form({ tipo: "directo", efecto: "porcentaje", valor: "101" }), /100/);
});

test("2x1: lleva de 2 a 10 y paga menos que lleva", () => {
  mal(form({ n: "1" }), /2 a 10/);
  mal(form({ n: "11" }), /2 a 10/);
  mal(form({ n: "2", m: "2" }), /menor/);
  mal(form({ n: "2.5" }), /entero/);
  const c = ok(form({ n: "3", m: "2" }));
  assert.deepEqual([c.n, c.m], [3, 2]);
});

test("el producto o la categoría son obligatorios y el código tiene un formato", () => {
  mal(form({ objetivoValor: "  " }), /código del ítem/);
  mal(form({ objetivoTipo: "categoria", objetivoValor: "" }), /categoría/);
  mal(form({ objetivoValor: "con espacios" }), /código solo lleva/);
  mal(form({ tipo: "combo", disparadorValor: "", efecto: "gratis" }), /Si lleva/);
  assert.deepEqual(ok(form({ objetivoTipo: "categoria", objetivoValor: " Cafés " })).objetivo, { categoria: "Cafés" });
});

test("nombre, descripción y prioridad", () => {
  mal(form({ nombre: "  " }), /nombre/);
  mal(form({ nombre: "x".repeat(81) }), /80/);
  mal(form({ descripcion: "x".repeat(201) }), /200/);
  mal(form({ prioridad: "-1" }), /prioridad/);
  mal(form({ prioridad: "1.5" }), /prioridad/);
  assert.equal(ok(form({ prioridad: "10", descripcion: "  Solo en barra " })).descripcion, "Solo en barra");
});

test("cuándo rige: fechas en orden, días únicos y ordenados, horario completo y distinto", () => {
  const c = ok(form({ desde: "2026-11-01", hasta: "2026-11-15", dias: [5, 1, 5], horaDesde: "18:00", horaHasta: "21:00" }));
  assert.deepEqual([c.vigencia, c.dias, c.horario], [{ desde: "2026-11-01", hasta: "2026-11-15" }, [1, 5], { desde: "18:00", hasta: "21:00" }]);
  assert.deepEqual(ok(form({ desde: "2026-11-01" })).vigencia, { desde: "2026-11-01", hasta: null });
  mal(form({ desde: "2026-11-15", hasta: "2026-11-01" }), /antes/);
  mal(form({ horaDesde: "18:00" }), /dos horas/);
  mal(form({ horaDesde: "18:00", horaHasta: "18:00" }), /iguales/);
  assert.ok(ok(form({ horaDesde: "22:00", horaHasta: "02:00" })).horario);
});

test("editar: el formulario de una promoción guardada vuelve a dar el mismo cuerpo", () => {
  const guardada = {
    id: "1", nombre: "Combo", descripcion: "Con sándwich", activa: false, prioridad: 20, acumulable: true, tipo: "combo",
    objetivo: { itemCodigo: null, categoria: "Cafés" }, disparador: { itemCodigo: "SAND", categoria: null }, n: null, m: null,
    efecto: "porcentaje", valor: 12.5, vigencia: { desde: "2026-11-01", hasta: null }, dias: [4, 5], horario: { desde: "18:00", hasta: "21:00" },
  };
  const f = formularioDePromocion(guardada);
  assert.deepEqual([f.objetivoTipo, f.objetivoValor, f.disparadorTipo, f.disparadorValor, f.valor, f.activa, f.prioridad], ["categoria", "Cafés", "item", "SAND", "12.5", false, "20"]);
  assert.deepEqual(ok(f), {
    nombre: "Combo", descripcion: "Con sándwich", tipo: "combo", prioridad: 20, acumulable: true, activa: false,
    objetivo: { categoria: "Cafés" }, disparador: { itemCodigo: "SAND" }, efecto: "porcentaje", valor: 12.5,
    vigencia: { desde: "2026-11-01", hasta: null }, dias: [4, 5], horario: { desde: "18:00", hasta: "21:00" },
  });
});

test("textos: qué hace y cuándo rige", () => {
  const base = { n: null, m: null, efecto: null, valor: null, vigencia: null, dias: null, horario: null, disparador: null };
  assert.equal(textoQueHace({ ...base, tipo: "nxm", n: 2, m: 1, objetivo: { itemCodigo: "LATTE" } }), "Lleva 2, paga 1: «LATTE»");
  assert.equal(textoQueHace({ ...base, tipo: "nxm", n: 3, m: 2, objetivo: { categoria: "Cafés" } }), "Lleva 3, paga 2: la categoría «Cafés»");
  assert.equal(textoQueHace({ ...base, tipo: "combo", disparador: { itemCodigo: "SAND" }, objetivo: { itemCodigo: "CAFE" }, efecto: "porcentaje", valor: 50 }), "Si lleva «SAND», «CAFE» con 50 % de descuento");
  assert.equal(textoQueHace({ ...base, tipo: "directo", objetivo: { itemCodigo: "TORTA" }, efecto: "porcentaje", valor: 12.5 }), "12,5 % de descuento en «TORTA»");
  assert.equal(textoQueHace({ ...base, tipo: "directo", objetivo: { itemCodigo: "TORTA" }, efecto: "monto", valor: 3 }), "3,00 de descuento por unidad en «TORTA»");
  assert.equal(textoQueHace({ ...base, tipo: "directo", objetivo: { categoria: "Postres" }, efecto: "gratis" }), "Gratis en la categoría «Postres»");

  assert.equal(textoCuando(base), "Siempre");
  assert.equal(textoCuando({ ...base, dias: [5, 0, 1] }), "Lun, Vie, Dom", "de lunes a domingo, no por número");
  assert.equal(textoCuando({ ...base, dias: [0, 1, 2, 3, 4, 5, 6] }), "Todos los días");
  assert.equal(textoCuando({ ...base, horario: { desde: "18:00", hasta: "21:00" } }), "18:00 a 21:00");
  assert.equal(textoCuando({ ...base, dias: [4], horario: { desde: "18:00", hasta: "21:00" }, vigencia: { desde: "2026-11-01", hasta: "2026-11-15" } }), "Jue · 18:00 a 21:00 · del 1 nov 2026 al 15 nov 2026");
  assert.equal(textoCuando({ ...base, vigencia: { desde: "2026-11-01", hasta: null } }), "desde el 1 nov 2026");
  assert.equal(textoCuando({ ...base, vigencia: { desde: null, hasta: "2026-11-15" } }), "hasta el 15 nov 2026");
  assert.equal(fechaCorta("2026-01-05"), "5 ene 2026");
  assert.equal(DIAS_SEMANA.length, 7);
});

test("pedido de ejemplo: ignora filas vacías, numera las usadas y valida cada fila", () => {
  const f = (o) => ({ ...lineaDePrueba(), ...o });
  const r = parsearItemsPrueba([f({ codigo: "LATTE", categoria: "Cafés", cantidad: "2", precio: "10,5" }), f(), f({ codigo: "TORTA", precio: "18" })]);
  assert.deepEqual(r, { ok: true, items: [{ id: "0", codigo: "LATTE", categoria: "Cafés", cantidad: 2, precio: 10.5 }, { id: "1", codigo: "TORTA", categoria: null, cantidad: 1, precio: 18 }] });
  assert.match(parsearItemsPrueba([f(), f()]).error, /al menos un producto/);
  assert.match(parsearItemsPrueba([f({ codigo: "A", precio: "1", cantidad: "0" })]).error, /Fila 1.*cantidad/);
  assert.match(parsearItemsPrueba([f({ codigo: "A", precio: "1" }), f({ codigo: "B", precio: "x" })]).error, /Fila 2.*precio/);
  assert.match(parsearItemsPrueba([f({ precio: "5" })]).error, /Fila 1.*código/);
  assert.match(parsearItemsPrueba([f({ codigo: "A", precio: "1", cantidad: "100" })]).error, /1 a 99/);
});

test("fecha y hora de prueba: ISO si es válida, null si no", () => {
  assert.equal(ahoraDeNavegador(""), null);
  assert.equal(ahoraDeNavegador("ayer"), null);
  assert.match(ahoraDeNavegador("2026-10-22T20:00"), /^2026-10-2[23]T\d\d:00:00\.000Z$/);
});

test("permisos: la pestaña pide promocion:leer y el servicio tobt; gestionar también necesita leer", () => {
  assert.equal(SERVICIO_PROMOCIONES, "tobt");
  const ids = (p, s) => seccionesVisibles(p, s).map((x) => x.id);
  assert.ok(ids(["*"], ["tobt"]).includes("promociones"));
  assert.ok(ids(["promocion:leer"], ["tobt"]).includes("promociones"));
  assert.ok(ids(["promocion:*"], ["tobt"]).includes("promociones"));
  assert.ok(!ids(["*"], ["siscore"]).includes("promociones"), "sin tobt no hay pestaña");
  assert.ok(!ids(["promocion:gestionar"], ["tobt"]).includes("promociones"), "la lista pide promocion:leer en el servidor");
  assert.ok(!ids(["catalogo:leer", "reporte:leer"], ["tobt"]).includes("promociones"));
  assert.deepEqual([capacidades(["promocion:leer"]).promociones.gestionar, capacidades(["promocion:gestionar"]).promociones.gestionar], [false, false]);
  assert.equal(capacidades(["promocion:leer", "promocion:gestionar"]).promociones.gestionar, true);
  assert.equal(capacidades(["*"]).promociones.gestionar, true);
  assert.deepEqual(ids(["*"], ["tobt"]), ["equipo", "catalogo", "fidelizacion", "promociones", "anuncios", "resenas", "importar", "reportes", "empresa"]);
});

test("el destino de Inicio: pide promocion:leer y tobt", () => {
  const d = DESTINOS.find((x) => x.id === "empresa.promociones");
  assert.deepEqual([d.requiere, d.servicio, d.abre], ["promocion:leer", "tobt", { pantalla: "admin:promociones" }]);
  const ve = (permisos, servicios) => destinosAccesibles({ permisos, servicios }).some((x) => x.id === "empresa.promociones");
  assert.equal(ve(["*"], ["tobt"]), true);
  assert.equal(ve(["*"], ["siscore"]), false);
  assert.equal(ve(["fidelizacion:canjear"], ["tobt"]), false);
});
