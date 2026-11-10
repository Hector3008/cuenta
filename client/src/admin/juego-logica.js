// Lógica pura de la pestaña «Juego» (5.82): configuración del juego de agatas (servicio `agatas`).
// Sin React ni navegador, para probarla con `node --test`. Las reglas son las de agatas/src/config.js;
// el servidor vuelve a validar todo (esto solo da respuesta rápida al escribir).

export const SERVICIO_JUEGO = "agatas";

export const LIMITES = Object.freeze({
  coloresMin: 2, coloresMax: 12, agatasPorColorMax: 50, manoMax: 50, premiosMax: 10, preguntaMax: 200, textoMax: 4000, nombreMax: 40,
});

/** Campos de «Reglas»: [clave, título, ayuda, mínimo, máximo, unidad]. */
export const CAMPOS_REGLAS = [
  ["partidasPorIpHora", "Partidas nuevas por IP y hora", "Tope contra quien crea partidas sin parar. En un café todos comparten el WiFi: no lo bajes mucho.", 1, 1000, ""],
  ["intercambiosPorHora", "Intercambios por jugador y hora", "Propuestas y aceptaciones que puede hacer cada persona en una hora.", 1, 200, ""],
  ["ofertaVenceSeg", "Una oferta sin pareja se cae a los", "Tiempo que espera una oferta a que alguien la acepte.", 30, 3600, "segundos"],
  ["reservaVenceSeg", "Un intercambio sin confirmar se cae a los", "Tiempo para responder las preguntas y que los dos confirmen.", 60, 7200, "segundos"],
  ["cookieDias", "La partida se recuerda", "Cuánto dura la partida en el celular de quien juega.", 1, 365, "días"],
];

const RE_ID = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const RE_HEX = /^#[0-9a-f]{6}$/;

const clonar = (x) => JSON.parse(JSON.stringify(x));

/** Lo que devuelve GET/PUT /agatas/config, con valores seguros. */
export function normalizarRespuesta(r) {
  const c = r?.config ?? {};
  const config = {
    personaje: { singular: String(c.personaje?.singular ?? ""), plural: String(c.personaje?.plural ?? "") },
    colores: (Array.isArray(c.colores) ? c.colores : []).map((x) => ({ id: String(x?.id ?? ""), nombre: String(x?.nombre ?? ""), hex: String(x?.hex ?? "#999999").toLowerCase() })),
    agatasPorColor: Number.isInteger(c.agatasPorColor) ? c.agatasPorColor : 6,
    manoPorJugador: Number.isInteger(c.manoPorJugador) ? c.manoPorJugador : 6,
    requiereCuenta: c.requiereCuenta === true,
    premios: (Array.isArray(c.premios) ? c.premios : []).map((p) => ({
      id: String(p?.id ?? ""), umbral: Number.isInteger(p?.umbral) ? p.umbral : 1, nombre: String(p?.nombre ?? ""), descripcion: String(p?.descripcion ?? ""),
    })),
    preguntas: c.preguntas && typeof c.preguntas === "object" && !Array.isArray(c.preguntas) ? { ...c.preguntas } : {},
    textos: { instrucciones: String(c.textos?.instrucciones ?? ""), reglas: String(c.textos?.reglas ?? "") },
    reglas: {},
  };
  for (const [k, , , min] of CAMPOS_REGLAS) config.reglas[k] = Number.isInteger(c.reglas?.[k]) ? c.reglas[k] : min;
  return {
    config,
    guardada: r?.guardada === true,
    advertencias: (Array.isArray(r?.advertencias) ? r.advertencias : []).map((a) => String(a?.mensaje ?? "")).filter(Boolean),
  };
}

/** «Verde oliva» → «verde-oliva»: minúsculas, sin tildes, sin espacios, único entre `usados`. */
export function idDesde(texto, usados = [], prefijo = "id") {
  let base = String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
  if (!base || !/^[a-z0-9]/.test(base)) base = prefijo;
  let id = base;
  for (let n = 2; usados.includes(id); n++) id = `${base.slice(0, 20)}-${n}`;
  return id;
}

