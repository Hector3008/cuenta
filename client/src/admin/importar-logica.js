// Lógica pura de «Importar desde Excel» (5.64): de las filas de la hoja a las filas que espera la API
// (`POST /catalogo/importar` y `POST /clientes/importar`), y de vuelta, los errores del servidor al número de fila de la hoja.
// Sin React ni navegador, para probarla con `node --test`. La validación que manda es la del servidor (todo o nada);
// aquí solo se convierten celdas y se avisa antes de enviar de lo evidente.
import { parsearDescripcion, parsearImagen, parsearPrecio, MAX_DESCRIPCION, MAX_IMAGEN } from "./formato.js";

export const MAX_FILAS_IMPORTACION = 500; // el mismo tope del núcleo (catalogo.importar y clientes.importar)
export const MAX_ERRORES_MOSTRADOS = 50;

/** «Código», «CÓDIGO », «codigo_producto» → «codigo producto». */
export const normalizarEncabezado = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Cada columna: `campo` (clave interna), `titulo` (el de la plantilla) y los nombres con que se acepta en la hoja.
export const TIPOS = {
  catalogo: {
    id: "catalogo",
    titulo: "Catálogo",
    ruta: "catalogo/importar",
    permiso: "catalogo:gestionar",
    archivoPlantilla: "plantilla-catalogo.xlsx",
    columnas: [
      { campo: "codigo", titulo: "Código", alias: ["codigo", "cod", "sku", "codigo producto", "codigo item"], requerida: true },
      { campo: "nombre", titulo: "Nombre", alias: ["nombre", "producto", "plato", "item", "articulo", "descripcion corta"] },
      { campo: "categoria", titulo: "Categoría", alias: ["categoria", "rubro", "familia", "linea"] },
      { campo: "precio", titulo: "Precio", alias: ["precio", "pvp", "precio venta", "price", "importe"] },
      { campo: "descripcion", titulo: "Descripción", alias: ["descripcion", "detalle", "descripcion larga"] },
      { campo: "imagen", titulo: "Foto (enlace https)", alias: ["foto", "imagen", "foto enlace https", "enlace foto", "url foto", "url imagen", "link foto"] },
    ],
    ejemplos: [
      ["CAF-001", "Café americano", "Bebidas calientes", 8.5, "Café filtrado de la casa.", ""],
      ["POS-014", "Torta de chocolate", "Postres", 14, "", ""],
    ],
    notas: [
      "Una fila por producto. El Código identifica al producto: si ya existe, se actualiza; si no, se crea.",
      "Código y Nombre son obligatorios para los productos nuevos. Para los que ya existen basta el Código y las columnas que quieras cambiar.",
      "Una celda vacía NO borra el dato que ya tiene el producto.",
      "Precio: un número, sin símbolo de moneda y con hasta 2 decimales (8.50 u 8,5).",
      "Foto: el enlace completo a la imagen, que empiece con https://.",
      "Hasta 500 filas por archivo. Si alguna fila tiene un problema, no se carga ninguna y se te dice cuál corregir.",
    ],
  },
  clientes: {
    id: "clientes",
    titulo: "Clientes",
    ruta: "clientes/importar",
    permiso: "cliente:gestionar",
    archivoPlantilla: "plantilla-clientes.xlsx",
    columnas: [
      { campo: "nombre", titulo: "Nombre", alias: ["nombre", "cliente", "nombre completo", "nombres"] },
      { campo: "telefono", titulo: "Teléfono", alias: ["telefono", "celular", "movil", "whatsapp", "cel", "tel"] },
      { campo: "correo", titulo: "Correo", alias: ["correo", "email", "e mail", "mail", "correo electronico"] },
      { campo: "direccion", titulo: "Dirección", alias: ["direccion", "domicilio"] },
      { campo: "documentoTipo", titulo: "Tipo de documento", alias: ["tipo de documento", "tipo documento", "tipo doc", "tipo de identificacion"] },
      { campo: "documentoNumero", titulo: "Documento", alias: ["documento", "numero de documento", "nro documento", "dni", "ruc", "identificacion", "numero documento"] },
      { campo: "instagram", titulo: "Instagram", alias: ["instagram", "ig"] },
      { campo: "tiktok", titulo: "TikTok", alias: ["tiktok", "tik tok"] },
      { campo: "facebook", titulo: "Facebook", alias: ["facebook", "fb"] },
      { campo: "x", titulo: "X", alias: ["x", "twitter"] },
    ],
    // Con teléfono o correo se reconoce a la persona en la próxima carga: al menos una de las dos columnas tiene que existir.
    unaDe: ["telefono", "correo"],
    ejemplos: [
      ["Ana Pérez", "987 654 321", "ana@correo.com", "Av. Los Olivos 123", "DNI", "12345678", "ana.perez", "", "", ""],
      ["Luis Rojas", "+51 999 111 222", "", "", "", "", "", "", "", ""],
    ],
    notas: [
      "Una fila por cliente. Se le reconoce por el Teléfono o el Correo: si ya existe, se actualiza; si no, se crea. Cada fila necesita al menos uno de los dos.",
      "El Nombre es obligatorio para los clientes nuevos.",
      "Teléfono: con o sin código de país. Sin código se usa el país de la empresa; con «+» se respeta el que escribas (+54…).",
      "Tipo de documento (DNI, RUC, CUIT…) y Documento van juntos.",
      "Redes: solo el usuario (ana.perez) o el enlace al perfil.",
      "Una celda vacía NO borra el dato que ya tiene el cliente.",
      "Importar no da ningún consentimiento (ni al programa de puntos ni a que se les etiquete en redes): eso se registra aparte, con la persona.",
      "Hasta 500 filas por archivo. Si alguna fila tiene un problema, no se carga ninguna y se te dice cuál corregir.",
    ],
  },
};

