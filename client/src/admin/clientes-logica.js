// Lógica pura de la pantalla de Clientes (5.68): ficha ↔ cuerpo de la API, textos y estados. Sin React ni navegador,
// para probarla con `node --test`. Las reglas de verdad viven en el núcleo (core/src/clientes/validacion.js): aquí solo se
// avisa pronto y con palabras claras; el servidor valida siempre.

export const TAMANO_PAGINA = 50; // el núcleo entrega hasta 50 por llamada si no se pide otro límite

// Debe coincidir con core/src/clientes/redes.js. Una red desconocida la rechaza el núcleo.
export const REDES = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["facebook", "Facebook"],
  ["x", "X"],
];
export const FINALIDADES = [
  ["programaPuntos", "Programa de puntos", "Acumular y canjear puntos por sus compras."],
  ["etiquetadoRedes", "Etiquetado en redes", "Que la empresa lo mencione o etiquete en sus publicaciones."],
];
// Cómo se obtuvo el consentimiento (los medios que admite el núcleo).
export const MEDIOS = [
  ["presencial", "En persona"],
  ["telefono", "Por teléfono"],
  ["mensaje", "Por mensaje"],
  ["qr", "Con un código QR"],
  ["formulario", "En un formulario"],
];
export const MEDIO_INICIAL = "presencial";
export const TIPOS_IDENTIFICACION = ["DNI", "RUC", "CE", "PASAPORTE", "CUIT", "CPF", "CI"];

export const FILTROS_CLIENTES = [
  ["activos", "Activos"],
  ["todos", "Todos"],
];
export const FILTRO_CLIENTES_INICIAL = "activos";

const textoDe = (t) => String(t ?? "").trim();
const unaLinea = (t) => textoDe(t).replace(/\s+/g, " ");

/** Un cliente tal como llega de la API, con valores seguros. */
export function normalizarCliente(c) {
  const consent = {};
  for (const [f] of FINALIDADES) {
    const k = c?.consentimientos?.[f];
    consent[f] = { otorgado: k?.otorgado === true, ts: k?.ts ?? null, medio: k?.medio ?? null };
  }
  const redes = {};
  for (const [r] of REDES) if (typeof c?.redes?.[r] === "string" && c.redes[r]) redes[r] = c.redes[r];
  return {
    id: String(c?.id ?? ""),
    nombre: String(c?.nombre ?? ""),
    telefono: c?.telefono ?? null,
    correo: c?.correo ?? null,
    redes,
    identificacion: c?.identificacion?.tipo ? { tipo: String(c.identificacion.tipo), numero: String(c.identificacion.numero ?? "") } : null,
    direccion: c?.direccion ?? null,
    consentimientos: consent,
    historial: Array.isArray(c?.historialConsentimientos)
      ? c.historialConsentimientos.map((h) => ({ finalidad: String(h?.finalidad ?? ""), otorgado: h?.otorgado === true, ts: h?.ts ?? null, medio: h?.medio ?? null }))
      : null, // solo viene en la ficha completa
    tieneCuenta: c?.tieneCuenta === true,
    activo: c?.activo !== false,
    anonimizado: c?.anonimizado === true,
    creadoTs: c?.creadoTs ?? null,
  };
}

/** Ficha vacía, o la del cliente para editarla. Todo como texto, que es lo que manejan los campos. */
export function formularioDe(c = null) {
  const redes = Object.fromEntries(REDES.map(([r]) => [r, c?.redes?.[r] ?? ""]));
  return {
    nombre: c?.nombre ?? "",
    telefono: c?.telefono ?? "",
    correo: c?.correo ?? "",
    ...redes,
    idTipo: c?.identificacion?.tipo ?? "",
    idNumero: c?.identificacion?.numero ?? "",
    direccion: c?.direccion ?? "",
  };
}

/**
 * Del formulario al cuerpo de la API. Al crear solo se envía lo escrito. Al editar, lo que se vació y antes tenía valor se
 * envía como `null` (quitar); lo que sigue vacío no se toca. Devuelve `{ error }` o `{ cuerpo }`.
 */
