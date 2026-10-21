// Qué puede hacer la persona en cada sección del módulo admin. Usa la misma `permite` del registro
// de destinos (una sola copia en el front de la regla del núcleo, 5.22).
// Mostrar u ocultar botones con esto NO es seguridad: la seguridad sigue en `requierePermiso` y en
// las comprobaciones de cada operación del núcleo.
import { permite } from "../destinos.js";
import { SERVICIO_REPORTES } from "./reportes-logica.js";

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
    fidelizacion: {
      ver: p("fidelizacion:canjear") || p("fidelizacion:gestionar"),
      gestionar: p("fidelizacion:gestionar"),
    },
    empresa: { ver: true }, // los datos básicos vienen en /auth/yo
    marca: { gestionar: p("empresa:marca") }, // logo, eslogan y colores de la carta pública (5.33)
    datos: { gestionar: p("empresa:datos") }, // datos que salen en los recibos (5.34)
    reportes: { ver: p("reporte:leer") }, // reportes de ventas (5.35); los calcula el servicio, no el navegador
  };
}

// Pestañas que se ofrecen: solo las que la persona puede al menos ver. `servicios` (los códigos contratados por la
// empresa activa, de /auth/yo) es opcional: si llega, Reportes solo se ofrece cuando la empresa tiene el servicio que
// los calcula (sin él la ruta no existe). Mostrar u ocultar no es seguridad: manda `reporte:leer` en el servidor.
export function seccionesVisibles(permisos, servicios) {
  const c = capacidades(permisos);
  const tieneServicio = (codigo) => !Array.isArray(servicios) || servicios.includes(codigo);
  return [
    { id: "equipo", titulo: "Equipo", visible: c.equipo.ver },
    { id: "catalogo", titulo: "Catálogo", visible: c.catalogo.ver },
    { id: "fidelizacion", titulo: "Fidelización", visible: c.fidelizacion.ver },
    { id: "reportes", titulo: "Reportes", visible: c.reportes.ver && tieneServicio(SERVICIO_REPORTES) },
    { id: "empresa", titulo: "Empresa", visible: c.empresa.ver },
  ].filter((s) => s.visible);
}

// La empresa activa tal como la entrega normalizarYo: { id, nombre, rol }.
export function empresaActiva(yo) {
  return (yo?.empresas ?? []).find((e) => e.id === yo?.empresaActivaId) ?? null;
}
