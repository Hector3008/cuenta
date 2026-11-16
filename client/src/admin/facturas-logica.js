// Facturas pedidas (5.88): lógica pura de la pestaña «Facturas». La lista y las marcas las calcula `tobt` (`GET /facturas`);
// aquí solo se arma la consulta, se normaliza la respuesta y se valida lo que se escribe antes de enviarlo.
export const SERVICIO_FACTURAS = "tobt";
export const MAX_NUMERO_FACTURA = 30;

export const ESTADOS_FACTURA = Object.freeze([
  { id: "pendientes", titulo: "Pendientes" },
  { id: "emitidas", titulo: "Emitidas" },
  { id: "todas", titulo: "Todas" },
]);
// «Todo» es el valor por defecto: sin fechas, así no se esconde una factura pendiente antigua.
export const RANGO_TODO = "todo";

export const MOTIVOS_DESHACER = Object.freeze([
  { id: "error_de_marca", titulo: "La marqué por error" },
  { id: "factura_anulada", titulo: "La factura se anuló" },
  { id: "otro", titulo: "Otro motivo" },
]);

/** La consulta de la lista: `{ consulta }` o `{ error }`. `consultaDeVentas` es `consultaDe` de reportes-logica (fechas y atajos). */
export function consultaDeFacturas({ estado, atajo, desde, hasta }, consultaDeVentas) {
  const e = ESTADOS_FACTURA.some((x) => x.id === estado) ? estado : "pendientes";
  if (!atajo || atajo === RANGO_TODO) return { consulta: { estado: e } };
  const r = consultaDeVentas({ atajo, desde, hasta });
  if (r.error) return r;
  const { gran, ...resto } = r.consulta;
  return { consulta: { estado: e, ...resto } };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function normalizarFacturas(r) {
  const cuenta = (x) => ({ cantidad: num(x?.cantidad), total: num(x?.total) });
  return {
    desde: r?.desde ?? null, hasta: r?.hasta ?? null, dias: r?.dias ?? null, zona: r?.zona ?? null, moneda: r?.moneda ?? null,
    numeroObligatorio: r?.numeroObligatorio === true,
    resumen: { pendientes: cuenta(r?.resumen?.pendientes), emitidas: cuenta(r?.resumen?.emitidas) },
    truncado: r?.truncado === true,
    facturas: (Array.isArray(r?.facturas) ? r.facturas : []).map((f) => ({
      recibo: String(f.recibo ?? ""), estado: f.estado === "emitida" ? "emitida" : "pendiente", version: f.version ?? null, ts: f.ts ?? null,
      pedido: f.pedido ?? null, rucReferencia: f.rucReferencia ?? null, cliente: f.cliente ?? null, total: num(f.total),
      metodoTexto: f.metodoTexto ?? null,
      emision: f.emision ? { numero: f.emision.numero ?? null, por: f.emision.por ?? null, ts: f.emision.ts ?? null } : null,
    })),
  };
}

/** El número escrito, listo para enviar: `{ ok, numero }` (null si se dejó vacío) o `{ ok:false, error }`. */
export function parsearNumeroFactura(texto, { obligatorio = false } = {}) {
  const t = String(texto ?? "").trim().replace(/\s+/g, " ");
  if (!t) return obligatorio ? { ok: false, error: "Escribe el número de la factura (por ejemplo F001-123)." } : { ok: true, numero: null };
  if (t.length > MAX_NUMERO_FACTURA) return { ok: false, error: `El número admite hasta ${MAX_NUMERO_FACTURA} caracteres.` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .\-/]*$/u.test(t)) return { ok: false, error: "El número solo puede tener letras, números, espacios y . - /" };
  return { ok: true, numero: t };
}

/** El motivo para deshacer: `{ ok, motivo }` o `{ ok:false, error }`. «Otro motivo» pide una explicación. */
export function parsearMotivoDeshacer(codigo, detalle) {
  if (!MOTIVOS_DESHACER.some((m) => m.id === codigo)) return { ok: false, error: "Elige un motivo." };
  const d = String(detalle ?? "").trim().slice(0, 200);
  if (codigo === "otro" && !d) return { ok: false, error: "Cuéntanos el motivo." };
  return { ok: true, motivo: { codigo, ...(d ? { detalle: d } : {}) } };
}

/** «3 pendientes» / «1 pendiente» / «Sin pendientes». */
export function textoPendientes(n) {
  const c = num(n);
  return c === 0 ? "Sin pendientes" : c === 1 ? "1 pendiente" : `${c} pendientes`;
}
