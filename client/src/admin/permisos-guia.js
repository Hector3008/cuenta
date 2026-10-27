// Guía de permisos (5.56): qué es cada permiso y qué permite. Es información para quien arma roles; la seguridad
// no sale de aquí sino de `requierePermiso` y de las comprobaciones de cada operación en el servidor.
//
// Hay que mantenerla al día: si el servidor empieza a exigir un permiso nuevo, se agrega aquí (el test de esta guía
// revisa que todo permiso que usa este front esté explicado, y que los roles de ejemplo no traigan nada sin explicar).
import { permite } from "../destinos.js";

/** Cada grupo: { id, titulo, intro?, permisos: [{ id, titulo, descripcion, servicio?, nota?, reservado? }] }. */
export const GUIA = [
  {
    id: "equipo",
    titulo: "Equipo, roles y tablets",
    permisos: [
      {
        id: "usuario:gestionar",
        titulo: "Gestionar al equipo",
        descripcion:
          "Ver la lista de personas, darlas de alta, editar sus datos, cambiar su rol, desactivarlas y reactivarlas, restablecer su contraseña y crear o quitar su PIN. Nadie puede dar a otra persona un rol con más permisos de los que tiene, ni tocar a un administrador.",
      },
      {
        id: "rol:gestionar",
        titulo: "Gestionar roles",
        descripcion:
          "Crear, editar y eliminar roles (esta pantalla). Solo se pueden dar permisos que uno mismo tiene. Los roles con * (administrador) no se editan ni se borran.",
      },
      {
        id: "dispositivo:gestionar",
        titulo: "Tablets del local",
        descripcion: "Generar códigos para emparejar una tablet, ver los dispositivos emparejados y revocarlos. Sirve cuando la empresa usa el ingreso con PIN.",
      },
    ],
  },
  {
    id: "empresa",
    titulo: "Empresa",
    permisos: [
      { id: "empresa:datos", titulo: "Datos de los recibos", descripcion: "Editar la razón social, el RUC, la dirección, el teléfono y el pie de página que salen impresos en los recibos." },
      { id: "empresa:marca", titulo: "Marca de la carta", descripcion: "Editar el logo, el eslogan y los colores de la carta pública." },
      {
        id: "empresa:seguridad",
        titulo: "Seguridad del ingreso con PIN",
        descripcion: "Activar el ingreso con PIN en las tablets y ajustar el largo del PIN, los intentos permitidos, el bloqueo y el tiempo sin uso antes de cerrar la sesión.",
      },
    ],
  },
  {
    id: "catalogo",
    titulo: "Catálogo",
    permisos: [
      { id: "catalogo:leer", titulo: "Ver el catálogo", descripcion: "Ver los ítems, categorías y precios. También lo necesita quien toma pedidos para elegir de la carta." },
      { id: "catalogo:crear", titulo: "Agregar ítems", descripcion: "Dar de alta ítems nuevos en el catálogo." },
      { id: "catalogo:editar", titulo: "Editar ítems", descripcion: "Cambiar el nombre, el precio, la descripción y la foto de un ítem." },
      { id: "catalogo:gestionar", titulo: "Dar de baja e importar", descripcion: "Desactivar y reactivar ítems, e importar el catálogo de forma masiva." },
      { id: "catalogo:disponibilidad", titulo: "Marcar platos agotados", descripcion: "Marcar qué platos hoy no hay y quitar la marca cuando vuelven. Es lo que necesita cocina: no da acceso a precios ni a editar el catálogo.", servicio: "tobt" },
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes",
    permisos: [
      { id: "cliente:leer", titulo: "Ver clientes", descripcion: "Buscar clientes y ver su ficha y sus puntos. Hace falta para asociar un cliente a un pedido." },
      { id: "cliente:crear", titulo: "Registrar clientes", descripcion: "Dar de alta la ficha de un cliente nuevo." },
      { id: "cliente:editar", titulo: "Corregir la ficha", descripcion: "Corregir el nombre, el teléfono, el correo y los demás datos de un cliente." },
      {
        id: "cliente:cuenta",
        titulo: "Cuenta de acceso del cliente",
        descripcion: "Crear la cuenta con la que un cliente entra a la carta, o restablecer su contraseña (se le da una temporal que debe cambiar).",
      },
      {
        id: "cliente:gestionar",
        titulo: "Baja y datos personales",
        descripcion: "Desactivar y reactivar fichas, registrar o retirar el consentimiento al programa de puntos, y anonimizar a un cliente que pide cancelar sus datos.",
      },
    ],
  },
  {
    id: "fidelizacion",
    titulo: "Fidelización (puntos)",
    permisos: [
      {
        id: "fidelizacion:canjear",
        titulo: "Atender el programa de puntos",
        descripcion: "Ver cómo está configurado el programa, canjear puntos de un cliente, emitir sus vales y ver los retos. Para buscar al cliente también hace falta cliente:leer.",
      },
      {
        id: "fidelizacion:gestionar",
        titulo: "Configurar el programa de puntos",
        descripcion: "Definir las reglas, los niveles, los beneficios y los retos, y agregar o restar puntos a mano (con un motivo obligatorio).",
      },
    ],
  },
  {
    id: "promociones",
    titulo: "Promociones",
    permisos: [
      { id: "promocion:leer", titulo: "Ver promociones", descripcion: "Ver las promociones y probarlas con un pedido de ejemplo.", servicio: "tobt" },
      { id: "promocion:gestionar", titulo: "Gestionar promociones", descripcion: "Crear, editar, pausar y reactivar promociones. Conviene darlo junto con promocion:leer.", servicio: "tobt" },
    ],
  },
  {
    id: "anuncios",
    titulo: "Anuncios de la carta",
    permisos: [
      { id: "anuncio:leer", titulo: "Ver anuncios", descripcion: "Ver los eventos y la publicidad que salen en la carta.", servicio: "tobt" },
      { id: "anuncio:gestionar", titulo: "Gestionar anuncios", descripcion: "Crear, editar, pausar y reactivar eventos y publicidad. Conviene darlo junto con anuncio:leer.", servicio: "tobt" },
    ],
  },
  {
    id: "pedidos",
    titulo: "Pedidos",
    intro:
      "Cada acción sobre un pedido suma un permiso de esta lista y, a veces, uno de Estaciones. Por ejemplo: cobrar pide documento:editar y estacion:administracion.",
    permisos: [
      { id: "documento:leer", titulo: "Ver pedidos", descripcion: "Ver la lista y el detalle de los pedidos, los ítems en cocina y los recibos.", servicio: "tobt" },
      { id: "documento:crear", titulo: "Abrir pedidos", descripcion: "Abrir un pedido nuevo y pedir más ítems en uno abierto.", servicio: "tobt" },
      {
        id: "documento:editar",
        titulo: "Mover pedidos e ítems",
        descripcion:
          "Cambiar los datos de un pedido (mesa, referencia, cliente), entregar ítems y, junto con la estación que corresponda, marcarlos listos, cobrar, anular o cambiar un precio.",
        servicio: "tobt",
      },
    ],
  },
  {
    id: "estaciones",
    titulo: "Estaciones (puestos de trabajo)",
    intro:
      "Una estación identifica el puesto de la persona y decide quién puede dar ciertos pasos importantes. Se usan junto con los permisos de Pedidos.",
    permisos: [
      {
        id: "estacion:creacion",
        titulo: "Tomar pedidos",
        descripcion: "Anular un ítem mientras sigue en cocina (por ejemplo, un error al pedir).",
        servicio: "tobt",
      },
      { id: "estacion:cocina", titulo: "Cocina", descripcion: "Marcar los ítems como listos y ver la pantalla de Cocina.", servicio: "tobt" },
      {
        id: "estacion:administracion",
        titulo: "Caja y administración",
        descripcion:
          "Cobrar un pedido o ítems, anular un pedido, anular un ítem que ya salió de cocina, y poner o cambiar un precio propio. Es el permiso más delicado de los pedidos.",
        servicio: "tobt",
      },
      ...["carta", "delivery", "produccion", "bandeja", "revision"].map((e) => ({
        id: `estacion:${e}`,
        titulo: { carta: "Carta", delivery: "Delivery", produccion: "Producción", bandeja: "Bandeja", revision: "Revisión" }[e],
        descripcion: "Reservado: viene en algunos roles de ejemplo, pero hoy ninguna pantalla ni acción lo exige.",
        reservado: true,
      })),
    ],
  },
  {
    id: "reportes",
    titulo: "Reportes",
    permisos: [
      {
        id: "reporte:leer",
        titulo: "Ver reportes de ventas",
        descripcion: "Ver las ventas en el tiempo y por categoría, mesero y cliente, los platos más vendidos y las horas pico. Ningún rol de ejemplo lo trae: solo el administrador.",
        servicio: "tobt",
      },
    ],
  },
];

/** Cómo funcionan los comodines, para el encabezado de la guía. */
export const COMODINES = [
  { id: "*", texto: "Todo: acceso total a lo que ofrezcan los servicios de la empresa. Es el rol de administrador." },
  { id: "recurso:*", texto: "Todo lo de un recurso. Por ejemplo, documento:* incluye documento:leer, documento:crear y documento:editar." },
];

/** Roles de ejemplo que se crean con la empresa (la copia que viene con el servicio tobt). */
export const ROLES_DE_EJEMPLO = [
  { nombre: "mesero", permisos: ["estacion:creacion", "estacion:carta", "documento:crear", "documento:leer", "documento:editar", "catalogo:leer", "cliente:leer", "cliente:crear", "cliente:cuenta", "fidelizacion:canjear"] },
  { nombre: "cocina", permisos: ["estacion:cocina", "documento:leer", "documento:editar", "catalogo:disponibilidad"] },
  { nombre: "delivery", permisos: ["estacion:delivery", "documento:leer", "documento:editar", "cliente:leer"] },
];

const TODOS = GUIA.flatMap((g) => g.permisos.map((p) => ({ ...p, grupo: g.id })));
const POR_ID = new Map(TODOS.map((p) => [p.id, p]));

/** Todos los permisos explicados, en el orden de la guía. */
export const permisosDeLaGuia = () => TODOS;

/** La explicación de un permiso, o null si no está en la guía (por ejemplo, uno propio de otro servicio). */
export const explicacionDe = (id) => POR_ID.get(id) ?? null;

/** Texto breve para el `title` de un permiso: «Título: descripción», o el comodín explicado. */
export function ayudaDe(id) {
  if (id === "*") return "Todo: acceso total.";
  const p = POR_ID.get(id);
  if (p) return `${p.titulo}: ${p.descripcion}`;
  const m = /^([a-z][a-z0-9_]*):\*$/.exec(id);
  if (m) {
    const hijos = TODOS.filter((x) => x.id.startsWith(`${m[1]}:`));
    if (hijos.length) return `Todo lo de «${m[1]}»: ${hijos.map((x) => x.id).join(", ")}.`;
  }
  return "";
}

const sinTildes = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtra la guía por un texto (en el código, el título o la descripción, sin importar tildes ni mayúsculas). */
export function filtrarGuia(texto) {
  const q = sinTildes(texto).trim();
  if (!q) return GUIA;
  return GUIA.map((g) => ({
    ...g,
    permisos: g.permisos.filter((p) => sinTildes(`${p.id} ${p.titulo} ${p.descripcion}`).includes(q) || sinTildes(g.titulo).includes(q)),
  })).filter((g) => g.permisos.length > 0);
}

/** ¿El texto de permisos del formulario ya incluye este permiso (directo o por un comodín)? */
export function incluidoEn(permisosTexto, id) {
  const lista = String(permisosTexto ?? "").split(/[\s,]+/).filter(Boolean);
  return permite(lista, id);
}

/** Agrega un permiso al texto del formulario, sin repetirlo. */
export function agregarPermiso(permisosTexto, id) {
  const lista = String(permisosTexto ?? "").split(/[\s,]+/).filter(Boolean);
  if (lista.includes(id)) return lista.join(", ");
  return [...lista, id].join(", ");
}

/** Quita un permiso del texto del formulario (solo el permiso exacto, no los comodines que lo cubren). */
export function quitarPermiso(permisosTexto, id) {
  return String(permisosTexto ?? "").split(/[\s,]+/).filter((p) => p && p !== id).join(", ");
}
