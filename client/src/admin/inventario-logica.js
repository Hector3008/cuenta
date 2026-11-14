// Lógica pura de la pestaña Inventario (5.77): formularios ↔ cuerpos de la API del kardex (core 5.75) y de las recetas
// (tobt 5.76), y los textos que describen insumos y movimientos. Sin React ni navegador, para probarla con `node --test`.
// Las reglas de verdad viven en el servidor (core/src/kardex/calculo.js y tobt/src/inventario.js): aquí solo se avisa
// pronto y con palabras claras; el servidor valida siempre.

// El kardex lo monta el gateway para todo el núcleo, pero solo lo alimenta tobt (recetas y pedidos): sin ese servicio no se ofrece.
export const SERVICIO_INVENTARIO = "tobt";
export const MAX_INSUMOS = 2000;
export const MAX_PRESENTACIONES = 10;
export const MAX_LINEAS_RECETA = 30;
export const MAX_DETALLE = 200;

export const TIPOS_MOVIMIENTO = {
  inventario_inicial: "Inventario inicial",
  compra: "Compra",
  consumo: "Consumo (pedido)",
  reversa: "Reversa (ítem anulado)",
  merma: "Merma",
  ajuste: "Ajuste (conteo)",
  anulacion: "Anulación",
};

const texto = (t) => String(t ?? "").trim().replace(/\s+/g, " ");
const CODIGO = /^[A-Za-z0-9._\-/]{1,40}$/;
const UNIDAD = /^[\p{L}\p{N}.]{1,12}$/u;

