// Lector y escritor mínimos de .xlsx (5.64). Un .xlsx es un zip de XML: aquí solo se lee la PRIMERA hoja como
// texto (sin fórmulas ni estilos) y se escribe una hoja simple para la plantilla. Es lógica pura (sin React ni
// navegador, con `fflate` para el zip), probada con `node --test`.
//
// Se evita una librería de hojas de cálculo a propósito: el archivo lo sube una persona y se abre en su navegador, así
// que se limita lo que se descomprime (un .xlsx puede ser una bomba de compresión) y no se interpreta nada más que celdas.
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

export const MAX_BYTES_ARCHIVO = 5 * 1024 * 1024; // lo que se acepta subir
export const MAX_BYTES_DESCOMPRIMIDO = 25 * 1024 * 1024; // lo que se acepta descomprimir (todas las partes juntas)
export const MAX_FILAS_LEIDAS = 5000;
export const MAX_COLUMNAS = 60;

export class ErrorXlsx extends Error {}

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTIDADES[e.toLowerCase()];
  });

// Texto de un fragmento `<si>` o `<is>`: junta los `<t>` (ignorando los de la guía fonética `<rPh>`).
function textoDe(xml) {
  const sinFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of sinFonetica.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) out += decodificar(m[1] ?? "");
  return out;
}

function columnaIndice(ref) {
  const letras = /^([A-Z]+)/.exec(ref)?.[1];
  if (!letras) return -1;
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Un número guardado por Excel («5.1987654321E10», «12.500000000000002») se deja legible.
function numeroATexto(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return n.toLocaleString("fullwide", { useGrouping: false });
  return String(Number(n.toPrecision(15)));
}

/**
 * Lee la primera hoja de un .xlsx. Devuelve `{ filas: string[][], truncado }`; las celdas vacías son "".
 * Rechaza (ErrorXlsx) lo que no es un .xlsx válido o descomprime demasiado.
 */
export function leerXlsx(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new ErrorXlsx("Archivo inválido.");
  if (bytes.length > MAX_BYTES_ARCHIVO) throw new ErrorXlsx("El archivo pesa más de 5 MB.");
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new ErrorXlsx("Eso no es un archivo .xlsx (¿es un .xls antiguo o un .csv? Guárdalo como «Libro de Excel (.xlsx)»).");
  let total = 0;
  let partes;
  try {
    partes = unzipSync(bytes, {
      filter: (f) => {
        if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name)) return false;
        total += f.originalSize;
        if (total > MAX_BYTES_DESCOMPRIMIDO) throw new ErrorXlsx("El archivo es demasiado grande al abrirlo.");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ErrorXlsx) throw e;
    throw new ErrorXlsx("No se pudo abrir el archivo: está dañado o no es un .xlsx.");
  }
  const texto = (n) => (partes[n] ? strFromU8(partes[n]) : null);
  const libro = texto("xl/workbook.xml");
  if (!libro) throw new ErrorXlsx("No se pudo abrir el archivo: no parece un libro de Excel (.xlsx).");

  // Primera hoja del libro (no la primera del zip): su id → el archivo.
  const primera = /<sheet\b[^>]*>/.exec(libro)?.[0] ?? "";
  const rid = /\br:id="([^"]+)"/.exec(primera)?.[1];
  let ruta = null;
  const rels = texto("xl/_rels/workbook.xml.rels");
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (new RegExp(`\\bId="${rid}"`).test(m[0])) {
        const destino = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
        if (destino) ruta = destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`;
      }
    }
  }
  ruta ??= "xl/worksheets/sheet1.xml";
  const hoja = texto(ruta);
  if (hoja === null) throw new ErrorXlsx("No se encontró la hoja del libro.");

  const compartidas = [];
  const sst = texto("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) compartidas.push(textoDe(m[1] ?? ""));

  const filas = [];
  let truncado = false;
  for (const fila of hoja.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(/\br="(\d+)"/.exec(fila[1])?.[1] ?? filas.length + 1);
    if (!Number.isInteger(numero) || numero < 1) continue;
    if (numero > MAX_FILAS_LEIDAS) {
      truncado = true;
      break;
    }
    const celdas = [];
    for (const c of (fila[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c[1])?.[1];
      const col = ref ? columnaIndice(ref) : celdas.length;
      if (col < 0 || col >= MAX_COLUMNAS) continue;
      const tipo = /\bt="([^"]+)"/.exec(c[1])?.[1] ?? "n";
      const cuerpo = c[2] ?? "";
      let valor = "";
      if (tipo === "inlineStr") valor = textoDe(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(cuerpo)?.[1] ?? "");
      else {
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
        if (v !== undefined) {
          const t = decodificar(v);
          if (tipo === "s") valor = compartidas[Number(t)] ?? "";
          else if (tipo === "n") valor = numeroATexto(t.trim());
          else if (tipo === "b") valor = t.trim() === "1" ? "TRUE" : "FALSE";
          else valor = t; // str, e (error), d
        }
      }
      celdas[col] = valor;
    }
    while (filas.length < numero - 1) filas.push([]);
    filas[numero - 1] = Array.from(celdas, (x) => x ?? "");
  }
  return { filas, truncado };
}

// ---------- escritura ----------
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const letra = (i) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function xmlHoja({ filas, anchos = [] }) {
  const cols = anchos.length ? `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const datos = filas
    .map((f, r) => {
      const celdas = f
        .map((v, c) => {
          if (v === null || v === undefined || v === "") return "";
          const ref = `${letra(c)}${r + 1}`;
          const estilo = r === 0 ? ' s="1"' : "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
          return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${celdas}</row>`;
    })
    .join("");
  return `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${datos}</sheetData></worksheet>`;
}

/**
 * Arma un .xlsx de una o varias hojas: `[{ nombre, filas: (string|number)[][], anchos?: number[] }]`. La primera fila
 * de cada hoja va en negrita y fija. Los textos se guardan como texto (un teléfono «0987…» no pierde su cero).
 */
export function crearXlsx(hojas) {
  if (!Array.isArray(hojas) || !hojas.length) throw new ErrorXlsx("Falta al menos una hoja.");
  const nombres = hojas.map((h) => String(h.nombre).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const archivos = {
    "[Content_Types].xml": strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
  };
  hojas.forEach((h, i) => (archivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xmlHoja(h))));
  return zipSync(archivos);
}
