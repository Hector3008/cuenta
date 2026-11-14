import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCIONES, SERVICIO_INVENTARIO, alertaDeInsumo, costoDeReceta, factorDe, formularioDeInsumo, formularioDeMovimiento, formularioDeReceta,
  margenDePlato, normalizarInsumo, normalizarMovimiento, normalizarReceta, parsearInsumo, parsearMovimiento, parsearNumero, parsearReceta,
  resumenValorizacion, textoCantidad, textoPresentacion, vistaPrevia,
} from "../client/src/admin/inventario-logica.js";
import { capacidades, seccionesVisibles } from "../client/src/admin/permisos.js";
import { DESTINOS, destinosAccesibles } from "../client/src/destinos.js";
import { GUIA, explicacionDe } from "../client/src/admin/permisos-guia.js";

const cafe = normalizarInsumo({ id: "a1", codigo: "CAFE", nombre: "Café molido", unidad: "g", presentaciones: [{ nombre: "paquete", factor: 500 }], existencia: 1000, costoPromedio: 0.08, valor: 80, stockMinimo: 200 });
const leche = normalizarInsumo({ id: "a2", codigo: "LECHE", nombre: "Leche", unidad: "ml", existencia: 0, costoPromedio: 0 });
const ok = (r) => (assert.equal(r.ok, true, r.error), r.cuerpo);
const mal = (r, texto) => (assert.equal(r.ok, false), texto && assert.match(r.error, texto));

test("parsearNumero: acepta coma, rechaza texto, cero y demasiados decimales", () => {
  assert.deepEqual(parsearNumero("1,5", { decimales: 3 }), { ok: true, valor: 1.5 });
  assert.equal(parsearNumero("0", { decimales: 3 }).ok, false);
  assert.equal(parsearNumero("0", { decimales: 3, exclusivo: false }).ok, true);
  assert.equal(parsearNumero("1.2345", { decimales: 3 }).ok, false);
  assert.equal(parsearNumero("abc").ok, false);
  assert.equal(parsearNumero("-1", { exclusivo: false }).ok, false);
  assert.equal(parsearNumero("").ok, false);
});

test("parsearInsumo: alta completa con presentaciones, y los avisos de lo que falta", () => {
  const f = { ...formularioDeInsumo(null), codigo: " CAFE ", nombre: " Café  molido ", unidad: "g", stockMinimo: "200", presentaciones: [{ nombre: "paquete", factor: "500" }, { nombre: "", factor: "" }] };
  assert.deepEqual(ok(parsearInsumo(f)), { nombre: "Café molido", codigo: "CAFE", unidad: "g", stockMinimo: 200, presentaciones: [{ nombre: "paquete", factor: 500 }] });
  mal(parsearInsumo({ ...f, nombre: "" }), /nombre/);
  mal(parsearInsumo({ ...f, codigo: "a b" }), /código/);
  mal(parsearInsumo({ ...f, unidad: "" }), /unidad/);
  mal(parsearInsumo({ ...f, stockMinimo: "-1" }), /mínimo/);
  mal(parsearInsumo({ ...f, presentaciones: [{ nombre: "paquete", factor: "0" }] }), /paquete/);
  mal(parsearInsumo({ ...f, presentaciones: [{ nombre: "g", factor: "2" }] }), /repetida|igual/);
  mal(parsearInsumo({ ...f, presentaciones: [{ nombre: "Caja", factor: "1" }, { nombre: "caja", factor: "2" }] }), /repetida/);
  assert.deepEqual(ok(parsearInsumo({ ...f, stockMinimo: "" })).stockMinimo, 0);
});

test("parsearInsumo al editar: solo nombre, mínimo y presentaciones (código y unidad no viajan)", () => {
  const f = formularioDeInsumo(cafe);
  assert.deepEqual(f.presentaciones, [{ nombre: "paquete", factor: "500" }]);
  assert.deepEqual(ok(parsearInsumo({ ...f, unidad: cafe.unidad, nombre: "Café" }, { edicion: true })), { nombre: "Café", stockMinimo: 200, presentaciones: [{ nombre: "paquete", factor: 500 }] });
});