/** La hoja que se descarga como plantilla: encabezados, dos filas de ejemplo y una segunda hoja con las instrucciones. */
export function hojasPlantilla(tipo) {
  const t = TIPOS[tipo];
  return [
    { nombre: t.titulo, filas: [t.columnas.map((c) => c.titulo), ...t.ejemplos], anchos: t.columnas.map((c) => Math.max(14, c.titulo.length + 4)) },
    { nombre: "Instrucciones", filas: [["Cómo llenar la hoja «" + t.titulo + "»"], ...t.notas.map((n) => [n])], anchos: [110] },
  ];
}

/**
 * Ubica las columnas de la hoja. `filas` es la hoja leída (la primera fila son los encabezados).
 * Devuelve `{ columnas: { campo: índice }, ignoradas: [texto], errores: [texto] }`.
 */
export function ubicarColumnas(tipo, filas) {
  const t = TIPOS[tipo];
  const encabezados = filas[0] ?? [];
  const columnas = {};
  const ignoradas = [];
  const errores = [];
  encabezados.forEach((h, i) => {
    const norm = normalizarEncabezado(h);
    if (!norm) return;
    const col = t.columnas.find((c) => c.alias.includes(norm) || normalizarEncabezado(c.titulo) === norm);
    if (!col) return ignoradas.push(String(h).trim());
    if (col.campo in columnas) return ignoradas.push(`${String(h).trim()} (repetida)`);
    columnas[col.campo] = i;
  });
  for (const c of t.columnas) if (c.requerida && !(c.campo in columnas)) errores.push(`Falta la columna «${c.titulo}».`);
  if (t.unaDe && !t.unaDe.some((c) => c in columnas))
    errores.push(`Falta la columna «${t.columnas.find((c) => c.campo === t.unaDe[0]).titulo}» o la columna «${t.columnas.find((c) => c.campo === t.unaDe[1]).titulo}».`);
  if (!Object.keys(columnas).length && !errores.length) errores.push("No se reconoció ninguna columna. La primera fila debe tener los encabezados.");
  return { columnas, ignoradas, errores };
}

const celda = (fila, columnas, campo) => {
  const i = columnas[campo];
  return i === undefined ? "" : String(fila[i] ?? "").trim();
};

/**
 * Convierte la hoja en las filas para la API. Devuelve `{ filas, numeros, errores, vacias }`:
 * `numeros[i]` es el número de fila de la HOJA de `filas[i]` (para reportar los errores del servidor donde la persona los ve);
 * `errores` son los problemas evidentes de la propia hoja: `{ fila, error }`. Las filas totalmente vacías se saltan.
 */
