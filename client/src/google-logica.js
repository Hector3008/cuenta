// Entrar con Google en el login (5.69). Lógica pura (sin React ni navegador) para probarla con `node --test`.
// El servidor decide todo (verifica el token, busca al usuario, abre la sesión): aquí solo se valida lo que llega de
// `GET /auth/google/config` y se traducen los errores a un texto claro.

export const URL_SCRIPT_GOOGLE = "https://accounts.google.com/gsi/client";
const CLIENT_ID_GOOGLE = /^[A-Za-z0-9._-]{10,200}\.apps\.googleusercontent\.com$/;

/** El Client ID que anuncia el servidor (solo si el acceso con Google está activado), o null. Solo se acepta con la forma de un Client ID. */
export function clientIdGoogle(respuesta) {
  const id = respuesta?.clientId;
  return typeof id === "string" && CLIENT_ID_GOOGLE.test(id) ? id : null;
}

/**
 * Texto para la persona cuando falla «Entrar con Google». Recibe el error de la API (`status`, `codigo`, `message`).
 * El mensaje del servidor para «no hay cuenta» ya es claro y igual para todos los casos (sin cuenta, suspendida, sin
 * empresas), por eso se muestra tal cual; el resto se traduce.
 */
export function mensajeDeErrorGoogle(e) {
  if (!e || typeof e !== "object") return "Ocurrió un error inesperado.";
  if (e.status === 0) return e.message || "No se pudo conectar con el servidor.";
  if (e.codigo === "GOOGLE_SIN_CUENTA") return e.message || "No hay una cuenta activa con ese correo. Pide acceso a tu administrador.";
  if (e.codigo === "GOOGLE_INVALIDO") return "No se pudo comprobar tu cuenta de Google. Intenta de nuevo.";
  if (e.codigo === "GOOGLE_NO_DISPONIBLE" || e.status === 503) return "Entrar con Google no está disponible ahora. Usa tu correo y contraseña.";
  if (e.status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (e.status >= 500) return "El servidor tuvo un problema. Intenta de nuevo en un momento.";
  return "No se pudo entrar con Google.";
}