test("parsearMovimiento: compra en presentación con costo por paquete o total pagado", () => {
  const f = { ...formularioDeMovimiento(), cantidad: "3", presentacion: "paquete", costo: "40" };
  assert.deepEqual(ok(parsearMovimiento("compra", f, cafe)), { cantidad: 3, presentacion: "paquete", costo: 40 });
  assert.deepEqual(ok(parsearMovimiento("compra", { ...f, modoCosto: "total", costo: "120", detalle: " Factura  F-1 " }, cafe)), { cantidad: 3, presentacion: "paquete", costoTotal: 120, detalle: "Factura F-1" });
  assert.deepEqual(ok(parsearMovimiento("compra", { ...f, presentacion: "", cantidad: "1,5", costo: "0" }, cafe)), { cantidad: 1.5, costo: 0 });
  mal(parsearMovimiento("compra", { ...f, presentacion: "saco" }, cafe), /presentación/);
  mal(parsearMovimiento("compra", { ...f, cantidad: "0" }, cafe), /mayor que 0/);
  mal(parsearMovimiento("compra", { ...f, costo: "" }, cafe), /costo/i);
  mal(parsearMovimiento("compra", { ...f, detalle: "x".repeat(201) }, cafe), /200/);
});

test("parsearMovimiento: merma y conteo piden motivo; el conteo admite 0 y no lleva costo", () => {
  const f = { ...formularioDeMovimiento(), cantidad: "10" };
  mal(parsearMovimiento("merma", f, cafe), /motivo/);
  assert.deepEqual(ok(parsearMovimiento("merma", { ...f, detalle: "se venció" }, cafe)), { cantidad: 10, detalle: "se venció" });
  mal(parsearMovimiento("conteo", { ...f, detalle: "" }, cafe), /motivo/);
  assert.deepEqual(ok(parsearMovimiento("conteo", { ...f, cantidad: "0", detalle: "se acabó" }, cafe)), { cantidad: 0, detalle: "se acabó" });
  assert.deepEqual(ok(parsearMovimiento("inicial", { ...f, costo: "0,5" }, cafe)), { cantidad: 10, costo: 0.5 });
  mal(parsearMovimiento("otra", f, cafe), /desconocida/);
  assert.deepEqual(Object.keys(ACCIONES).sort(), ["compra", "conteo", "inicial", "merma"]);
});

test("vistaPrevia: pasa a unidad base y reparte el costo", () => {
  const f = { ...formularioDeMovimiento(), cantidad: "3", presentacion: "paquete", costo: "40" };
  assert.deepEqual(vistaPrevia("compra", f, cafe), { base: 1500, costoUnitario: 0.08 });
  assert.deepEqual(vistaPrevia("compra", { ...f, modoCosto: "total", costo: "150" }, cafe), { base: 1500, costoUnitario: 0.1 });
  assert.deepEqual(vistaPrevia("merma", { ...f, presentacion: "" }, cafe), { base: 3, costoUnitario: null });
  assert.equal(vistaPrevia("compra", { ...f, cantidad: "x" }, cafe), null);
  assert.equal(factorDe(cafe, "G"), 1);
  assert.equal(factorDe(cafe, "Paquete"), 500);
  assert.equal(factorDe(cafe, "saco"), null);
});

test("alertaDeInsumo: negativo, bajo el mínimo o nada", () => {
  assert.equal(alertaDeInsumo({ existencia: -1, stockMinimo: 0 }), "negativo");
  assert.equal(alertaDeInsumo({ existencia: 200, stockMinimo: 200 }), "bajo el mínimo");
  assert.equal(alertaDeInsumo({ existencia: 0, stockMinimo: 0 }), "");
  assert.equal(alertaDeInsumo({ existencia: 500, stockMinimo: 200 }), "");
});

test("recetas: del formulario al cuerpo, sin repetir insumos, con costo y margen", () => {
  const insumos = [cafe, { ...leche, costoPromedio: 0.005, activo: true }];
  const f = { lineas: [{ insumoId: "a1", cantidad: "15" }, { insumoId: "a2", cantidad: "200" }, { insumoId: "", cantidad: "" }] };
  assert.deepEqual(ok(parsearReceta(f, insumos)), { lineas: [{ insumoId: "a1", cantidad: 15 }, { insumoId: "a2", cantidad: 200 }] });
  mal(parsearReceta({ lineas: [] }, insumos), /al menos/);
  mal(parsearReceta({ lineas: [{ insumoId: "", cantidad: "5" }] }, insumos), /Elige/);
  mal(parsearReceta({ lineas: [{ insumoId: "a1", cantidad: "5" }, { insumoId: "a1", cantidad: "6" }] }, insumos), /dos veces/);
  mal(parsearReceta({ lineas: [{ insumoId: "a1", cantidad: "0" }] }, insumos), /Café molido/);
  const r = normalizarReceta({ platoCodigo: "CAFE-1", lineas: [{ insumoId: "a1", cantidad: 15 }] });
  assert.deepEqual(formularioDeReceta(r), { lineas: [{ insumoId: "a1", cantidad: "15" }] });
  assert.deepEqual(costoDeReceta([{ insumoId: "a1", cantidad: 15 }, { insumoId: "a2", cantidad: 200 }], insumos), { costo: 2.2, incompleto: false });
  assert.equal(costoDeReceta([{ insumoId: "a1", cantidad: 15 }, { insumoId: "x", cantidad: 1 }], insumos).incompleto, true);
  assert.equal(costoDeReceta([{ insumoId: "a2", cantidad: 1 }], [leche]).incompleto, true, "sin costo todavía");
  assert.deepEqual(margenDePlato(5, 2.2), { margen: 2.8, porcentaje: 56 });
  assert.equal(margenDePlato(null, 2), null);
  assert.equal(margenDePlato(5, undefined), null);
});

