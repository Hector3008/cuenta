// Facturas pedidas (5.88): consulta, normalización y validación de lo que se escribe en la pestaña «Facturas».
import test from "node:test";
import assert from "node:assert/strict";
import { consultaDeFacturas, normalizarFacturas, parsearMotivoDeshacer, parsearNumeroFactura, textoPendientes } from "../client/src/admin/facturas-logica.js";
import { consultaDe } from "../client/src/admin/reportes-logica.js";
import { capacidades, seccionesVisibles } from "../client/src/admin/permisos.js";

test("consulta: sin rango no manda fechas (no se esconde un pendiente antiguo); con atajo o fechas, sí", () => {
  assert.deepEqual(consultaDeFacturas({ estado: "pendientes", atajo: "todo" }, consultaDe), { consulta: { estado: "pendientes" } });
  assert.deepEqual(consultaDeFacturas({ estado: "raro" }, consultaDe), { consulta: { estado: "pendientes" } });
  assert.deepEqual(consultaDeFacturas({ estado: "todas", atajo: "7" }, consultaDe), { consulta: { estado: "todas", dias: 7 } });
  assert.deepEqual(consultaDeFacturas({ estado: "emitidas", atajo: "personalizado", desde: "2026-10-01", hasta: "2026-10-05" }, consultaDe), { consulta: { estado: "emitidas", desde: "2026-10-01", hasta: "2026-10-05" } });
  assert.ok(consultaDeFacturas({ atajo: "personalizado", desde: "", hasta: "" }, consultaDe).error);
});

test("normalizar: cifras seguras y emisión solo si existe", () => {
  const r = normalizarFacturas({
    numeroObligatorio: true, resumen: { pendientes: { cantidad: 2, total: 30 } },
    facturas: [{ recibo: "RC-1", estado: "pendiente", total: "10" }, { recibo: "RC-2", estado: "emitida", total: 5, emision: { numero: "F1", por: "Marta", ts: "2026-10-18T10:00:00Z" } }],
  });
  assert.equal(r.numeroObligatorio, true);
  assert.deepEqual(r.resumen, { pendientes: { cantidad: 2, total: 30 }, emitidas: { cantidad: 0, total: 0 } });
  assert.deepEqual([r.facturas[0].total, r.facturas[0].emision, r.facturas[1].emision.numero], [10, null, "F1"]);
  assert.deepEqual(normalizarFacturas(null).facturas, []);
});

test("número: opcional salvo que la empresa lo pida; limpio y acotado", () => {
  assert.deepEqual(parsearNumeroFactura("  "), { ok: true, numero: null });
  assert.equal(parsearNumeroFactura("", { obligatorio: true }).ok, false);
  assert.deepEqual(parsearNumeroFactura("  F001-123 ", { obligatorio: true }), { ok: true, numero: "F001-123" });
  for (const malo of ["x".repeat(31), "<b>", "-1"]) assert.equal(parsearNumeroFactura(malo).ok, false, malo);
});

test("motivo de deshacer: «otro» pide explicación", () => {
  assert.equal(parsearMotivoDeshacer("nada").ok, false);
  assert.equal(parsearMotivoDeshacer("otro", " ").ok, false);
  assert.deepEqual(parsearMotivoDeshacer("otro", " se anuló "), { ok: true, motivo: { codigo: "otro", detalle: "se anuló" } });
  assert.deepEqual(parsearMotivoDeshacer("error_de_marca"), { ok: true, motivo: { codigo: "error_de_marca" } });
});

test("textoPendientes", () => {
  assert.deepEqual([0, 1, 3].map(textoPendientes), ["Sin pendientes", "1 pendiente", "3 pendientes"]);
});

test("permisos: ver pide documento:leer y la estación de administración; marcar, documento:editar; configurar, empresa:datos", () => {
  const todo = capacidades(["*"]).facturas;
  assert.deepEqual(todo, { ver: true, marcar: true, configurar: true });
  assert.equal(capacidades(["documento:leer"]).facturas.ver, false, "un mesero no entra");
  const adm = capacidades(["documento:leer", "estacion:administracion"]).facturas;
  assert.deepEqual(adm, { ver: true, marcar: false, configurar: false });
  assert.ok(seccionesVisibles(["*"], ["tobt"]).some((s) => s.id === "facturas"));
  assert.ok(!seccionesVisibles(["*"], ["siscore"]).some((s) => s.id === "facturas"), "sin tobt no hay facturas");
});
