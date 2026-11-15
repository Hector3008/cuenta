// Exportar los reportes a Excel (5.87): las hojas salen con los mismos datos de la pantalla y el .xlsx se abre de vuelta.
import test from "node:test";
import assert from "node:assert/strict";
import { fechaHoraEn, hojasDeInventario, hojasDeVentas, nombreArchivo, xlsxDeReporte } from "../client/src/admin/reportes-excel.js";
import { leerXlsx } from "../client/src/admin/xlsx.js";
import { normalizarReporteInventario } from "../client/src/admin/inventario-logica.js";

// fflate vive en client/node_modules (lo usa xlsx.js)
const { unzipSync, strFromU8 } = await import(new URL("../client/node_modules/fflate/esm/index.mjs", import.meta.url));

const ventas = {
  desde: "2026-10-19", hasta: "2026-10-21", dias: 3, zona: "America/Lima", moneda: "PEN", gran: "dia",
  resumen: { ventas: 26, items: 3, unidades: 4, pedidos: 2, ticketPromedio: 13, propinas: 1.5, recibos: 3, recibosConFactura: 2, cobradoConFactura: 18 },
  serie: [{ clave: "2026-10-19", inicio: "2026-10-19", ventas: 13, items: 1 }, { clave: "2026-10-20", inicio: "2026-10-20", ventas: 13, items: 2 }],
  categorias: [{ nombre: "Cafés", ventas: 18, items: 2, porcentaje: 69.2 }, { nombre: "Sin categoría", sinCategoria: true, ventas: 8, items: 1, porcentaje: 30.8 }],
  meseros: [{ nombre: "Luz Mesera", ventas: 13, items: 1, pedidos: 1, porcentaje: 50 }],
  clientes: { top: [{ nombre: "Ana", ventas: 13, items: 1, porcentaje: 50 }], otros: null, sinCliente: { ventas: 13, items: 2, porcentaje: 50 } },
  platos: [{ codigo: "LATTE", nombre: "Latte", categoria: "Cafés", cantidad: 2, ventas: 13 }, { codigo: null, nombre: "Torta casera", categoria: null, cantidad: 1, ventas: 8 }],
  horas: [{ dia: 1, hora: 22, ventas: 13, items: 1 }, { dia: 2, hora: 3, ventas: 0, items: 0 }],
  canales: [{ canal: "salon", ventas: 18, items: 2, porcentaje: 69.2 }],
  pagos: [{ metodo: "yape", metodoTexto: "Yape", recibos: 1, cobrado: 13, propinas: 1 }],
  promociones: { ahorro: 10, ventasAntes: 36, porcentaje: 27.8, items: 1, porPromocion: [{ nombre: "2×1 en lattes", ahorro: 10, items: 1, unidades: 2, porcentaje: 100 }], otras: { cantidad: 2, ahorro: 1, items: 1 } },
  facturas: [{ recibo: "RC-0000001", ts: "2026-10-20T15:05:00Z", pedido: "PD-0000001", rucReferencia: "20123456789", cliente: "Ana", subtotal: 13, propina: 1, total: 14, metodoTexto: "Yape" }],
};

const celdas = (h) => h.filas.slice(1);

test("ventas: una hoja por cada lista del reporte, con cabecera y los importes como números", () => {
  const hojas = hojasDeVentas(ventas);
  assert.deepEqual(hojas.map((h) => h.nombre), ["Resumen", "Por período", "Categorías", "Meseros", "Clientes", "Platos", "Por hora", "Canales", "Formas de pago", "Promociones", "Facturas pedidas"]);
  for (const h of hojas) assert.ok(h.filas[0].every((c) => typeof c === "string"), `cabecera de texto en ${h.nombre}`);
  const por = Object.fromEntries(hojas.map((h) => [h.nombre, h]));
  assert.deepEqual(celdas(por.Resumen).find((f) => f[0] === "Ventas"), ["Ventas", 26]);
  assert.deepEqual(celdas(por.Resumen).find((f) => f[0] === "Cobrado en recibos con factura"), ["Cobrado en recibos con factura", 18]);
  assert.deepEqual(celdas(por.Platos)[1], ["", "Torta casera", "", 1, 8].map((v) => (v === "" ? null : v)), "lo que no existe queda vacío");
  assert.deepEqual(celdas(por["Por hora"]), [["Lunes", "22:00", 13, 1]], "solo las horas con ventas");
  assert.deepEqual(celdas(por.Clientes).at(-1), ["Sin cliente", 13, 2, 50]);
  assert.deepEqual(celdas(por.Promociones).at(-1), ["Otras 2 promociones", 1, 1, null, null]);
  assert.deepEqual(celdas(por["Facturas pedidas"]), [["RC-0000001", "2026-10-20 10:05", "PD-0000001", "20123456789", "Ana", 13, 1, 14, "Yape"]], "la fecha va en la hora de la empresa");
});

