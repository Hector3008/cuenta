// Lógica de «Importar desde Excel» (5.64): de la hoja a las filas de la API, y de los errores del servidor a la fila de la hoja.
import test from "node:test";
import assert from "node:assert/strict";
import { leerXlsx, crearXlsx } from "../client/src/admin/xlsx.js";
import { TIPOS, construirFilas, erroresDelServidor, hojasPlantilla, normalizarEncabezado, resumenTexto, tiposDisponibles, ubicarColumnas } from "../client/src/admin/importar-logica.js";
import { capacidades } from "../client/src/admin/permisos.js";

test("encabezados: sin tildes, mayúsculas ni símbolos", () => {
  assert.equal(normalizarEncabezado(" Código_Producto "), "codigo producto");
  assert.equal(normalizarEncabezado("Foto (enlace https)"), "foto enlace https");
  assert.equal(normalizarEncabezado(null), "");
});

test("la plantilla de cada tipo se lee de vuelta con todas sus columnas y sin errores", () => {
  for (const tipo of Object.keys(TIPOS)) {
    const { filas } = leerXlsx(crearXlsx(hojasPlantilla(tipo)));
    const u = ubicarColumnas(tipo, filas);
    assert.deepEqual(u.errores, [], tipo);
    assert.deepEqual(u.ignoradas, [], tipo);
    assert.equal(Object.keys(u.columnas).length, TIPOS[tipo].columnas.length, tipo);
    const c = construirFilas(tipo, filas, u.columnas);
    assert.deepEqual(c.errores, [], tipo);
    assert.equal(c.filas.length, TIPOS[tipo].ejemplos.length, tipo);
  }
});

test("catálogo: alias, precio con coma, atributos y filas vacías", () => {
  const hoja = [
    ["SKU", "Producto", "Rubro", "PVP", "Detalle", "Foto", "Stock"],
    ["A-1", "Café", "Bebidas", "8,5", "Rico", "https://x.com/a.jpg", "10"],
    ["", "", "", "", "", "", ""],
    ["A-2", "", "", "", "", "", ""],
  ];
  const u = ubicarColumnas("catalogo", hoja);
  assert.deepEqual(u.ignoradas, ["Stock"]);
  const c = construirFilas("catalogo", hoja, u.columnas);
  assert.deepEqual(c.filas, [
    { codigo: "A-1", nombre: "Café", categoria: "Bebidas", precio: 8.5, atributos: { DESCRIPCION: "Rico", IMAGEN: "https://x.com/a.jpg" } },
    { codigo: "A-2" },
  ]);
  assert.deepEqual(c.numeros, [2, 4]); // los números son los de la hoja, no los del envío
  assert.equal(c.vacias, 1);
});

test("catálogo: problemas evidentes se reportan con su fila de la hoja", () => {
  const hoja = [["Código", "Precio", "Foto"], ["A", "gratis", ""], ["", "5", ""], ["B", "5", "http://inseguro.com/a.jpg"], ["C", "1.234", ""]];
  const c = construirFilas("catalogo", hoja, ubicarColumnas("catalogo", hoja).columnas);
  assert.deepEqual(c.errores.map((e) => e.fila), [2, 3, 4, 5]);
  assert.match(c.errores[0].error, /precio/);
  assert.match(c.errores[1].error, /código/);
  assert.match(c.errores[2].error, /https/);
  assert.equal(c.filas.length, 0);
});

test("catálogo: un código repetido (sin distinguir mayúsculas) se avisa en la hoja", () => {
  const hoja = [["Código", "Nombre"], ["A-1", "Uno"], ["a-1", "Otro"], ["B", "Tres"]];
  const c = construirFilas("catalogo", hoja, ubicarColumnas("catalogo", hoja).columnas);
  assert.deepEqual(c.errores, [{ fila: 3, error: "el código se repite (también en la fila 2)" }]);
});

test("catálogo: sin columna de código es un error, y el código numérico se conserva como texto", () => {
  assert.match(ubicarColumnas("catalogo", [["Nombre", "Precio"]]).errores[0], /Código/);
  const hoja = [["Código", "Nombre"], ["00123", "Té"]];
  assert.equal(construirFilas("catalogo", hoja, ubicarColumnas("catalogo", hoja).columnas).filas[0].codigo, "00123");
});

test("clientes: columnas, redes, documento y celdas vacías que no borran nada", () => {
  const hoja = [
    ["Cliente", "Celular", "E-mail", "Instagram", "TikTok", "Tipo de documento", "DNI", "Domicilio"],
    ["Ana", "987 654 321", "ana@x.com", "@ana", "", "DNI", "12345678", "Av. 1"],
    ["", "+51999111222", "", "", "", "", "", ""],
  ];
  const u = ubicarColumnas("clientes", hoja);
  assert.deepEqual(u.errores, []);
  const c = construirFilas("clientes", hoja, u.columnas);
  assert.deepEqual(c.filas, [
    { nombre: "Ana", telefono: "987 654 321", correo: "ana@x.com", direccion: "Av. 1", redes: { instagram: "@ana" }, identificacion: { tipo: "DNI", numero: "12345678" } },
    { telefono: "+51999111222" },
  ]);
});

test("clientes: hace falta la columna de teléfono o la de correo", () => {
  assert.match(ubicarColumnas("clientes", [["Nombre", "Dirección"]]).errores.join(" "), /Teléfono.*Correo/);
  assert.deepEqual(ubicarColumnas("clientes", [["Nombre", "Correo"]]).errores, []);
  assert.deepEqual(ubicarColumnas("clientes", [["Teléfono"]]).errores, []);
  assert.match(ubicarColumnas("clientes", [["foo", "bar"]]).errores.join(" "), /Teléfono/);
});

test("columnas repetidas se ignoran (gana la primera)", () => {
  const u = ubicarColumnas("catalogo", [["Código", "Nombre", "Producto"]]);
  assert.equal(u.columnas.nombre, 1);
  assert.deepEqual(u.ignoradas, ["Producto (repetida)"]);
});

test("errores del servidor: se traducen a la fila de la hoja", () => {
  const numeros = [2, 3, 7];
  assert.deepEqual(erroresDelServidor({ errores: [{ fila: 1, error: "a" }, { fila: 3, error: "b" }, { fila: 9, error: "c" }] }, numeros), [
    { fila: 2, error: "a" },
    { fila: 7, error: "b" },
    { fila: null, error: "c" },
  ]);
  assert.deepEqual(erroresDelServidor(null, numeros), []);
});

test("textos del resumen, con singular y plural", () => {
  assert.equal(resumenTexto({ creados: 1, actualizados: 2, simulado: true }, "catalogo"), "Se crearán 1 producto nuevos y se actualizarán 2 productos.");
  assert.equal(resumenTexto({ creados: 3, actualizados: 1 }, "clientes"), "Se crearon 3 clientes y se actualizó 1 cliente.");
});

test("quién ve qué: catalogo:gestionar → catálogo, cliente:gestionar → clientes", () => {
  const ids = (p) => tiposDisponibles(capacidades(p).importar).map((t) => t.id);
  assert.deepEqual(ids(["*"]), ["catalogo", "clientes"]);
  assert.deepEqual(ids(["catalogo:gestionar"]), ["catalogo"]);
  assert.deepEqual(ids(["cliente:gestionar"]), ["clientes"]);
  assert.deepEqual(ids(["cliente:crear", "catalogo:editar"]), []);
  assert.equal(capacidades(["catalogo:leer"]).importar.ver, false);
});
