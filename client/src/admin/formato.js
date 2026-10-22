// Lógica pura de formato (sin JSX, para poder probarla con node --test).

// Precio para mostrar. La moneda de la empresa (5.16) todavía no llega al front (/auth/yo no la
// informa): sin moneda conocida se muestra el número con 2 decimales y no se inventa un símbolo.
// null = sin precio.
export function formatoPrecio(precio, moneda) {
  if (precio === null || precio === undefined) return "—";
  const n = Number(precio);
  if (!Number.isFinite(n)) return "—";
  if (!moneda) return n.toFixed(2);
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency: moneda }).format(n);
  } catch {
    return `${n.toFixed(2)} ${moneda}`;
  }
}

// Descripción y foto del plato (5.25, 5.29): viven en los atributos `DESCRIPCION` e `IMAGEN` del ítem.
// El núcleo admite hasta 500 caracteres por texto (5.16) y la carta pública solo muestra una foto cuya
// URL sea https absoluta, sin credenciales y de hasta 500 caracteres: aquí se valida lo mismo antes de
// enviar, para no guardar una foto que la carta luego descartaría en silencio.
export const MAX_DESCRIPCION = 500;
export const MAX_IMAGEN = 500;

export function parsearDescripcion(texto) {
  const t = String(texto ?? "").trim();
  if (t === "") return { ok: true, valor: null };
  if (t.length > MAX_DESCRIPCION) return { ok: false };
  return { ok: true, valor: t };
}

// Un enlace de «compartir» de Google Drive (drive.google.com/file/d/<id>/view, /open?id=<id>, /uc?id=<id>)
// abre la página de Drive, no la imagen: en un <img> no se ve. Se convierte a la dirección de miniatura
// directa, que sí sirve la imagen si el archivo está compartido con «Cualquier persona con el enlace».
// Cualquier otra dirección se devuelve igual.
export function normalizarImagen(texto) {
  const t = String(texto ?? "").trim();
  let u;
  try {
    u = new URL(t);
  } catch {
    return t;
  }
  if (u.protocol !== "https:" || u.hostname !== "drive.google.com") return t;
  const id = u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,})(?:\/|$)/)?.[1] ?? (/^\/(?:open|uc)$/.test(u.pathname) ? u.searchParams.get("id") : null);
  if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) return t;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
}

export const esEnlaceDeDrive = (texto) => normalizarImagen(texto) !== String(texto ?? "").trim();

// Vacío = sin foto. Ruta absoluta (no se suben archivos): solo https, sin usuario ni contraseña.
export function parsearImagen(texto) {
  const t = normalizarImagen(texto);
  if (t === "") return { ok: true, valor: null };
  if (t.length > MAX_IMAGEN || /\s/.test(t)) return { ok: false };
  let u;
  try {
    u = new URL(t);
  } catch {
    return { ok: false };
  }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return { ok: false };
  return { ok: true, valor: t };
}

// El núcleo rechaza más de 2 decimales (5.16): se valida antes de enviar.
export function parsearPrecio(texto) {
  const t = String(texto ?? "").trim().replace(",", ".");
  if (t === "") return { ok: true, valor: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false };
  return { ok: true, valor: Number(t) };
}

// ---------- fidelización (5.30) ----------
// Se valida aquí lo mismo que el núcleo (core/src/fidelizacion) para avisar antes de enviar; el núcleo valida de verdad.

export const TIPOS_BENEFICIO = [
  ["descuento_porcentaje", "Descuento en % sobre un ítem"],
  ["descuento_monto", "Descuento de un monto fijo sobre un ítem"],
  ["item_gratis", "Un plato gratis"],
];

const aNumero = (t) => (String(t ?? "").trim() === "" ? NaN : Number(String(t).trim().replace(",", ".")));
const dosDecimales = (n) => Math.abs(Math.round(n * 100) / 100 - n) < 1e-9;

/** El formulario de un beneficio → el cuerpo que se envía, o { ok: false, error }. */
export function parsearBeneficio(f) {
  const nombre = String(f.nombre ?? "").trim();
  if (!nombre || nombre.length > 80) return { ok: false, error: "El nombre debe tener entre 1 y 80 caracteres." };
  const descripcion = String(f.descripcion ?? "").trim();
  if (descripcion.length > 200) return { ok: false, error: "La descripción puede tener hasta 200 caracteres." };
  const puntos = aNumero(f.puntos);
  if (!Number.isInteger(puntos) || puntos < 1 || puntos > 1_000_000) return { ok: false, error: "Los puntos deben ser un número entero de 1 a 1.000.000." };
  const vigenciaDias = aNumero(f.vigenciaDias);
  if (!Number.isInteger(vigenciaDias) || vigenciaDias < 1 || vigenciaDias > 365) return { ok: false, error: "La vigencia del vale es de 1 a 365 días." };
  if (!TIPOS_BENEFICIO.some(([id]) => id === f.tipo)) return { ok: false, error: "Elige qué da el beneficio." };
  const cuerpo = { nombre, descripcion: descripcion || null, puntos, tipo: f.tipo, vigenciaDias };
  if (f.tipo === "item_gratis") {
    const codigo = String(f.itemCodigo ?? "").trim();
    if (!codigo || codigo.length > 60) return { ok: false, error: "Escribe el código del plato que se regala (el del catálogo)." };
    cuerpo.itemCodigo = codigo;
    cuerpo.valor = null;
  } else {
    const valor = aNumero(f.valor);
    if (!Number.isFinite(valor) || valor <= 0 || !dosDecimales(valor)) return { ok: false, error: "El valor debe ser mayor que 0, con 2 decimales como máximo." };
    if (f.tipo === "descuento_porcentaje" && valor > 100) return { ok: false, error: "Un porcentaje no puede pasar de 100." };
    cuerpo.valor = valor;
    cuerpo.itemCodigo = null;
  }
  return { ok: true, cuerpo };
}

