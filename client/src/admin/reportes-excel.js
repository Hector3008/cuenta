// Exportar los reportes a Excel (5.87). Lógica pura: arma las hojas (`crearXlsx`) con los mismos datos que ya muestra la
// pantalla (lo que respondió el servidor), sin pedir nada más. Los importes salen como números (se pueden sumar en Excel);
// los textos, como texto. Un valor que no existe (un margen sin costo) queda como celda vacía, nunca como 0.
import { crearXlsx } from "./xlsx.js";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const n = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const t = (v) => (v === null || v === undefined ? null : String(v));

/** «2026-10-20 10:05» en la zona horaria de la empresa; vacío si la fecha no vale. */
export function fechaHoraEn(ts, zona) {
  const d = new Date(ts);
  if (!ts || Number.isNaN(d.getTime())) return null;
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: zona || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d).map((x) => [x.type, x.value]),
    );
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

const hoja = (nombre, cabecera, filas, anchos) => ({ nombre, filas: [cabecera, ...filas], anchos: anchos ?? cabecera.map((c) => Math.max(12, String(c).length + 4)) });

/** El nombre del archivo: «ventas_2026-10-19_a_2026-10-21.xlsx». */
export function nombreArchivo(tipo, datos) {
  const limpio = (x) => String(x ?? "").replace(/[^0-9A-Za-z-]/g, "");
  const base = tipo === "inventario" ? "inventario" : "ventas";
  return `${base}_${limpio(datos?.desde) || "desde"}_a_${limpio(datos?.hasta) || "hasta"}.xlsx`;
}

/** Las hojas del reporte de ventas (`GET tobt/reportes/ventas`). */
export function hojasDeVentas(d) {
  const r = d?.resumen ?? {};
  const promo = d?.promociones ?? {};
  const resumen = hoja("Resumen", ["Concepto", "Valor"], [
    ["Desde", t(d?.desde)], ["Hasta", t(d?.hasta)], ["Días", n(d?.dias)], ["Zona horaria", t(d?.zona)], ["Moneda", t(d?.moneda)],
    ["Ventas", n(r.ventas)], ["Ítems vendidos", n(r.items)], ["Unidades", n(r.unidades)], ["Pedidos", n(r.pedidos)],
    ["Ticket promedio", n(r.ticketPromedio)], ["Propinas", n(r.propinas)], ["Recibos", n(r.recibos)],
    ["Recibos con factura", n(r.recibosConFactura)], ["Cobrado en recibos con factura", n(r.cobradoConFactura)],
    ["Ahorro por promociones", n(promo.ahorro)], ["Ventas sin promociones", n(promo.ventasAntes)],
  ], [34, 22]);
  const serie = hoja("Por período", ["Período", "Inicio", "Ventas", "Ítems"], (d?.serie ?? []).map((s) => [t(s.clave), t(s.inicio), n(s.ventas), n(s.items)]), [16, 14, 14, 10]);
  const categorias = hoja("Categorías", ["Categoría", "Ventas", "Ítems", "% de las ventas"], (d?.categorias ?? []).map((c) => [t(c.nombre), n(c.ventas), n(c.items), n(c.porcentaje)]), [28, 14, 10, 16]);
  const meseros = hoja("Meseros", ["Mesero (quien cobró)", "Ventas", "Ítems", "Pedidos", "% de las ventas"], (d?.meseros ?? []).map((m) => [t(m.nombre), n(m.ventas), n(m.items), n(m.pedidos), n(m.porcentaje)]), [30, 14, 10, 10, 16]);
  const cl = d?.clientes ?? {};
  const filasClientes = (cl.top ?? []).map((c) => [t(c.nombre), n(c.ventas), n(c.items), n(c.porcentaje)]);
  if (cl.otros) filasClientes.push(["Otros clientes", n(cl.otros.ventas), null, n(cl.otros.porcentaje)]);
  if (cl.sinCliente) filasClientes.push(["Sin cliente", n(cl.sinCliente.ventas), n(cl.sinCliente.items), n(cl.sinCliente.porcentaje)]);
  const clientes = hoja("Clientes", ["Cliente", "Ventas", "Ítems", "% de las ventas"], filasClientes, [30, 14, 10, 16]);
  const platos = hoja("Platos", ["Código", "Plato", "Categoría", "Cantidad", "Ventas"], (d?.platos ?? []).map((p) => [t(p.codigo), t(p.nombre), t(p.categoria), n(p.cantidad), n(p.ventas)]), [14, 32, 22, 10, 14]);
  const horas = hoja("Por hora", ["Día", "Hora", "Ventas", "Ítems"], (d?.horas ?? []).filter((h) => h.items > 0).map((h) => [DIAS[(h.dia ?? 1) - 1] ?? t(h.dia), `${String(h.hora).padStart(2, "0")}:00`, n(h.ventas), n(h.items)]), [14, 8, 14, 10]);
  const canales = hoja("Canales", ["Canal", "Ventas", "Ítems", "% de las ventas"], (d?.canales ?? []).map((c) => [t(c.canal ?? "Sin canal"), n(c.ventas), n(c.items), n(c.porcentaje)]), [18, 14, 10, 16]);
  const pagos = hoja("Formas de pago", ["Forma de pago", "Recibos", "Cobrado", "Propinas"], (d?.pagos ?? []).map((p) => [t(p.metodoTexto), n(p.recibos), n(p.cobrado), n(p.propinas)]), [22, 10, 14, 12]);
  const filasPromos = (promo.porPromocion ?? []).map((p) => [t(p.nombre), n(p.ahorro), n(p.items), n(p.unidades), n(p.porcentaje)]);
  if (promo.otras) filasPromos.push([`Otras ${promo.otras.cantidad} promociones`, n(promo.otras.ahorro), n(promo.otras.items), null, null]);
  const promociones = hoja("Promociones", ["Promoción", "Ahorro", "Ítems", "Unidades", "% del ahorro"], filasPromos, [32, 14, 10, 10, 14]);
  const facturas = hoja(
    "Facturas pedidas",
    ["Recibo", "Fecha", "Pedido", "RUC / referencia", "Cliente", "Subtotal", "Propina", "Total", "Forma de pago"],
    (d?.facturas ?? []).map((f) => [t(f.recibo), fechaHoraEn(f.ts, d?.zona), t(f.pedido), t(f.rucReferencia), t(f.cliente), n(f.subtotal), n(f.propina), n(f.total), t(f.metodoTexto)]),
    [14, 18, 14, 22, 24, 12, 10, 12, 18],
  );
  return [resumen, serie, categorias, meseros, clientes, platos, horas, canales, pagos, promociones, facturas];
}