export function cuerpoDeFormulario(f, original = null) {
  const nombre = unaLinea(f.nombre);
  if (!nombre) return { error: "Escribe el nombre del cliente." };
  if (nombre.length > 80) return { error: "El nombre admite hasta 80 caracteres." };
  const tenia = formularioDe(original);
  const cuerpo = { nombre };
  const simple = (clave, valor, previo) => {
    const v = textoDe(valor);
    if (v) cuerpo[clave] = v;
    else if (original && previo) cuerpo[clave] = null;
  };
  simple("telefono", f.telefono, tenia.telefono);
  simple("correo", f.correo, tenia.correo);
  simple("direccion", unaLinea(f.direccion), tenia.direccion);
  const redes = {};
  for (const [r] of REDES) {
    const v = textoDe(f[r]);
    if (v) redes[r] = v;
    else if (original && tenia[r]) redes[r] = null;
  }
  if (Object.keys(redes).length) cuerpo.redes = redes;
  const tipo = textoDe(f.idTipo);
  const numero = textoDe(f.idNumero);
  if (tipo && !numero) return { error: "Escribe el número del documento o quita el tipo." };
  if (numero && !tipo) return { error: "Elige el tipo de documento." };
  if (tipo && numero) cuerpo.identificacion = { tipo, numero };
  else if (original && tenia.idTipo) cuerpo.identificacion = null;
  if (cuerpo.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cuerpo.correo)) return { error: "El correo no parece válido." };
  return { cuerpo };
}

/** Qué dato chocó, para decirlo con palabras (el núcleo responde CLIENTE_DUPLICADO con `campo`). */
export function textoDuplicado(err) {
  const campo = err?.datos?.campo ?? err?.datos?.error?.campo;
  if (campo === "telefono") return "Ya hay otro cliente con ese teléfono.";
  if (campo === "correo") return "Ya hay otro cliente con ese correo.";
  return err?.message || "Ya hay otro cliente con esos datos.";
}

/** Una línea con lo que se sabe para ubicar a la persona en la lista. */
export function contactoDe(c) {
  const redes = REDES.filter(([r]) => c.redes[r]).map(([r]) => `@${c.redes[r]}`);
  return [c.telefono, c.correo, ...redes].filter(Boolean).join(" · ");
}

/** «Activo», «Dado de baja» o «Anonimizado». */
export function estadoCliente(c) {
  if (c.anonimizado) return "Anonimizado";
  return c.activo ? "Activo" : "Dado de baja";
}

export const nombreMostrado = (c) => (c.anonimizado ? "Cliente anonimizado" : c.nombre || "Sin nombre");

export const etiquetaFinalidad = (f) => FINALIDADES.find(([k]) => k === f)?.[1] ?? f;
export const etiquetaMedio = (m) => MEDIOS.find(([k]) => k === m)?.[1] ?? (m || "—");

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** «27 oct 2026» para fechas ISO completas (hora de Lima, que es la de los negocios de la plataforma). */
export function fechaCliente(ts) {
  const d = new Date(ts);
  if (!ts || Number.isNaN(d.getTime())) return "—";
  const l = new Date(d.getTime() - 5 * 3600 * 1000);
  return `${l.getUTCDate()} ${MESES[l.getUTCMonth()]} ${l.getUTCFullYear()}`;
}

/** Frase del consentimiento actual: «Sí · 27 oct 2026 · En persona» / «No». */
export function textoConsentimiento(k) {
  if (!k?.otorgado) return k?.ts ? `No · retirado el ${fechaCliente(k.ts)}` : "No";
  return `Sí · ${fechaCliente(k.ts)} · ${etiquetaMedio(k.medio)}`;
}

/** Cuántos más pedir: si la última página vino llena puede haber más. */
export const hayMas = (recibidos, pagina = TAMANO_PAGINA) => recibidos >= pagina;

export const textoVacioClientes = (busqueda, filtro) =>
  busqueda ? `Nadie coincide con «${busqueda}».` : filtro === "activos" ? "Todavía no hay clientes activos." : "Todavía no hay clientes.";