test("normalizadores y textos", () => {
  assert.deepEqual(normalizarInsumo(null).presentaciones, []);
  assert.equal(normalizarMovimiento({ cantidad: "-5" }).cantidad, -5);
  assert.equal(textoCantidad(1500, "g"), "1500 g".replace("1500", (1500).toLocaleString("es", { maximumFractionDigits: 3 })));
  assert.equal(textoPresentacion({ presentacion: null }, "g"), "");
  assert.match(textoPresentacion({ presentacion: { nombre: "paquete", cantidad: 3, factor: 500 } }, "g"), /3 paquete \(.*500 g c\/u\)/);
  assert.equal(resumenValorizacion({ negativos: [1], bajoMinimo: [1, 2] }), "1 insumo en negativo · 2 insumos bajo el mínimo");
  assert.equal(resumenValorizacion({ negativos: [], bajoMinimo: [] }), "");
  assert.equal(resumenValorizacion(null), "");
});

test("permisos: la pestaña pide kardex:leer y el servicio tobt; cada botón, su permiso", () => {
  assert.equal(SERVICIO_INVENTARIO, "tobt");
  const ver = (p, s) => seccionesVisibles(p, s).some((x) => x.id === "inventario");
  assert.ok(ver(["kardex:leer"], ["tobt"]));
  assert.ok(ver(["*"], ["tobt"]));
  assert.ok(ver(["kardex:*"], undefined), "sin lista de servicios no se oculta (como las demás)");
  assert.ok(!ver(["kardex:leer"], ["agatas"]), "sin el servicio no se ofrece");
  assert.ok(!ver(["kardex:registrar"], ["tobt"]), "registrar solo no ve la lista: se da junto con leer");
  assert.ok(!ver(["documento:leer", "catalogo:leer"], ["tobt"]));
  const c = capacidades(["kardex:leer", "kardex:registrar"]).inventario;
  assert.deepEqual([c.ver, c.registrar, c.gestionar], [true, true, false]);
  const g = capacidades(["kardex:leer", "kardex:gestionar"]).inventario;
  assert.deepEqual([g.ver, g.registrar, g.gestionar], [true, false, true]);
  const solo = capacidades(["kardex:gestionar"]).inventario;
  assert.deepEqual([solo.ver, solo.gestionar], [false, false], "gestionar sin leer no abre nada");
  assert.deepEqual(Object.values(capacidades(["*"]).inventario), [true, true, true]);
});

test("destinos y guía: Inicio ofrece Inventario y los tres permisos están explicados", () => {
  const d = DESTINOS.find((x) => x.id === "empresa.inventario");
  assert.deepEqual([d.requiere, d.servicio, d.disponible, d.abre.pantalla], ["kardex:leer", "tobt", true, "admin:inventario"]);
  const yo = (permisos, servicios) => ({ permisos, servicios, empresaActivaId: "e1", empresas: [{ id: "e1" }] });
  const ids = (y) => destinosAccesibles(y).map((x) => x.id);
  assert.ok(ids(yo(["kardex:leer"], ["tobt"])).includes("empresa.inventario"));
  assert.ok(!ids(yo(["kardex:leer"], ["agatas"])).includes("empresa.inventario"));
  assert.ok(!ids(yo(["documento:leer"], ["tobt"])).includes("empresa.inventario"));
  for (const p of ["kardex:leer", "kardex:registrar", "kardex:gestionar"]) assert.ok(explicacionDe(p), p);
  assert.ok(GUIA.some((g) => g.id === "inventario"));
});
