// Cliente HTTP mínimo del gateway. Toda la conversación con el backend pasa por aquí,
// y es el ÚNICO archivo que conoce la forma de las respuestas de /auth (ver `normalizarYo`).

// El front se sirve en `<base>/cuenta/`; la API vive en `<base>/`. Con "../" relativo al
// documento obtenemos `<base>/` sin saber cuál es el BASE_PATH del gateway.
// (En desarrollo, Vite sirve en "/" y el resultado es "/", que es lo correcto con el proxy.)
const BASE = new URL("../", document.baseURI).pathname;

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, datos) {
    super(mensaje || "Error inesperado");
    this.status = status;
    this.codigo = codigo;
    this.datos = datos;
  }
}

function extraerError(datos) {
  // El backend puede devolver { codigo, mensaje }, { error: "texto" } o { error: { codigo, mensaje } }.
  const e = datos?.error;
  return {
    codigo: datos?.codigo ?? (typeof e === "object" ? e?.codigo : null) ?? null,
    mensaje:
      datos?.mensaje ??
      (typeof e === "string" ? e : e?.mensaje) ??
      null,
  };
}

export async function pedir(metodo, ruta, cuerpo) {
  const cabeceras = { Accept: "application/json" };
  const opciones = { method: metodo, credentials: "same-origin", headers: cabeceras };
  // El backend exige esta cabecera en POST, PUT y DELETE (protección CSRF, 5.13).
  if (metodo !== "GET") cabeceras["x-requested-with"] = "cuenta";
  if (cuerpo !== undefined) {
    cabeceras["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  let r;
  try {
    r = await fetch(BASE + ruta, opciones);
  } catch {
    throw new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor.");
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const { codigo, mensaje } = extraerError(datos);
    throw new ErrorApi(r.status, codigo, mensaje, datos);
  }
  return datos;
}

/** Forma única que usa la interfaz, venga como venga la respuesta de /auth/yo. */
export function normalizarYo(d) {
  const yo = d?.yo ?? d ?? {};
  const empresas = (yo.empresas ?? yo.membresias ?? []).map((e) => ({
    id: e.empresaId ?? e.id ?? e._id,
    nombre: e.nombre ?? e.empresa?.nombre ?? e.slug ?? "Empresa",
    rol: e.rol?.nombre ?? e.rol ?? null,
  }));
  return {
    usuario: yo.usuario ?? { correo: yo.correo, nombre: yo.nombre },
    empresaActivaId: yo.empresaActivaId ?? yo.empresaId ?? null,
    empresas,
    permisos: yo.permisos ?? yo.rol?.permisos ?? [],
    // Códigos de los servicios contratados y activos de la empresa activa (5.22). Sin ellos, Inicio
    // no muestra accesos de servicios (fallo seguro).
    servicios: Array.isArray(yo.servicios) ? yo.servicios.filter((s) => typeof s === "string") : [],
    // Id de un destino de Inicio (destinos.js) o null. Nunca una URL.
    paginaPrincipal: typeof yo.paginaPrincipal === "string" && yo.paginaPrincipal ? yo.paginaPrincipal : null,
    debeCambiarPassword: Boolean(yo.debeCambiarPassword ?? yo.usuario?.debeCambiarPassword),
    // ¿Está habilitado el PIN en esta empresa? Si /auth/yo no lo informa, la sección de PIN no se muestra.
    pinHabilitado: Boolean(yo.pinHabilitado ?? yo.seguridad?.pin?.habilitado ?? yo.empresa?.seguridad?.pin?.habilitado),
    tienePin: Boolean(yo.tienePin ?? yo.pin?.definido),
  };
}

/** URL absoluta (de ruta) hacia otro servicio montado en el gateway, por ejemplo "tobt/". */
export const urlDeServicio = (ruta) => BASE + String(ruta).replace(/^\/+/, "");

export const api = {
  yo: async () => normalizarYo(await pedir("GET", "auth/yo")),
  login: (correo, password) => pedir("POST", "auth/login", { correo, password }),
  logout: () => pedir("POST", "auth/logout", {}),
  elegirEmpresa: (empresaId) => pedir("POST", "auth/empresa", { empresaId }),
  cambiarPassword: (passwordActual, passwordNueva) =>
    pedir("POST", "auth/password", { passwordActual, passwordNueva }),
  // PUT /auth/pin recibe { pin, password } (confirmado en core/src/auth/pin.js).
  cambiarPin: (pin, password) => pedir("PUT", "auth/pin", { pin, password }),
  // Guarda la página principal (id de destino) o la quita con null. Es una preferencia global de la persona.
  guardarPaginaPrincipal: (paginaPrincipal) => pedir("PUT", "auth/preferencias", { paginaPrincipal }),
};

/** Texto para mostrar al usuario. No distingue correo inexistente de contraseña errónea
 *  ni de usuario suspendido: el backend tampoco lo hace y el front no debe revelarlo. */
export function mensajeDeError(e) {
  if (!(e instanceof ErrorApi)) return "Ocurrió un error inesperado.";
  if (e.status === 0) return e.message;
  if (e.status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (e.status === 401) return "Correo o contraseña incorrectos.";
  if (e.status >= 500) return "El servidor tuvo un problema. Intenta de nuevo en un momento.";
  return e.message || "No se pudo completar la acción.";
}