/** Un beneficio del servidor → el texto del formulario. */
export function formularioDeBeneficio(b) {
  return {
    nombre: b?.nombre ?? "",
    descripcion: b?.descripcion ?? "",
    puntos: b?.puntos != null ? String(b.puntos) : "",
    tipo: b?.tipo ?? "descuento_porcentaje",
    valor: b?.valor != null ? String(b.valor) : "",
    itemCodigo: b?.itemCodigo ?? "",
    vigenciaDias: String(b?.vigenciaDias ?? 30),
  };
}

/** Niveles: una línea por nivel, «Nombre: puntos de entrada». Devuelve { ok, niveles } o { ok: false, error }. */
export function parsearNiveles(texto) {
  const lineas = String(texto ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lineas.length > 10) return { ok: false, error: "Hasta 10 niveles." };
  const niveles = [];
  for (const l of lineas) {
    const m = /^(.+?)\s*[:=]\s*(\d+)$/.exec(l);
    if (!m) return { ok: false, error: `«${l}» no es válido. Escribe «Nombre: puntos», por ejemplo «Plata: 500».` };
    const nombre = m[1].trim();
    if (nombre.length > 40) return { ok: false, error: "El nombre de un nivel puede tener hasta 40 caracteres." };
    niveles.push({ nombre, desde: Number(m[2]) });
  }
  for (let i = 1; i < niveles.length; i++)
    if (niveles[i].desde <= niveles[i - 1].desde) return { ok: false, error: "Los niveles deben ir de menos a más puntos, sin repetir." };
  return { ok: true, niveles };
}

export const textoNiveles = (niveles) => (Array.isArray(niveles) ? niveles.map((n) => `${n.nombre}: ${n.desde}`).join("\n") : "");

/** Puntos por unidad de moneda: mayor que 0 y hasta 1000. */
export function parsearPuntosPorUnidad(texto) {
  const n = aNumero(texto);
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return { ok: false };
  return { ok: true, valor: n };
}

// ---------- retos de colección (5.31) ----------

/**
 * El formulario de un reto → el cuerpo que se envía, o { ok: false, error }. El premio se valida como un beneficio
 * (mismas reglas), sin costo en puntos: lo gana el cliente solo al probar todo lo de la categoría.
 */
export function parsearReto(f) {
  const categoria = String(f.categoria ?? "").trim();
  if (!categoria || categoria.length > 60) return { ok: false, error: "Elige la categoría de la carta que el cliente debe probar completa." };
  const r = parsearBeneficio({ ...f, puntos: "1" });
  if (!r.ok) return r;
  const { puntos: _puntos, ...cuerpo } = r.cuerpo;
  return { ok: true, cuerpo: { ...cuerpo, categoria } };
}

/** Un reto del servidor → el texto del formulario. */
export function formularioDeReto(r) {
  const { puntos: _puntos, ...resto } = formularioDeBeneficio(r);
  return { ...resto, categoria: r?.categoria ?? "" };
}

// Marca de la empresa (5.33): logo, eslogan y tres colores que se ven en la carta pública. Aquí solo se
// valida el formato antes de enviar; qué combinaciones de color se aceptan (contraste, fondo ilegible)
// lo decide el núcleo y su mensaje se muestra tal cual.
export const MAX_ESLOGAN = 80;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#ABC", "abc" o "#aabbcc" → "#aabbcc"; null si no es un color. Vacío no es un color (se trata aparte). */
export function normalizarColorEntrada(texto) {
  const t = String(texto ?? "").trim();
  const conAlmohadilla = /^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(t) ? `#${t}` : t;
  if (!HEX.test(conAlmohadilla)) return null;
  const h = conAlmohadilla.slice(1).toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
}

export const CAMPOS_COLOR = [
  ["colorPrincipal", "Color principal", "Botones, puntos y barras de avance."],
  ["colorSecundario", "Color de acento", "Estrellas y detalles."],
  ["colorFondo", "Color de fondo", "Fondo de la carta. Si es oscuro, el texto se vuelve claro."],
];

/**
 * Del formulario (todo texto) al cuerpo de `PUT /auth/marca`. Cada campo vacío se envía como null (= quitar).
 * Devuelve { ok: true, cuerpo } o { ok: false, error }.
 */