export function construirFilas(tipo, filas, columnas) {
  const out = [];
  const numeros = [];
  const errores = [];
  let vacias = 0;
  const codigos = new Map(); // catálogo: el núcleo compara los códigos sin distinguir mayúsculas
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i] ?? [];
    if (!f.some((x) => String(x ?? "").trim() !== "")) {
      vacias++;
      continue;
    }
    const n = i + 1;
    const c = (campo) => celda(f, columnas, campo);
    const fila = {};
    try {
      if (tipo === "catalogo") {
        if (c("codigo")) fila.codigo = c("codigo");
        if (c("nombre")) fila.nombre = c("nombre");
        if (c("categoria")) fila.categoria = c("categoria");
        if (c("precio")) {
          const p = parsearPrecio(c("precio"));
          if (!p.ok) throw new Error("el precio debe ser un número de 0 en adelante con 2 decimales como máximo");
          fila.precio = p.valor;
        }
        const atributos = {};
        if (c("descripcion")) {
          const d = parsearDescripcion(c("descripcion"));
          if (!d.ok) throw new Error(`la descripción puede tener hasta ${MAX_DESCRIPCION} caracteres`);
          atributos.DESCRIPCION = d.valor;
        }
        if (c("imagen")) {
          const im = parsearImagen(c("imagen"));
          if (!im.ok) throw new Error(`la foto debe ser un enlace completo que empiece con https:// (hasta ${MAX_IMAGEN} caracteres)`);
          atributos.IMAGEN = im.valor;
        }
        if (Object.keys(atributos).length) fila.atributos = atributos;
        if (!fila.codigo) throw new Error("falta el código");
        const clave = fila.codigo.toLowerCase();
        if (codigos.has(clave)) throw new Error(`el código se repite (también en la fila ${codigos.get(clave)})`);
        codigos.set(clave, n);
      } else {
        for (const k of ["nombre", "telefono", "correo", "direccion"]) if (c(k)) fila[k] = c(k);
        const redes = {};
        for (const r of ["instagram", "tiktok", "facebook", "x"]) if (c(r)) redes[r] = c(r);
        if (Object.keys(redes).length) fila.redes = redes;
        if (c("documentoTipo") || c("documentoNumero")) fila.identificacion = { tipo: c("documentoTipo"), numero: c("documentoNumero") };
      }
      out.push(fila);
      numeros.push(n);
    } catch (e) {
      errores.push({ fila: n, error: e.message });
    }
  }
  return { filas: out, numeros, errores, vacias };
}

/** Errores del servidor (`detalle.errores[].fila` cuenta desde 1 sobre lo ENVIADO) → número de fila de la hoja. */
export function erroresDelServidor(datos, numeros) {
  const lista = Array.isArray(datos?.errores) ? datos.errores : [];
  return lista.map((e) => ({ fila: numeros[(e?.fila ?? 0) - 1] ?? null, error: String(e?.error ?? "fila inválida") }));
}

/** «Se crearán 3 y se actualizarán 2.» (con simulado) o «Se crearon 3 y se actualizaron 2.» */
export function resumenTexto(r, tipo) {
  const unidad = tipo === "catalogo" ? ["producto", "productos"] : ["cliente", "clientes"];
  const n = (x) => `${x} ${x === 1 ? unidad[0] : unidad[1]}`;
  const creados = r?.creados ?? 0;
  const actualizados = r?.actualizados ?? 0;
  if (r?.simulado) return `Se crearán ${n(creados)} nuevos y se actualizarán ${n(actualizados)}.`;
  return `Se ${creados === 1 ? "creó" : "crearon"} ${n(creados)} y se ${actualizados === 1 ? "actualizó" : "actualizaron"} ${n(actualizados)}.`;
}

/** Qué tipos puede importar la persona (según sus capacidades). */
export const tiposDisponibles = (cap) => Object.values(TIPOS).filter((t) => (t.id === "catalogo" ? cap.catalogo : cap.clientes));