test("ventas: con un reporte vacío o incompleto no se rompe", () => {
  const hojas = hojasDeVentas({});
  assert.equal(hojas.length, 11);
  assert.ok(hojas.every((h) => h.filas.length >= 1));
  assert.doesNotThrow(() => xlsxDeReporte("ventas", null));
});

test("inventario: resumen, margen por plato (sin costo = celda vacía) y consumo por insumo", () => {
  const d = normalizarReporteInventario({
    desde: "2026-10-19", hasta: "2026-10-21", dias: 3, zona: "America/Lima", moneda: "PEN",
    resumen: { ventas: 32.5, ventasConCosto: 19.5, costoDeVentas: 6.12, margen: 13.38, margenPct: 68.6, itemsSinCosto: 2, ventasSinCosto: 13, consumo: 6.12, merma: 4, compras: 86, ajuste: -0.06 },
    platos: [{ codigo: "LATTE", nombre: "Latte", categoria: "Cafés", unidades: 3, ventas: 19.5, items: 2, itemsSinCosto: 0, ventasConCosto: 19.5, costo: 6.12, margen: 13.38, margenPct: 68.6 }, { codigo: "MOKA", nombre: "Moka", unidades: 1, ventas: 5, items: 1, itemsSinCosto: 1, ventasConCosto: 0, costo: 0, margen: null, margenPct: null }],
    insumos: [{ insumoId: "a", codigo: "CAFE", nombre: "Café molido", unidad: "g", consumo: { cantidad: 54, valor: 4.32 }, merma: { cantidad: 50, valor: 4 }, compras: { cantidad: 1000, valor: 80 }, ajuste: { cantidad: 0, valor: 0 } }],
  });
  const hojas = hojasDeInventario(d);
  assert.deepEqual(hojas.map((h) => h.nombre), ["Resumen", "Margen por plato", "Consumo de insumos"]);
  assert.deepEqual(celdas(hojas[1])[0], ["LATTE", "Latte", "Cafés", 3, 19.5, 19.5, 6.12, 13.38, 68.6, 2, 0]);
  assert.deepEqual(celdas(hojas[1])[1], ["MOKA", "Moka", null, 1, 5, 0, null, null, null, 1, 1], "sin costo: costo, margen y % vacíos");
  assert.deepEqual(celdas(hojas[2])[0], ["CAFE", "Café molido", "g", 54, 4.32, 50, 4, 1000, 80, 0, 0]);
});

test("el .xlsx se abre de vuelta: varias hojas, la primera legible y los textos peligrosos como texto", () => {
  const datos = { ...ventas, resumen: { ...ventas.resumen }, platos: [{ codigo: "X", nombre: "=HYPERLINK(\"http://x\")", categoria: "<b>", cantidad: 1, ventas: 1 }] };
  const bytes = xlsxDeReporte("ventas", datos);
  const zip = unzipSync(bytes);
  assert.equal(Object.keys(zip).filter((k) => k.startsWith("xl/worksheets/")).length, 11);
  assert.match(strFromU8(zip["xl/workbook.xml"]), /name="Facturas pedidas"/);
  assert.ok(strFromU8(zip["xl/worksheets/sheet6.xml"]).includes("t=\"inlineStr\""), "los textos van como texto, no como fórmula");
  assert.ok(!/<f>/.test(strFromU8(zip["xl/worksheets/sheet6.xml"])), "ninguna fórmula");
  assert.deepEqual(leerXlsx(bytes).filas[0], ["Concepto", "Valor"]);
});

test("nombre del archivo y fecha en la zona de la empresa", () => {
  assert.equal(nombreArchivo("ventas", ventas), "ventas_2026-10-19_a_2026-10-21.xlsx");
  assert.equal(nombreArchivo("inventario", { desde: "2026-10-01", hasta: "2026-10-31" }), "inventario_2026-10-01_a_2026-10-31.xlsx");
  assert.equal(nombreArchivo("ventas", { desde: "../x", hasta: "a b" }), "ventas_x_a_ab.xlsx", "sin caracteres raros");
  assert.equal(fechaHoraEn("2026-10-21T03:30:00Z", "America/Lima"), "2026-10-20 22:30");
  assert.equal(fechaHoraEn("nada", "America/Lima"), null);
  assert.equal(fechaHoraEn("2026-10-21T03:30:00Z", "Zona/Mala"), "2026-10-21 03:30");
});
