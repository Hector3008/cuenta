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