/** Códigos de todas las agatas («<color>-<n>»), en orden. */
export function codigosAgatas(config) {
  return config.colores.flatMap((c) => Array.from({ length: config.agatasPorColor }, (_, n) => `${c.id}-${n + 1}`));
}

export function sinPregunta(config) {
  return codigosAgatas(config).filter((k) => !String(config.preguntas[k] ?? "").trim());
}

/** Quita las preguntas vacías y las de agatas que ya no existen (el servidor rechaza las huérfanas). */
export function podar(config) {
  const validos = new Set(codigosAgatas(config));
  const preguntas = {};
  for (const [k, v] of Object.entries(config.preguntas)) {
    const t = String(v ?? "").trim();
    if (validos.has(k) && t) preguntas[k] = t;
  }
  return { ...clonar(config), preguntas };
}

/** Solo los campos que cambiaron (el servidor mezcla campo a campo). Vacío = no hay nada que guardar. */
export function cambiosParaGuardar(original, borrador) {
  const a = podar(original);
  const b = podar(borrador);
  const cambios = {};
  for (const k of Object.keys(b)) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) cambios[k] = b[k];
  }
  return cambios;
}

/** Problemas que el servidor rechazaría. [{ campo, mensaje }] */
export function problemas(config) {
  const lista = [];
  const mal = (campo, mensaje) => lista.push({ campo, mensaje });
  if (!config.personaje.singular.trim() || !config.personaje.plural.trim()) mal("personaje", "Escribe cómo se llama cada pieza, en singular y en plural.");
  if (config.colores.length < LIMITES.coloresMin || config.colores.length > LIMITES.coloresMax) mal("colores", `Debe haber entre ${LIMITES.coloresMin} y ${LIMITES.coloresMax} colores.`);
  const ids = new Set();
  config.colores.forEach((c, i) => {
    if (!c.nombre.trim()) mal("colores", `El color ${i + 1} necesita un nombre.`);
    if (!RE_ID.test(c.id)) mal("colores", `El color «${c.nombre || i + 1}» tiene un identificador inválido.`);
    if (ids.has(c.id)) mal("colores", `Hay dos colores con el identificador «${c.id}».`);
    ids.add(c.id);
    if (!RE_HEX.test(c.hex)) mal("colores", `El color «${c.nombre || i + 1}» necesita un color válido.`);
  });
  if (!Number.isInteger(config.agatasPorColor) || config.agatasPorColor < 1 || config.agatasPorColor > LIMITES.agatasPorColorMax) mal("agatasPorColor", `Las piezas por color van de 1 a ${LIMITES.agatasPorColorMax}.`);
  if (!Number.isInteger(config.manoPorJugador) || config.manoPorJugador < 1 || config.manoPorJugador > LIMITES.manoMax) mal("manoPorJugador", `La mano va de 1 a ${LIMITES.manoMax}.`);
  else if (config.manoPorJugador > config.agatasPorColor) mal("manoPorJugador", "La mano no puede ser más grande que las piezas de cada color (se arma con las de su color).");
  if (config.premios.length > LIMITES.premiosMax) mal("premios", `Máximo ${LIMITES.premiosMax} premios.`);
  const pids = new Set();
  const umbrales = new Set();
  config.premios.forEach((p, i) => {
    if (!p.nombre.trim()) mal("premios", `El premio ${i + 1} necesita un nombre.`);
    if (!RE_ID.test(p.id) || pids.has(p.id)) mal("premios", `El premio «${p.nombre || i + 1}» tiene un identificador inválido o repetido.`);
    pids.add(p.id);
    if (!Number.isInteger(p.umbral) || p.umbral < 1 || p.umbral > config.colores.length) mal("premios", `«${p.nombre || i + 1}»: los colores distintos van de 1 a ${config.colores.length} (la cantidad de colores).`);
    if (umbrales.has(p.umbral)) mal("premios", `Dos premios piden ${p.umbral} colores: cada uno debe pedir una cantidad distinta.`);
    umbrales.add(p.umbral);
  });
  for (const [k, , , min, max] of CAMPOS_REGLAS) {
    const v = config.reglas[k];
    if (!Number.isInteger(v) || v < min || v > max) mal("reglas", `«${CAMPOS_REGLAS.find((r) => r[0] === k)[1]}» va de ${min} a ${max}.`);
  }
  for (const [k, v] of Object.entries(config.preguntas)) if (String(v).length > LIMITES.preguntaMax) mal("preguntas", `La pregunta «${k}» pasa de ${LIMITES.preguntaMax} caracteres.`);
  if (config.textos.instrucciones.length > LIMITES.textoMax || config.textos.reglas.length > LIMITES.textoMax) mal("textos", `Los textos llegan hasta ${LIMITES.textoMax} caracteres.`);
  return lista;
}