/** Número escrito por una persona (admite coma decimal). Devuelve { ok, valor }. */
export function parsearNumero(t, { decimales, minimo = 0, exclusivo = true, maximo = 1e9 } = {}) {
  const s = String(t ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const n = Number(s);
  if (!Number.isFinite(n) || (exclusivo ? n <= minimo : n < minimo) || n > maximo) return { ok: false };
  const dec = s.includes(".") ? s.split(".")[1].length : 0;
  if (decimales !== undefined && dec > decimales) return { ok: false };
  return { ok: true, valor: n };
}
const redondear = (n, d) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

// ---------- lo que llega del servidor ----------

export function normalizarInsumo(i) {
  return {
    id: String(i?.id ?? ""),
    codigo: i?.codigo ?? "",
    nombre: i?.nombre ?? "",
    unidad: i?.unidad ?? "",
    presentaciones: Array.isArray(i?.presentaciones) ? i.presentaciones.map((p) => ({ nombre: p?.nombre ?? "", factor: Number(p?.factor) || 0 })) : [],
    stockMinimo: Number(i?.stockMinimo) || 0,
    activo: i?.activo !== false,
    existencia: Number(i?.existencia) || 0,
    costoPromedio: Number(i?.costoPromedio) || 0,
    valor: Number(i?.valor) || 0,
    bajoMinimo: Boolean(i?.bajoMinimo),
  };
}

export function normalizarMovimiento(m) {
  return {
    id: String(m?.id ?? ""),
    insumoId: String(m?.insumoId ?? ""),
    secuencia: Number(m?.secuencia) || 0,
    tipo: m?.tipo ?? "",
    cantidad: Number(m?.cantidad) || 0,
    costoUnitario: Number(m?.costoUnitario) || 0,
    valor: Number(m?.valor) || 0,
    existenciaDespues: Number(m?.existenciaDespues) || 0,
    presentacion: m?.presentacion ?? null,
    referencia: m?.referencia ?? null,
    detalle: m?.detalle ?? null,
    anulaA: m?.anulaA ? String(m.anulaA) : null,
    anulado: m?.anulado === true,
    ts: m?.ts ?? null,
  };
}

export function normalizarReceta(r) {
  return {
    platoCodigo: r?.platoCodigo ?? "",
    lineas: Array.isArray(r?.lineas) ? r.lineas.map((l) => ({ insumoId: String(l?.insumoId ?? ""), cantidad: Number(l?.cantidad) || 0 })) : [],
  };
}

/** Un plato del catálogo, con solo lo que usa esta pestaña. */
export function normalizarPlato(i) {
  return { codigo: i?.codigo ?? "", nombre: i?.nombre ?? "", precio: typeof i?.precio === "number" ? i.precio : null, activo: i?.activo !== false };
}

// ---------- textos ----------

const miles = (n) => n.toLocaleString("es", { maximumFractionDigits: 3 });

/** «1 500 g», «-100 ml». */
export function textoCantidad(n, unidad) {
  return `${miles(Number(n) || 0)}${unidad ? ` ${unidad}` : ""}`;
}

/** Dinero con 2 decimales («12,50»). */
export function textoDinero(n) {
  return (Number(n) || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Costo por unidad base: hasta 4 decimales sin ceros de sobra («0,08», «0,0625»). */
export function textoCostoUnitario(n) {
  return (Number(n) || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** «negativo» (se vendió más de lo que había), «bajo el mínimo» o «» si está bien. */
export function alertaDeInsumo(i) {
  if (i.existencia < 0) return "negativo";
  if (i.stockMinimo > 0 && i.existencia <= i.stockMinimo) return "bajo el mínimo";
  return "";
}

/** «3 paquetes (500 g c/u)» cuando el movimiento se escribió en una presentación; si no, «». */
export function textoPresentacion(m, unidad) {
  const p = m.presentacion;
  if (!p?.nombre) return "";
  return `${miles(p.cantidad)} ${p.nombre} (${miles(p.factor)} ${unidad || ""} c/u)`.replace(/\s+\)/, ")");
}

/** El Date de un movimiento, como «12 nov 2026, 21:30» en la hora del navegador. */
export function textoFechaHora(ts) {
  const d = new Date(ts);
  if (!ts || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---------- insumos ----------

export function formularioDeInsumo(i) {
  return {
    codigo: i?.codigo ?? "",
    nombre: i?.nombre ?? "",
    unidad: i?.unidad ?? "",
    stockMinimo: i ? String(i.stockMinimo || "") : "",
    presentaciones: (i?.presentaciones ?? []).map((p) => ({ nombre: p.nombre, factor: String(p.factor) })),
  };
}

/**
 * Del formulario al cuerpo de la API, o el aviso de qué falta. Al editar solo viajan nombre, stock mínimo y presentaciones:
 * el código y la unidad no cambian nunca (los movimientos ya están escritos en esa unidad).
 */
export function parsearInsumo(f, { edicion = false } = {}) {
  const nombre = texto(f.nombre);
  if (!nombre) return { ok: false, error: "Ponle un nombre al insumo." };
  if (nombre.length > 120) return { ok: false, error: "El nombre puede tener hasta 120 caracteres." };
  const cuerpo = { nombre };
  if (!edicion) {
    const codigo = String(f.codigo ?? "").trim();
    if (!CODIGO.test(codigo)) return { ok: false, error: "El código lleva de 1 a 40 letras, números, punto, guion o barra, sin espacios." };
    const unidad = String(f.unidad ?? "").trim();
    if (!UNIDAD.test(unidad)) return { ok: false, error: "La unidad base es una palabra corta, por ejemplo g, ml o unidad." };
    Object.assign(cuerpo, { codigo, unidad });
  }
  const minimo = String(f.stockMinimo ?? "").trim() === "" ? { ok: true, valor: 0 } : parsearNumero(f.stockMinimo, { decimales: 3, exclusivo: false });
  if (!minimo.ok) return { ok: false, error: "El stock mínimo es un número (puede ser 0) con hasta 3 decimales." };
  cuerpo.stockMinimo = minimo.valor;

  const lista = (f.presentaciones ?? []).filter((p) => texto(p.nombre) !== "" || String(p.factor ?? "").trim() !== "");
  if (lista.length > MAX_PRESENTACIONES) return { ok: false, error: `Como máximo ${MAX_PRESENTACIONES} presentaciones.` };
  const unidad = (edicion ? f.unidad : String(f.unidad ?? "")).toLowerCase().trim();
  const vistos = new Set([unidad]);
  const presentaciones = [];
  for (const p of lista) {
    const n = texto(p.nombre);
    if (!n || n.length > 30) return { ok: false, error: "Cada presentación necesita un nombre de hasta 30 caracteres." };
    if (vistos.has(n.toLowerCase())) return { ok: false, error: `«${n}» está repetida o es igual a la unidad base.` };
    vistos.add(n.toLowerCase());
    const fac = parsearNumero(p.factor, { decimales: 3 });
    if (!fac.ok) return { ok: false, error: `¿Cuántas ${unidad || "unidades"} trae «${n}»? Escribe un número mayor que 0, con hasta 3 decimales.` };
    presentaciones.push({ nombre: n, factor: fac.valor });
  }
  cuerpo.presentaciones = presentaciones;
  return { ok: true, cuerpo };
}

// ---------- movimientos manuales ----------

export const ACCIONES = {
  compra: { titulo: "Registrar compra", ruta: "compra", pideCosto: true, pideDetalle: false, permiso: "registrar" },
  merma: { titulo: "Registrar merma", ruta: "merma", pideCosto: false, pideDetalle: true, permiso: "registrar" },
  conteo: { titulo: "Conteo físico", ruta: "conteo", pideCosto: false, pideDetalle: true, permiso: "gestionar" },
  inicial: { titulo: "Saldo inicial", ruta: "inicial", pideCosto: true, pideDetalle: false, permiso: "gestionar" },
};

export function formularioDeMovimiento() {
  return { cantidad: "", presentacion: "", modoCosto: "unitario", costo: "", detalle: "" };
}

/** Cuántas unidades base vale la presentación elegida (""/la unidad base = 1). null si no existe. */
export function factorDe(insumo, presentacion) {
  const p = String(presentacion ?? "").trim().toLowerCase();
  if (!p || p === String(insumo.unidad).toLowerCase()) return 1;
  const x = insumo.presentaciones.find((q) => q.nombre.toLowerCase() === p);
  return x ? x.factor : null;
}

/** Del formulario al cuerpo de la API de la acción (`compra`, `merma`, `conteo` o `inicial`), o el aviso de qué falta. */
export function parsearMovimiento(accion, f, insumo) {
  const def = ACCIONES[accion];
  if (!def) return { ok: false, error: "Acción desconocida." };
  const factor = factorDe(insumo, f.presentacion);
  if (factor === null) return { ok: false, error: "Esa presentación no existe en este insumo." };
  const cant = parsearNumero(f.cantidad, { decimales: 3, exclusivo: accion !== "conteo" });
  if (!cant.ok) {
    return { ok: false, error: accion === "conteo" ? "Escribe cuánto hay contado (puede ser 0), con hasta 3 decimales." : "Escribe una cantidad mayor que 0, con hasta 3 decimales." };
  }
  if (redondear(cant.valor * factor, 3) <= 0 && accion !== "conteo") return { ok: false, error: "La cantidad es demasiado pequeña." };
  const cuerpo = { cantidad: cant.valor };
  if (String(f.presentacion ?? "").trim()) cuerpo.presentacion = String(f.presentacion).trim();

  if (def.pideCosto) {
    const c = parsearNumero(f.costo, { decimales: 6, exclusivo: false });
    if (!c.ok) return { ok: false, error: f.modoCosto === "total" ? "Escribe el total pagado (0 o más)." : "Escribe el costo (0 o más)." };
    if (f.modoCosto === "total") cuerpo.costoTotal = c.valor;
    else cuerpo.costo = c.valor;
  }
  const detalle = texto(f.detalle);
  if (detalle.length > MAX_DETALLE) return { ok: false, error: `El detalle puede tener hasta ${MAX_DETALLE} caracteres.` };
  if (def.pideDetalle && !detalle) return { ok: false, error: accion === "conteo" ? "Cuenta el motivo del ajuste, por ejemplo «conteo de la semana»." : "Cuenta el motivo de la merma, por ejemplo «se venció»." };
  if (detalle) cuerpo.detalle = detalle;
  return { ok: true, cuerpo };
}

/** Lo que se registrará, en la unidad base, para mostrarlo antes de guardar: { base, costoUnitario|null } o null si aún no se puede calcular. */
export function vistaPrevia(accion, f, insumo) {
  const def = ACCIONES[accion];
  const factor = factorDe(insumo, f.presentacion);
  const cant = parsearNumero(f.cantidad, { decimales: 3, exclusivo: accion !== "conteo" });
  if (!def || factor === null || !cant.ok) return null;
  const base = redondear(cant.valor * factor, 3);
  let costoUnitario = null;
  if (def.pideCosto) {
    const c = parsearNumero(f.costo, { decimales: 6, exclusivo: false });
    if (c.ok && base > 0) costoUnitario = redondear(f.modoCosto === "total" ? c.valor / base : c.valor / factor, 6);
  }
  return { base, costoUnitario };
}

// ---------- corregir movimientos (5.84) ----------

const ANULABLES = ["inventario_inicial", "compra", "merma", "ajuste"];
const CORREGIBLES = { compra: "compra", merma: "merma" };

/** ¿Se puede anular este movimiento? Compras, mermas, conteos y saldo inicial que aún no se anularon. */
export function puedeAnular(m) {
  return !!m && ANULABLES.includes(m.tipo) && !m.anulado;
}

/** La acción con la que se vuelve a registrar un movimiento anulado (`compra` o `merma`), o null: el saldo inicial y los conteos se rehacen por su cuenta. */
export function accionDeCorreccion(m) {
  return puedeAnular(m) ? (CORREGIBLES[m.tipo] ?? null) : null;
}

/** El formulario de la acción ya lleno con lo que tenía el movimiento, para cambiar solo lo que estaba mal. El costo se deja como total pagado. */
export function formularioDeCorreccion(m) {
  const f = formularioDeMovimiento();
  const p = m?.presentacion;
  if (p && p.nombre && Number(p.cantidad) > 0) {
    f.presentacion = String(p.nombre);
    f.cantidad = String(p.cantidad);
  } else {
    f.cantidad = String(Math.abs(Number(m?.cantidad) || 0));
  }
  if (m?.tipo === "compra") {
    f.modoCosto = "total";
    f.costo = String(Math.abs(Number(m.valor) || 0));
    f.detalle = m.detalle ?? "";
  } else {
    f.detalle = m?.detalle ?? "";
  }
  return f;
}

/** El motivo de la anulación para `POST kardex/movimientos/:id/anular`, o el aviso de qué falta. */
export function parsearAnulacion(motivo) {
  const t = texto(motivo);
  if (!t) return { ok: false, error: "Cuenta el motivo, por ejemplo «me equivoqué en la cantidad»." };
  if (t.length > MAX_DETALLE) return { ok: false, error: `El motivo puede tener hasta ${MAX_DETALLE} caracteres.` };
  return { ok: true, cuerpo: { detalle: t } };
}

// ---------- recetas ----------

export function formularioDeReceta(r) {
  return { lineas: (r?.lineas ?? []).map((l) => ({ insumoId: l.insumoId, cantidad: String(l.cantidad) })) };
}

/** Del formulario al cuerpo de `PUT tobt/recetas/:plato`, o el aviso de qué falta. */
export function parsearReceta(f, insumos = []) {
  const lineas = (f.lineas ?? []).filter((l) => l.insumoId || String(l.cantidad ?? "").trim() !== "");
  if (lineas.length === 0) return { ok: false, error: "Agrega al menos un insumo a la receta." };
  if (lineas.length > MAX_LINEAS_RECETA) return { ok: false, error: `Como máximo ${MAX_LINEAS_RECETA} insumos por receta.` };
  const vistos = new Set();
  const salida = [];
  for (const l of lineas) {
    const insumo = insumos.find((i) => i.id === l.insumoId);
    if (!insumo) return { ok: false, error: "Elige el insumo de cada línea." };
    if (vistos.has(insumo.id)) return { ok: false, error: `«${insumo.nombre}» está dos veces: suma las cantidades en una sola línea.` };
    vistos.add(insumo.id);
    const c = parsearNumero(l.cantidad, { decimales: 3, maximo: 1e6 });
    if (!c.ok) return { ok: false, error: `¿Cuánto ${insumo.nombre} gasta una porción? Escribe un número mayor que 0, con hasta 3 decimales (en ${insumo.unidad}).` };
    salida.push({ insumoId: insumo.id, cantidad: c.valor });
  }
  return { ok: true, cuerpo: { lineas: salida } };
}

/** Lo que cuesta una porción al costo promedio de hoy. `incompleto` si algún insumo no tiene costo todavía (nunca se compró). */
export function costoDeReceta(lineas, insumos) {
  let costo = 0;
  let incompleto = false;
  for (const l of lineas) {
    const i = insumos.find((x) => x.id === l.insumoId);
    if (!i || !(i.costoPromedio > 0)) incompleto = true;
    else costo += l.cantidad * i.costoPromedio;
  }
  return { costo: redondear(costo, 4), incompleto };
}

/** Margen de un plato: precio − costo. null si falta alguno de los dos. */
export function margenDePlato(precio, costo) {
  if (typeof precio !== "number" || !(precio > 0) || typeof costo !== "number") return null;
  const margen = redondear(precio - costo, 2);
  return { margen, porcentaje: Math.round((margen / precio) * 1000) / 10 };
}

/** Los avisos de la valorización, en una línea. */
export function resumenValorizacion(v) {
  const partes = [];
  const neg = v?.negativos?.length ?? 0;
  const bajo = v?.bajoMinimo?.length ?? 0;
  if (neg) partes.push(`${neg} ${neg === 1 ? "insumo en negativo" : "insumos en negativo"}`);
  if (bajo) partes.push(`${bajo} ${bajo === 1 ? "insumo bajo el mínimo" : "insumos bajo el mínimo"}`);
  return partes.join(" · ");
}
