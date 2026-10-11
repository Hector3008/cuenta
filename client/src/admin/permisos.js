// Qué puede hacer la persona en cada sección del módulo admin. Usa la misma `permite` del registro
// de destinos (una sola copia en el front de la regla del núcleo, 5.22).
// Mostrar u ocultar botones con esto NO es seguridad: la seguridad sigue en `requierePermiso` y en
// las comprobaciones de cada operación del núcleo.
import { permite } from "../destinos.js";

export { permite };

export function capacidades(permisos) {
  const lista = Array.isArray(permisos) ? permisos : [];
  const p = (x) => permite(lista, x);
  return {
    equipo: {
      ver: p("usuario:gestionar"),
      crear: p("usuario:gestionar"),
      editar: p("usuario:gestionar"),
      baja: p("usuario:gestionar"),
    },
    roles: {
      ver: p("rol:gestionar") || p("usuario:gestionar"),
      gestionar: p("rol:gestionar"),
    },
    catalogo: {
      ver: p("catalogo:leer"),
      crear: p("catalogo:crear"),
      editar: p("catalogo:editar"),
      baja: p("catalogo:gestionar"),
    },
    empresa: { ver: true }, // los datos básicos vienen en /auth/yo
  };
}

// Pestañas que se ofrecen: solo las que la persona puede al menos ver.
export function seccionesVisibles(permisos) {
  const c = capacidades(permisos);
  return [
    { id: "equipo", titulo: "Equipo", visible: c.equipo.ver },
    { id: "catalogo", titulo: "Catálogo", visible: c.catalogo.ver },
    { id: "empresa", titulo: "Empresa", visible: c.empresa.ver },
  ].filter((s) => s.visible);
}

// La empresa activa tal como la entrega normalizarYo: { id, nombre, rol }.
export function empresaActiva(yo) {
  return (yo?.empresas ?? []).find((e) => e.id === yo?.empresaActivaId) ?? null;
}
