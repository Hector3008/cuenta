// Lógica pura de la pantalla de Anuncios (5.49): formulario ↔ cuerpo de la API, y los textos que describen un anuncio.
// Sin React ni navegador, para probarla con `node --test`. Las reglas de verdad viven en el núcleo
// (core/src/anuncios/validacion.js): aquí solo se avisa pronto y con palabras claras; el servidor valida siempre.
import { parsearImagen, MAX_IMAGEN } from "./formato.js";
import { fechaCorta } from "./promociones-logica.js";

// Los anuncios los guarda el núcleo pero hoy solo los muestra la carta pública de tobt: sin ese servicio la pestaña no se ofrece.
export const SERVICIO_ANUNCIOS = "tobt";
export const MAX_ANUNCIOS_ACTIVOS = 50;
export const MAX_TITULO = 80;
export const MAX_DESCRIPCION_ANUNCIO = 300;
export const MAX_LUGAR = 80;

export const TIPOS_ANUNCIO = [
  ["evento", "Evento (un día y una hora)"],
  ["publicidad", "Publicidad (un aviso)"],
];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const textoDe = (t) => String(t ?? "").trim().replace(/\s+/g, " ");
const fechaReal = (v) => {
  if (!FECHA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** El formulario (todo texto) de un anuncio, o el de uno nuevo si `a` es null. */
export function formularioDeAnuncio(a) {
  return {
    tipo: a?.tipo ?? "evento",
    titulo: a?.titulo ?? "",
    descripcion: a?.descripcion ?? "",
    imagen: a?.imagen ?? "",
    fecha: a?.fecha ?? "",
    hora: a?.hora ?? "",
    lugar: a?.lugar ?? "",
    desde: a?.vigencia?.desde ?? "",
    hasta: a?.vigencia?.hasta ?? "",
    activo: a?.activo !== false,
  };
}

/** Del formulario al cuerpo de la API, o el aviso de qué falta. Solo lleva los campos de su tipo. */
export function parsearAnuncio(f) {
  const titulo = textoDe(f.titulo);
  if (!titulo) return { ok: false, error: "Ponle un título al anuncio." };
  if (titulo.length > MAX_TITULO) return { ok: false, error: `El título puede tener hasta ${MAX_TITULO} caracteres.` };
  const descripcion = textoDe(f.descripcion);
  if (descripcion.length > MAX_DESCRIPCION_ANUNCIO) return { ok: false, error: `La descripción puede tener hasta ${MAX_DESCRIPCION_ANUNCIO} caracteres.` };
  const imagen = parsearImagen(f.imagen);
  if (!imagen.ok) return { ok: false, error: `La foto debe ser una dirección que empiece con https://, sin espacios y de hasta ${MAX_IMAGEN} caracteres.` };

  const cuerpo = { tipo: f.tipo, titulo, descripcion: descripcion || null, imagen: imagen.valor, activo: f.activo !== false };

  if (f.tipo === "evento") {
    const fecha = String(f.fecha ?? "").trim();
    if (!fecha) return { ok: false, error: "Indica el día del evento." };
    if (!fechaReal(fecha)) return { ok: false, error: "El día del evento no es una fecha válida." };
    const hora = String(f.hora ?? "").trim();
    if (!hora) return { ok: false, error: "Indica la hora del evento." };
    if (!HORA.test(hora)) return { ok: false, error: "La hora debe ser como 21:00." };
    const lugar = textoDe(f.lugar);
    if (lugar.length > MAX_LUGAR) return { ok: false, error: `El lugar puede tener hasta ${MAX_LUGAR} caracteres.` };
    Object.assign(cuerpo, { fecha, hora, lugar: lugar || null });
  } else if (f.tipo === "publicidad") {
    const desde = String(f.desde ?? "").trim();
    const hasta = String(f.hasta ?? "").trim();
    if (desde && !fechaReal(desde)) return { ok: false, error: "«Desde el día» no es una fecha válida." };
    if (hasta && !fechaReal(hasta)) return { ok: false, error: "«Hasta el día» no es una fecha válida." };
    if (desde && hasta && hasta < desde) return { ok: false, error: "«Hasta el día» no puede ser antes que «Desde el día»." };
    cuerpo.vigencia = desde || hasta ? { desde: desde || null, hasta: hasta || null } : null;
  } else {
    return { ok: false, error: "Elige si es un evento o una publicidad." };
  }
  return { ok: true, cuerpo };
}

/** Lo que llega del servidor, con valores por defecto. */
export function normalizarAnuncio(a) {
  return {
    id: String(a?.id ?? ""),
    tipo: a?.tipo ?? "",
    titulo: a?.titulo ?? "",
    descripcion: a?.descripcion ?? null,
    imagen: a?.imagen ?? null,
    fecha: a?.fecha ?? null,
    hora: a?.hora ?? null,
    lugar: a?.lugar ?? null,
    vigencia: a?.vigencia ?? null,
    activo: a?.activo !== false,
  };
}

/** «2026-11-07» + «21:00» → «7 nov 2026 · 21:00» (+ « · Terraza»). */
export function textoEvento(a) {
  return [`${fechaCorta(a.fecha)} · ${a.hora}`, a.lugar].filter(Boolean).join(" · ");
}

/** Cuándo está en la carta. Para un evento, hasta que pasa su día; para una publicidad, su vigencia. */
export function textoCuandoAnuncio(a) {
  if (a.tipo === "evento") return textoEvento(a);
  const v = a.vigencia;
  if (v?.desde && v?.hasta) return `Del ${fechaCorta(v.desde)} al ${fechaCorta(v.hasta)}`;
  if (v?.desde) return `Desde el ${fechaCorta(v.desde)}`;
  if (v?.hasta) return `Hasta el ${fechaCorta(v.hasta)}`;
  return "Siempre";
}

/** «hoy» como AAAA-MM-DD en la hora del navegador (aproximación: la carta usa la hora de la empresa). */
export function hoyDeNavegador(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** «pausado» · «pasó» (evento ya realizado o publicidad vencida) · «próximamente» (publicidad que aún no empieza) · «en la carta». */
export function estadoAnuncio(a, hoy) {
  if (!a.activo) return "pausado";
  if (a.tipo === "evento") return a.fecha < hoy ? "pasó" : "en la carta";
  if (a.vigencia?.hasta && a.vigencia.hasta < hoy) return "pasó";
  if (a.vigencia?.desde && a.vigencia.desde > hoy) return "próximamente";
  return "en la carta";
}
