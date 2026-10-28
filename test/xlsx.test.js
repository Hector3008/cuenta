// Lector y escritor de .xlsx (5.64). Sin navegador: solo `fflate`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
// fflate vive en client/node_modules (dependencia del front, `npm --prefix client install`).
const { zipSync, strToU8 } = createRequire(new URL("../client/package.json", import.meta.url))("fflate");
import { ErrorXlsx, MAX_BYTES_ARCHIVO, crearXlsx, leerXlsx } from "../client/src/admin/xlsx.js";

test("lee un archivo hecho por otra herramienta (openpyxl): primera hoja, textos, números, huecos y entidades", () => {
  const { filas, truncado } = leerXlsx(new Uint8Array(readFileSync("test/fixtures/openpyxl.xlsx")));
  assert.equal(truncado, false);
  assert.deepEqual(filas[0], ["Código", "Producto", "Precio", "Teléfono"]);
  assert.deepEqual(filas[1], ["A-1", "Café & leche", "12.5", "987654321"]);
  assert.deepEqual(filas[2], []); // fila vacía en el medio: se conserva para que los números de fila coincidan con Excel
  assert.deepEqual(filas[3], ["A-2", "Té <verde>", "", "51987654322"]);
  assert.equal(filas[4][0], "TRUE");
  assert.equal(filas[4][4], "lejos"); // columna E con huecos antes
  assert.deepEqual(filas[5], ["Ñandú", "", "0.3", "51987654321"]); // 0.1+0.2 se deja legible
  assert.equal(filas.length, 6); // no lee la segunda hoja
});

test("escribir y volver a leer: texto con símbolos, ceros a la izquierda y números", () => {
  const bytes = crearXlsx([
    { nombre: "Clientes", filas: [["Nombre", "Teléfono", "Nota"], ["Ana & <Co>", "0987654321", 12.5], ["Beto", "", 'ñ "x"']], anchos: [20, 16, 10] },
    { nombre: "Instrucciones", filas: [["a"]] },
  ]);
  const { filas } = leerXlsx(bytes);
  assert.deepEqual(filas, [["Nombre", "Teléfono", "Nota"], ["Ana & <Co>", "0987654321", "12.5"], ["Beto", "", 'ñ "x"']]);
});

test("rechaza lo que no es un .xlsx", () => {
  assert.throws(() => leerXlsx(strToU8("a,b\n1,2")), (e) => e instanceof ErrorXlsx && /no es un archivo .xlsx/.test(e.message));
  assert.throws(() => leerXlsx(new Uint8Array([0x50, 0x4b, 1, 2, 3, 4])), ErrorXlsx);
  assert.throws(() => leerXlsx(zipSync({ "hola.txt": strToU8("x") })), (e) => e instanceof ErrorXlsx && /libro de Excel/.test(e.message));
  assert.throws(() => leerXlsx("texto"), ErrorXlsx);
  assert.throws(() => leerXlsx(new Uint8Array(MAX_BYTES_ARCHIVO + 1)), /5 MB/);
});

test("una bomba de compresión no se descomprime", () => {
  const enorme = strToU8("<worksheet>" + "a".repeat(30 * 1024 * 1024) + "</worksheet>");
  const zip = zipSync({ "xl/workbook.xml": strToU8("<workbook/>"), "xl/worksheets/sheet1.xml": enorme });
  assert.ok(zip.length < MAX_BYTES_ARCHIVO); // pesa poco comprimido…
  assert.throws(() => leerXlsx(zip), (e) => e instanceof ErrorXlsx && /demasiado grande/.test(e.message)); // …pero no se abre
});

test("solo lee las partes que necesita, aunque el zip traiga otras", () => {
  const zip = zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="H" sheetId="1" r:id="rId9"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId9" Type="x" Target="worksheets/hoja-rara.xml"/></Relationships>'),
    "xl/worksheets/hoja-rara.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ok</t></is></c></row></sheetData></worksheet>'),
    "xl/media/foto.png": new Uint8Array(1000),
  });
  assert.deepEqual(leerXlsx(zip).filas, [["ok"]]);
});

test("limita las filas leídas", () => {
  const filas = Array.from({ length: 5002 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}" t="inlineStr"><is><t>x</t></is></c></row>`).join("");
  const zip = zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="H" sheetId="1"/></sheets></workbook>'),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${filas}</sheetData></worksheet>`),
  });
  const r = leerXlsx(zip);
  assert.equal(r.truncado, true);
  assert.equal(r.filas.length, 5000);
});

test("crearXlsx pide al menos una hoja y limpia el nombre", () => {
  assert.throws(() => crearXlsx([]), ErrorXlsx);
  assert.doesNotThrow(() => crearXlsx([{ nombre: "a/b:c?*[x]", filas: [["x"]] }]));
});