/** Avisos (no impiden guardar) de cambios que afectan a partidas ya empezadas. */
export function avisosDeCambio(original, borrador) {
  const av = [];
  const antes = new Map(original.colores.map((c) => [c.id, c]));
  const despues = new Set(borrador.colores.map((c) => c.id));
  const quitados = [...antes.values()].filter((c) => !despues.has(c.id));
  if (quitados.length) av.push(`Quitas ${quitados.map((c) => `«${c.nombre}»`).join(", ")}: quien ya tenga piezas de ese color las conservará sin color. Conviene cambiar los colores solo antes de empezar a jugar.`);
  if (borrador.agatasPorColor < original.agatasPorColor) av.push("Reduces las piezas por color: las partidas en curso pueden quedar con piezas que ya no existen.");
  if (borrador.manoPorJugador !== original.manoPorJugador) av.push("El tamaño de la mano solo afecta a las partidas nuevas.");
  return av;
}

/** Cuántas preguntas faltan por color: [{ color, faltan, total }]. */
export function resumenPreguntas(config) {
  return config.colores.map((c) => {
    const codigos = Array.from({ length: config.agatasPorColor }, (_, n) => `${c.id}-${n + 1}`);
    return { color: c, faltan: codigos.filter((k) => !String(config.preguntas[k] ?? "").trim()).length, total: codigos.length };
  });
}

// ───── Ediciones puras (devuelven una copia) ─────
export function nuevoColor(config) {
  const c = clonar(config);
  const n = c.colores.length + 1;
  c.colores.push({ id: idDesde(`color ${n}`, c.colores.map((x) => x.id), "color"), nombre: `Color ${n}`, hex: "#7a7a7a" });
  return c;
}

/** Renombra; el identificador solo se regenera en colores que todavía no estaban guardados (los guardados lo conservan). */
export function renombrarColor(config, i, nombre, idsGuardados = []) {
  const c = clonar(config);
  const col = c.colores[i];
  col.nombre = nombre;
  if (!idsGuardados.includes(col.id)) {
    col.id = idDesde(nombre, c.colores.filter((_, j) => j !== i).map((x) => x.id), "color");
  }
  return c;
}

export function quitarColor(config, i) {
  const c = clonar(config);
  c.colores.splice(i, 1);
  return podar(c);
}

export function nuevoPremio(config) {
  const c = clonar(config);
  const usados = new Set(c.premios.map((p) => p.umbral));
  let umbral = 1;
  while (usados.has(umbral) && umbral < c.colores.length) umbral++;
  c.premios.push({ id: idDesde(`premio ${c.premios.length + 1}`, c.premios.map((p) => p.id), "premio"), umbral, nombre: "", descripcion: "" });
  return c;
}

/** Enlace que va en el QR del local. `urlApp` es la dirección de la pantalla del juego (…/agatas/app/). */
export function enlaceJuego(urlApp, slug) {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(s)) return null;
  const u = new URL(urlApp);
  u.search = "";
  u.hash = "";
  u.searchParams.set("e", s);
  return u.toString();
}

export function enlaceMesero(urlApp) {
  const u = new URL(urlApp);
  u.search = "";
  u.hash = "";
  u.searchParams.set("m", "mesero");
  return u.toString();
}