export function parsearMarca(f) {
  const cuerpo = {};
  const logo = parsearImagen(f?.logo);
  if (!logo.ok) return { ok: false, error: "El logo debe ser una dirección que empiece con https://, sin espacios y de hasta 500 caracteres." };
  cuerpo.logo = logo.valor;
  const eslogan = String(f?.eslogan ?? "").trim().replace(/\s+/g, " ");
  if (eslogan.length > MAX_ESLOGAN) return { ok: false, error: `El eslogan puede tener hasta ${MAX_ESLOGAN} caracteres.` };
  cuerpo.eslogan = eslogan === "" ? null : eslogan;
  for (const [campo, etiqueta] of CAMPOS_COLOR) {
    const t = String(f?.[campo] ?? "").trim();
    if (t === "") {
      cuerpo[campo] = null;
      continue;
    }
    const c = normalizarColorEntrada(t);
    if (!c) return { ok: false, error: `${etiqueta}: escribe un color como #8b1e3f o déjalo vacío.` };
    cuerpo[campo] = c;
  }
  return { ok: true, cuerpo };
}

/** La marca guardada (de `GET /auth/marca`) → valores del formulario. */
export function formularioDeMarca(marca) {
  const m = marca ?? {};
  return {
    logo: m.logo ?? "",
    eslogan: m.eslogan ?? "",
    colorPrincipal: m.colorPrincipal ?? "",
    colorSecundario: m.colorSecundario ?? "",
    colorFondo: m.colorFondo ?? "",
  };
}

/** Las variables de color de una vista previa (solo #rrggbb, solo `--color-*`), listas para `style`. */
export function estiloDeVista(vista) {
  const c = vista?.colores;
  if (!c || typeof c !== "object") return {};
  return Object.fromEntries(Object.entries(c).filter(([k, v]) => /^--color-[a-z-]+$/.test(k) && /^#[0-9a-f]{6}$/i.test(String(v))));
}

// Datos de la empresa para sus comprobantes (5.34): razón social, RUC o identificación fiscal, dirección,
// teléfono y un pie de página. Aquí solo se valida el formato; el núcleo valida de verdad.
export const LIMITES_DATOS = { razonSocial: 80, idFiscal: 20, direccion: 120, telefono: 30, pie: 120 };

/** Del formulario (todo texto) al cuerpo de `PUT /auth/datos-empresa`; cada campo vacío se envía como null (= quitar). */
export function parsearDatos(f) {
  const cuerpo = {};
  for (const [campo, tope] of Object.entries(LIMITES_DATOS)) {
    const t = String(f?.[campo] ?? "").trim().replace(/\s+/g, " ");
    if (t === "") {
      cuerpo[campo] = null;
      continue;
    }
    if (t.length > tope) return { ok: false, error: `${ETIQUETA_DATO[campo]}: hasta ${tope} caracteres.` };
    if (campo === "idFiscal" && (t.length < 5 || !/^[A-Za-z0-9][A-Za-z0-9./-]*$/.test(t))) return { ok: false, error: "RUC o identificación fiscal: de 5 a 20 letras o números (también . - /), sin espacios." };
    if (campo === "telefono" && !/^[0-9+][0-9 ()+-]*$/.test(t)) return { ok: false, error: "Teléfono: solo números, espacios y + - ( )." };
    cuerpo[campo] = campo === "idFiscal" ? t.toUpperCase() : t;
  }
  return { ok: true, cuerpo };
}

const ETIQUETA_DATO = { razonSocial: "Razón social", idFiscal: "RUC o identificación fiscal", direccion: "Dirección", telefono: "Teléfono", pie: "Pie del recibo" };
export const CAMPOS_DATOS = [
  ["razonSocial", "Razón social", "El nombre legal de la empresa, si es distinto del nombre de la carta."],
  ["idFiscal", "RUC o identificación fiscal", "Se imprime tal cual. No se verifica con ninguna autoridad."],
  ["direccion", "Dirección", "La del local."],
  ["telefono", "Teléfono", "Para consultas sobre el recibo."],
  ["pie", "Pie del recibo", "Una línea al final, por ejemplo «Gracias por tu visita»."],
];

/** Los datos guardados (de `GET /auth/datos-empresa`) → valores del formulario. */
export function formularioDeDatos(datos) {
  const d = datos ?? {};
  return Object.fromEntries(Object.keys(LIMITES_DATOS).map((k) => [k, d[k] ?? ""]));
}

/** Las líneas del encabezado tal como salen en el recibo (misma regla que el recibo de tobt). */
export function lineasDeEncabezado(vista) {
  if (!vista) return [];
  const l = [];
  if (vista.razonSocial && vista.razonSocial.trim().toLowerCase() !== String(vista.nombre ?? "").trim().toLowerCase()) l.push(vista.razonSocial);
  if (vista.idFiscal) l.push(`${vista.etiquetaIdFiscal === "ID fiscal" ? "ID fiscal" : "RUC"}: ${vista.idFiscal}`);
  if (vista.direccion) l.push(vista.direccion);
  if (vista.telefono) l.push(`Tel: ${vista.telefono}`);
  return l;
}
