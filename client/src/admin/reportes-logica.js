// Lógica pura de la pantalla Reportes (5.35), sin JSX ni navegador, para probarla con node --test.
// Los datos ya vienen resumidos del servidor (`GET tobt/reportes/ventas`); aquí solo se escalan,
// se rotulan y se convierten en geometría para los gráficos SVG.

export const SERVICIO_REPORTES = "tobt"; // antes «restaurante» (renombrado en 5.36)
export const MAX_DIAS = 366;

export const ATAJOS = Object.freeze([
  { id: "1", dias: 1, titulo: "Hoy" },
  { id: "7", dias: 7, titulo: "7 días" },
  { id: "30", dias: 30, titulo: "30 días" },
  { id: "90", dias: 90, titulo: "90 días" },
]);
export const ATAJO_POR_DEFECTO = "30";
export const GRANULARIDADES = Object.freeze([
  { id: "dia", titulo: "Día" },
  { id: "semana", titulo: "Semana" },
  { id: "mes", titulo: "Mes" },
]);
export const DIAS_SEMANA = Object.freeze(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
const DIAS_LARGOS = Object.freeze(["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]);

// ---------- consulta ----------

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaReal = (t) => {
  if (!RE_FECHA.test(String(t ?? ""))) return null;
  const [y, m, d] = t.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d ? f.getTime() : null;
};

/**
 * Lo que pide la persona → parámetros de la consulta, o `{ error }` si no se puede pedir.
 * Un atajo manda `dias` (el servidor decide qué día es hoy en la zona de la empresa); un rango propio manda
 * `desde` y `hasta`.
 */
export function consultaDe({ atajo, desde, hasta, gran }) {
  const g = GRANULARIDADES.some((x) => x.id === gran) ? gran : "dia";
  if (atajo && atajo !== "personalizado") {
    const a = ATAJOS.find((x) => x.id === atajo);
    return a ? { consulta: { dias: a.dias, gran: g } } : { error: "Elige un rango." };
  }
  const d = fechaReal(desde);
  const h = fechaReal(hasta);
  if (d === null || h === null) return { error: "Escribe las dos fechas." };
  if (d > h) return { error: "«Desde» no puede ser posterior a «hasta»." };
  if ((h - d) / 86_400_000 + 1 > MAX_DIAS) return { error: `El rango no puede pasar de ${MAX_DIAS} días.` };
  return { consulta: { desde, hasta, gran: g } };
}

// ---------- texto ----------

const fechaCorta = (iso, opciones) => {
  const f = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(f.getTime()) ? String(iso) : new Intl.DateTimeFormat("es", { timeZone: "UTC", ...opciones }).format(f);
};

/** Rótulo de una cubeta: día «19 oct», semana «Sem. 19 oct», mes «oct 2026». */
export function rotuloCubeta(s, gran) {
  if (gran === "mes") return fechaCorta(s.inicio, { month: "short", year: "numeric" });
  if (gran === "semana") return `Sem. ${fechaCorta(s.inicio, { day: "numeric", month: "short" })}`;
  return fechaCorta(s.inicio, { day: "numeric", month: "short" });
}

/** Rótulo largo para el tooltip: «lun 19 oct 2026», «Semana del 19 oct 2026», «octubre 2026». */
export function rotuloLargo(s, gran) {
  if (gran === "mes") return fechaCorta(s.inicio, { month: "long", year: "numeric" });
  if (gran === "semana") return `Semana del ${fechaCorta(s.inicio, { day: "numeric", month: "short", year: "numeric" })}`;
  return fechaCorta(s.inicio, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function dinero(n, moneda) {
  const v = Number(n);
  if (n === null || n === undefined || !Number.isFinite(v)) return "—";
  if (!moneda) return v.toFixed(2);
  try {
    // «always»: en español 4 cifras no se agrupan por defecto y las columnas quedarían desiguales (9434 vs 15.095).
    return new Intl.NumberFormat("es", { style: "currency", currency: moneda, useGrouping: "always" }).format(v);
  } catch {
    return v.toFixed(2);
  }
}
export const entero = (n) => new Intl.NumberFormat("es").format(Number(n) || 0);

/** 0 · 1 K · 2,5 K · 1,2 M (ejes: cortos). */
export function compacto(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const f = (x) => new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(x);
  if (a >= 1_000_000) return `${f(v / 1_000_000)} M`;
  if (a >= 1_000) return `${f(v / 1_000)} K`;
  return f(v);
}

export const porcentaje = (p) => `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(Number(p) || 0)} %`;

// ---------- ejes y línea ----------

/** Números redondos de 0 hasta un tope que cubra el máximo: [0, 50, 100, 150]. */
export function ticksBonitos(max, cantidad = 4) {
  const m = Number(max);
  if (!Number.isFinite(m) || m <= 0) return [0, 1];
  const crudo = m / cantidad;
  const pot = 10 ** Math.floor(Math.log10(crudo));
  const f = crudo / pot;
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pot;
  const ticks = [];
  for (let v = 0; v < m + paso * 0.999; v += paso) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/**
 * Serie → puntos en píxeles dentro de un área `{ ancho, alto }` con márgenes. La escala empieza en 0 (una
 * línea de ventas sin cero exagera las caídas). Con un solo punto se centra.
 */
export function geometriaLinea(serie, { ancho, alto, margen = { arriba: 12, derecha: 12, abajo: 28, izquierda: 44 } }) {
  const valores = serie.map((s) => s.ventas);
  const ticks = ticksBonitos(Math.max(0, ...valores));
  const tope = ticks[ticks.length - 1];
  const w = Math.max(1, ancho - margen.izquierda - margen.derecha);
  const h = Math.max(1, alto - margen.arriba - margen.abajo);
  const n = serie.length;
  const x = (i) => margen.izquierda + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v) => margen.arriba + h - (tope > 0 ? (v / tope) * h : 0);
  const puntos = serie.map((s, i) => ({ x: x(i), y: y(s.ventas), i }));
  const base = margen.arriba + h;
  return { puntos, ticks: ticks.map((t) => ({ valor: t, y: y(t) })), base, izquierda: margen.izquierda, derecha: margen.izquierda + w, tope };
}

export const rutaLinea = (puntos) => puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
export const rutaArea = (puntos, base) =>
  puntos.length ? `${rutaLinea(puntos)}L${puntos[puntos.length - 1].x.toFixed(1)},${base}L${puntos[0].x.toFixed(1)},${base}Z` : "";

/** El punto más cercano a una posición horizontal (el cursor busca la fecha, no la línea). */
export function indiceMasCercano(puntos, x) {
  let mejor = -1;
  let dist = Infinity;
  for (const p of puntos) {
    const d = Math.abs(p.x - x);
    if (d < dist) [mejor, dist] = [p.i, d];
  }
  return mejor;
}

/** Cada cuántos puntos poner un rótulo en el eje X para que no se pisen. */
export const pasoDeRotulos = (cantidad, ancho, anchoRotulo = 64) => Math.max(1, Math.ceil(cantidad / Math.max(1, Math.floor(ancho / anchoRotulo))));

// ---------- barras, apilado y mapa de calor ----------

/** Filas con `ventas` → largo de barra (0 a 100) relativo a la mayor; una venta mayor que cero nunca queda invisible. */
export function largosDeBarra(filas, campo = "ventas") {
  const max = Math.max(0, ...filas.map((f) => Number(f[campo]) || 0));
  return filas.map((f) => {
    const v = Number(f[campo]) || 0;
    return { ...f, largo: max > 0 ? Math.max(v > 0 ? 1.5 : 0, (v / max) * 100) : 0 };
  });
}

/** Niveles del mapa de calor: 0 = sin ventas; 1 a N = de menos a más. Escala lineal sobre el máximo. */
export const NIVELES_CALOR = 5;
export function nivelDeCalor(valor, max, niveles = NIVELES_CALOR) {
  const v = Number(valor) || 0;
  if (v <= 0 || !(max > 0)) return 0;
  return Math.min(niveles, Math.max(1, Math.ceil((v / max) * niveles)));
}

/** La hora pico: la celda con más ventas (la primera si hay empate), o null si no hubo ventas. */
export function celdaPico(horas) {
  let mejor = null;
  for (const c of horas ?? []) if (c.ventas > 0 && (!mejor || c.ventas > mejor.ventas)) mejor = c;
  return mejor;
}
export const textoPico = (c, moneda) =>
  c ? `${DIAS_LARGOS[c.dia - 1]} a las ${String(c.hora).padStart(2, "0")}:00 (${dinero(c.ventas, moneda)})` : null;

export const rotuloHora = (h) => `${String(h).padStart(2, "0")}:00`;
export const rotuloCelda = (c) => `${DIAS_LARGOS[c.dia - 1]} ${rotuloHora(c.hora)}–${rotuloHora((c.hora + 1) % 24)}`;

/** Matriz [7][24] a partir de las 168 celdas (lunes primero). Tolera celdas que falten. */
export function matrizDeHoras(horas) {
  const m = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => ({ dia: d + 1, hora: h, ventas: 0, items: 0 })));
  for (const c of horas ?? []) if (c.dia >= 1 && c.dia <= 7 && c.hora >= 0 && c.hora <= 23) m[c.dia - 1][c.hora] = c;
  return m;
}

// ---------- colores ----------

// Un color por categoría, estable mientras la pantalla está abierta: el primero que aparece toma el primer lugar libre
// y lo conserva aunque otro rango cambie el orden (el color sigue a la categoría, no a su puesto). Siete colores;
// el octavo lugar y los siguientes (y «Otros») usan el gris.
export const COLORES_CATEGORIA = 7;
export function asignarColores(previo, nombres) {
  const mapa = new Map(previo);
  const usados = new Set(mapa.values());
  for (const n of nombres) {
    if (mapa.has(n)) continue;
    let libre = 0;
    while (libre < COLORES_CATEGORIA && usados.has(libre)) libre++;
    mapa.set(n, libre < COLORES_CATEGORIA ? libre : -1); // -1 = gris
    if (libre < COLORES_CATEGORIA) usados.add(libre);
  }
  return mapa;
}
export const variableDeColor = (indice) => (indice >= 0 && indice < COLORES_CATEGORIA ? `var(--rep-s${indice + 1})` : "var(--rep-otros)");

// ---------- tablas (la vista alternativa de cada gráfico) ----------

/** Promociones (5.43): una fila por promoción, más «Otras promociones» si el servidor juntó el resto. Tolera un servidor sin el campo. */
export function filasDePromociones(promociones, moneda) {
  const p = promociones ?? { porPromocion: [], otras: null };
  return [
    ...(p.porPromocion ?? []).map((x) => [x.nombre, dinero(x.ahorro, moneda), entero(x.items), porcentaje(x.porcentaje)]),
    ...(p.otras ? [[`Otras promociones (${entero(p.otras.cantidad)})`, dinero(p.otras.ahorro, moneda), entero(p.otras.items), porcentaje(p.otras.ahorro > 0 && promociones.ahorro > 0 ? Math.round((p.otras.ahorro / promociones.ahorro) * 1000) / 10 : 0)]] : []),
  ];
}

/** Las barras de promociones: por ahorro, con «Otras promociones» al final y apagada. */
export function barrasDePromociones(promociones) {
  const p = promociones ?? { porPromocion: [], otras: null, ahorro: 0 };
  return [
    ...(p.porPromocion ?? []).map((x) => ({ ...x, tipo: "promocion" })),
    ...(p.otras ? [{ id: "otras", nombre: `Otras promociones (${p.otras.cantidad})`, ahorro: p.otras.ahorro, items: p.otras.items, porcentaje: p.ahorro > 0 ? Math.round((p.otras.ahorro / p.ahorro) * 1000) / 10 : 0, tipo: "otras" }] : []),
  ];
}

/** ¿Se descontó algo por promociones en el rango? */
export const hayPromociones = (datos) => (datos?.promociones?.ahorro ?? 0) > 0;

export function filasDeTabla(datos, gran) {
  const { moneda } = datos;
  return {
    serie: datos.serie.map((s) => [rotuloLargo(s, gran), dinero(s.ventas, moneda), entero(s.items)]),
    categorias: datos.categorias.map((c) => [c.nombre, dinero(c.ventas, moneda), porcentaje(c.porcentaje)]),
    meseros: datos.meseros.map((m) => [m.nombre, dinero(m.ventas, moneda), entero(m.pedidos), porcentaje(m.porcentaje)]),
    clientes: [
      ...datos.clientes.top.map((c) => [c.nombre, dinero(c.ventas, moneda), porcentaje(c.porcentaje)]),
      ...(datos.clientes.otros ? [["Otros clientes", dinero(datos.clientes.otros.ventas, moneda), porcentaje(datos.clientes.otros.porcentaje)]] : []),
      ...(datos.clientes.sinCliente.ventas > 0 ? [["Sin cliente", dinero(datos.clientes.sinCliente.ventas, moneda), porcentaje(datos.clientes.sinCliente.porcentaje)]] : []),
    ],
    platos: datos.platos.map((p) => [p.nombre, entero(p.cantidad), dinero(p.ventas, moneda)]),
    promociones: filasDePromociones(datos.promociones, moneda),
    horas: datos.horas.filter((c) => c.ventas > 0).map((c) => [rotuloCelda(c), dinero(c.ventas, moneda), entero(c.items)]),
  };
}

/** ¿Hubo alguna venta en el rango? */
export const hayVentas = (datos) => Boolean(datos) && (datos.resumen?.items ?? 0) > 0;
