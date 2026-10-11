// Cliente del módulo admin (Equipo, Catálogo, Empresa). Se apoya en `pedir` de api.js, que ya
// pone la ruta base, `x-requested-with` y el manejo de errores (ErrorApi): aquí solo se agregan
// los parámetros de consulta, el tratamiento de las listas y el texto de error para estas pantallas.
import { ErrorApi, pedir } from "../api.js";

export function conConsulta(ruta, consulta) {
  const limpia = String(ruta).replace(/^\/+/, "");
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(consulta || {})) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `${limpia}?${q}` : limpia;
}

// Las respuestas de lista pueden venir como arreglo o como { clave: [...] }.
export function comoLista(datos) {
  if (Array.isArray(datos)) return datos;
  if (datos && typeof datos === "object") {
    for (const v of Object.values(datos)) if (Array.isArray(v)) return v;
  }
  return [];
}

// Texto para estas pantallas. A diferencia de `mensajeDeError` (pensado para el login), un 401
// aquí significa "la sesión caducó", no "contraseña incorrecta"; el resto usa el mensaje del núcleo.
export function mensajeAdmin(e) {
  if (!(e instanceof ErrorApi)) return "Ocurrió un error inesperado.";
  if (e.status === 0) return e.message;
  if (e.status === 401) return "La sesión caducó. Vuelve a entrar.";
  if (e.status === 429) return "Demasiados intentos. Espera unos minutos.";
  if (e.status === 403 && !e.message) return "No tienes permiso para esto.";
  if (e.status >= 500) return "El servidor tuvo un problema. Intenta de nuevo.";
  return e.message || "No se pudo completar la acción.";
}

export const api = {
  get: (ruta, consulta) => pedir("GET", conConsulta(ruta, consulta)),
  post: (ruta, cuerpo) => pedir("POST", ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => pedir("PUT", ruta, cuerpo ?? {}),
  del: (ruta) => pedir("DELETE", ruta),
};
