// Registro único de destinos de Inicio (pieza 5.22) y la regla que decide cuáles ve cada persona.
// Es lógica pura (sin React ni navegador) para poder probarla con `node --test`.
//
// IMPORTANTE: mostrar u ocultar un acceso aquí NO es seguridad. La seguridad vive en el backend
// (`requierePermiso` y las comprobaciones de cada operación): un destino mostrado de más no abre nada.

/** Misma regla que `permite` del núcleo (core/src/permisos.js). Los tests fijan los mismos casos. */
export function permite(permisos, requerido) {
  const [recurso] = requerido.split(":");
  return permisos.some((p) => p === "*" || p === requerido || p === `${recurso}:*`);
}

/**
 * Cada destino:
 *  - id: el valor que se guarda en `Usuario.paginaPrincipal`. Nunca una URL. Formato validado por el
 *    núcleo: 1 a 3 segmentos en minúsculas, números y "_", separados por punto.
 *  - requiere: permiso (formato `recurso:accion`) o null si basta con haber entrado.
 *  - servicio: código del servicio que la empresa debe tener contratado y activo, o null.
 *  - disponible: solo los que ya tienen pantalla se muestran. Los demás documentan lo previsto.
 *  - abre: { pantalla } para una pantalla de `cuenta`, o { enlace } con una ruta relativa al gateway
 *    (por ejemplo "restaurante/"). null mientras no esté disponible.
 *
 * Agregar el front de un servicio nuevo = registrar (o activar) una línea aquí.
 */
export const DESTINOS = [
  {
    id: "cuenta.perfil",
    titulo: "Mi perfil",
    descripcion: "Tus datos, tu contraseña y el PIN de tablet.",
    requiere: null,
    servicio: null,
    disponible: true,
    abre: { pantalla: "perfil" },
  },
  {
    id: "empresa.equipo",
    titulo: "Equipo",
    descripcion: "Altas, bajas, roles y PIN del personal.",
    requiere: "usuario:gestionar",
    servicio: null,
    disponible: true,
    abre: { pantalla: "admin:equipo" },
  },
  {
    id: "empresa.catalogo",
    titulo: "Catálogo",
    descripcion: "Ítems, precios y categorías.",
    requiere: "catalogo:leer",
    servicio: null,
    disponible: true,
    abre: { pantalla: "admin:catalogo" },
  },
  {
    id: "empresa.datos",
    titulo: "Empresa",
    descripcion: "Datos de la empresa y sus roles.",
    requiere: null,
    servicio: null,
    disponible: true,
    abre: { pantalla: "admin:empresa" },
  },
  {
    id: "empresa.clientes",
    titulo: "Clientes",
    descripcion: "Fichas, búsqueda y consentimientos.",
    requiere: "cliente:leer",
    servicio: null,
    disponible: false,
    abre: null,
  },
  {
    id: "restaurante.pedidos",
    titulo: "Pedidos",
    descripcion: "Abrir pedidos, pedir ítems, entregar y cobrar.",
    requiere: "documento:leer",
    servicio: "restaurante",
    disponible: true,
    abre: { enlace: "restaurante/" },
  },
  {
    id: "restaurante.cocina",
    titulo: "Cocina",
    descripcion: "Ítems en preparación, uno por tarjeta.",
    requiere: "estacion:cocina",
    servicio: "restaurante",
    disponible: true,
    abre: { enlace: "restaurante/#cocina" },
  },
];

/** Los destinos que esta persona puede ver ahora: disponibles, con servicio contratado y con permiso. */
export function destinosAccesibles(yo, catalogo = DESTINOS) {
  const permisos = yo?.permisos ?? [];
  const servicios = yo?.servicios ?? [];
  return catalogo.filter(
    (d) =>
      d.disponible &&
      d.abre &&
      (!d.servicio || servicios.includes(d.servicio)) &&
      (!d.requiere || permite(permisos, d.requiere)),
  );
}

/**
 * El destino de `paginaPrincipal` si todavía aplica en la empresa activa; si no (otra empresa, rol
 * cambiado, destino retirado o sin elegir) devuelve null y se queda en Inicio, sin error.
 */
export function resolverPaginaPrincipal(yo, catalogo = DESTINOS) {
  if (!yo?.paginaPrincipal) return null;
  return destinosAccesibles(yo, catalogo).find((d) => d.id === yo.paginaPrincipal) ?? null;
}

// ---------- "ya se abrió la página principal en esta sesión del navegador" ----------
// Se abre una sola vez por persona y empresa y por pestaña: si no, Inicio sería inalcanzable.
// sessionStorage puede fallar (ventana privada, datos bloqueados): se envuelve en try/catch y,
// si falla, se actúa como si ya se hubiera abierto (mejor Inicio que un bucle de redirecciones).
const PREFIJO = "cuenta.pagina:";

export const claveDeSesion = (yo) => `${PREFIJO}${yo?.usuario?.id ?? ""}:${yo?.empresaActivaId ?? ""}`;

export function yaSeAbrio(clave, almacen = globalThis.sessionStorage) {
  try {
    return almacen.getItem(clave) === "1";
  } catch {
    return true;
  }
}

export function marcarAbierta(clave, almacen = globalThis.sessionStorage) {
  try {
    almacen.setItem(clave, "1");
  } catch {
    /* sin almacenamiento: yaSeAbrio() devolverá true y no habrá redirección */
  }
}

/** Al cerrar sesión se olvidan las marcas, para que la próxima entrada vuelva a abrir la página principal. */
export function olvidarMarcas(almacen = globalThis.sessionStorage) {
  try {
    const claves = [];
    for (let i = 0; i < almacen.length; i++) {
      const k = almacen.key(i);
      if (k?.startsWith(PREFIJO)) claves.push(k);
    }
    claves.forEach((k) => almacen.removeItem(k));
  } catch {
    /* nada que olvidar */
  }
}