/** Las hojas del reporte del inventario, ya normalizado (`normalizarReporteInventario`). */
export function hojasDeInventario(d) {
  const r = d?.resumen ?? {};
  const resumen = hoja("Resumen", ["Concepto", "Valor"], [
    ["Desde", t(d?.desde)], ["Hasta", t(d?.hasta)], ["Días", n(d?.dias)], ["Zona horaria", t(d?.zona)], ["Moneda", t(d?.moneda)],
    ["Ventas", n(r.ventas)], ["Ventas con costo", n(r.ventasConCosto)], ["Ventas sin costo", n(r.ventasSinCosto)], ["Ítems sin costo", n(r.itemsSinCosto)],
    ["Costo de ventas", n(r.costoDeVentas)], ["Margen (solo ventas con costo)", n(r.margen)], ["Margen % (solo ventas con costo)", n(r.margenPct)],
    ["Insumos consumidos (costo)", n(r.consumo)], ["Mermas (costo)", n(r.merma)], ["Compras", n(r.compras)], ["Ajustes por conteo (costo)", n(r.ajuste)],
  ], [36, 22]);
  const platos = hoja(
    "Margen por plato",
    ["Código", "Plato", "Categoría", "Vendidos", "Ventas", "Ventas con costo", "Costo", "Margen", "Margen %", "Ítems", "Ítems sin costo"],
    (d?.platos ?? []).map((p) => [t(p.codigo), t(p.nombre), t(p.categoria), n(p.unidades), n(p.ventas), n(p.ventasConCosto), p.margen === null ? null : n(p.costo), n(p.margen), n(p.margenPct), n(p.items), n(p.itemsSinCosto)]),
    [14, 32, 22, 10, 12, 16, 12, 12, 10, 8, 14],
  );
  const insumos = hoja(
    "Consumo de insumos",
    ["Código", "Insumo", "Unidad", "Consumo", "Costo del consumo", "Merma", "Costo de la merma", "Compras", "Valor de las compras", "Ajuste (conteo)", "Valor del ajuste"],
    (d?.insumos ?? []).map((i) => [t(i.codigo), t(i.nombre), t(i.unidad), n(i.consumo?.cantidad), n(i.consumo?.valor), n(i.merma?.cantidad), n(i.merma?.valor), n(i.compras?.cantidad), n(i.compras?.valor), n(i.ajuste?.cantidad), n(i.ajuste?.valor)]),
    [12, 30, 8, 12, 16, 10, 16, 12, 18, 14, 14],
  );
  return [resumen, platos, insumos];
}

/** Los bytes del .xlsx de un reporte: `tipo` es «ventas» o «inventario». */
export function xlsxDeReporte(tipo, datos) {
  return crearXlsx(tipo === "inventario" ? hojasDeInventario(datos) : hojasDeVentas(datos));
}
