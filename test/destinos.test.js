import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTINOS, permite, destinosAccesibles, resolverPaginaPrincipal,
  claveDeSesion, yaSeAbrio, marcarAbierta, olvidarMarcas,
} from "../client/src/destinos.js";

// Mismo formato que valida el núcleo (core/src/auth/preferencias.js): si cambia allí, falla aquí.
const ID_PAGINA = /^[a-z][a-z0-9_]{0,29}(\.[a-z][a-z0-9_]{0,29}){0,2}$/;

// Roles de la plantilla `tobt` del núcleo (core/src/modelos/plantillas.js).
const MESERO = ["estacion:creacion", "estacion:carta", "documento:crear", "documento:leer", "documento:editar", "catalogo:leer", "cliente:leer", "cliente:crear"];
const COCINA = ["estacion:cocina", "documento:leer", "documento:editar"];
const yoCon = (permisos, servicios = ["tobt"], extra = {}) => ({
  usuario: { id: "u1" }, empresaActivaId: "e1", permisos, servicios, paginaPrincipal: null, ...extra,
});

// ---------- permite: los mismos casos que core/test/permisos.test.js ----------
test("permite: comodín total, de recurso, exacto y sin permisos", () => {
  assert.equal(permite(["*"], "catalogo:editar"), true);
  assert.equal(permite(["documento:*"], "documento:crear"), true);
  assert.equal(permite(["documento:*"], "catalogo:leer"), false);
  assert.equal(permite(["documento:leer"], "documento:leer"), true);
  assert.equal(permite(["documento:leer"], "documento:crear"), false);
  assert.equal(permite([], "documento:leer"), false);
});

// ---------- el registro ----------
test("registro: ids únicos y con el formato que acepta el backend", () => {
  const ids = DESTINOS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, ID_PAGINA, id);
});

test("registro: lo disponible sabe a dónde ir; lo previsto no promete nada", () => {
  for (const d of DESTINOS) {
    assert.ok(d.titulo && d.descripcion, d.id);
    if (d.requiere) assert.match(d.requiere, /^[a-z][a-z0-9_]*:([a-z][a-z0-9_]*|\*)$/, d.id);
    if (d.disponible) {
      const abre = d.abre;
      assert.ok(abre && (Boolean(abre.pantalla) !== Boolean(abre.enlace)), `${d.id}: una pantalla o un enlace`);
      if (abre.enlace) assert.ok(!/^[a-z]+:/i.test(abre.enlace) && !abre.enlace.startsWith("//"), `${d.id}: ruta relativa, no una URL`);
    } else assert.equal(d.abre, null, d.id);
  }
});

test("registro: cuenta.perfil siempre está disponible y sin requisitos", () => {
  const perfil = DESTINOS.find((d) => d.id === "cuenta.perfil");
  assert.ok(perfil.disponible && perfil.requiere === null && perfil.servicio === null);
});

// ---------- qué ve cada perfil ----------
const catalogoDePrueba = [
  ...DESTINOS,
  { id: "tobt.pedidos", titulo: "Pedidos", descripcion: "x", requiere: "documento:leer", servicio: "tobt", disponible: true, abre: { enlace: "tobt/" } },
  { id: "tobt.cocina", titulo: "Cocina", descripcion: "x", requiere: "estacion:cocina", servicio: "tobt", disponible: true, abre: { enlace: "tobt/cocina/" } },
  { id: "empresa.equipo", titulo: "Equipo", descripcion: "x", requiere: "usuario:gestionar", servicio: null, disponible: true, abre: { enlace: "equipo/" } },
].filter((d, i, todos) => todos.findLastIndex((x) => x.id === d.id) === i); // las del final reemplazan a las previstas

const idsVisibles = (yo) => destinosAccesibles(yo, catalogoDePrueba).map((d) => d.id).sort();

test("accesibles: con el registro real, cada perfil ve lo suyo (Cuentas y Cocina ya existen)", () => {
  const ids = (yo) => destinosAccesibles(yo).map((d) => d.id).sort();
  assert.deepEqual(ids(yoCon(["*"])), ["cuenta.perfil", "empresa.anuncios", "empresa.catalogo", "empresa.datos", "empresa.equipo", "empresa.fidelizacion", "empresa.promociones", "empresa.reportes", "tobt.cocina", "tobt.pedidos"]);
  assert.deepEqual(ids(yoCon(MESERO)), ["cuenta.perfil", "empresa.catalogo", "empresa.datos", "tobt.pedidos"]);
  assert.deepEqual(ids(yoCon(COCINA)), ["cuenta.perfil", "empresa.datos", "tobt.cocina", "tobt.pedidos"]);
  assert.deepEqual(ids(yoCon(["*"], ["siscore"])), ["cuenta.perfil", "empresa.catalogo", "empresa.datos", "empresa.equipo", "empresa.fidelizacion"]); // sin el servicio, sin Pedidos
  assert.deepEqual(ids(yoCon([], [])), ["cuenta.perfil", "empresa.datos"]);
});

test("accesibles: admin ve todo lo de sus servicios; mesero y cocina, lo suyo", () => {
  assert.deepEqual(idsVisibles(yoCon(["*"])), ["cuenta.perfil", "empresa.anuncios", "empresa.catalogo", "empresa.datos", "empresa.equipo", "empresa.fidelizacion", "empresa.promociones", "empresa.reportes", "tobt.cocina", "tobt.pedidos"]);
  assert.deepEqual(idsVisibles(yoCon(MESERO)), ["cuenta.perfil", "empresa.catalogo", "empresa.datos", "tobt.pedidos"]);
  assert.deepEqual(idsVisibles(yoCon(COCINA)), ["cuenta.perfil", "empresa.datos", "tobt.cocina", "tobt.pedidos"]);
});

test("accesibles: sin el servicio contratado no hay acceso, ni siquiera con `*`", () => {
  assert.deepEqual(idsVisibles(yoCon(["*"], ["siscore"])), ["cuenta.perfil", "empresa.catalogo", "empresa.datos", "empresa.equipo", "empresa.fidelizacion"]);
  assert.deepEqual(idsVisibles(yoCon(["*"], [])), ["cuenta.perfil", "empresa.catalogo", "empresa.datos", "empresa.equipo", "empresa.fidelizacion"]);
});

test("accesibles: Reportes pide reporte:leer y el servicio contratado; el mesero no lo ve", () => {
  assert.ok(idsVisibles(yoCon(["reporte:leer"])).includes("empresa.reportes"));
  assert.ok(idsVisibles(yoCon(["reporte:*"])).includes("empresa.reportes"));
  assert.ok(!idsVisibles(yoCon(MESERO)).includes("empresa.reportes"));
  assert.ok(!idsVisibles(yoCon(COCINA)).includes("empresa.reportes"));
  assert.ok(!idsVisibles(yoCon(["*"], ["siscore"])).includes("empresa.reportes"), "sin el servicio que los calcula no hay reportes, ni con `*`");
  assert.ok(!idsVisibles(yoCon(["documento:*", "usuario:gestionar"])).includes("empresa.reportes"));
});

test("accesibles: un rol propio con permisos sueltos ve exactamente lo que esos permisos habilitan", () => {
  const encargado = yoCon(["usuario:gestionar", "documento:*"]);
  assert.deepEqual(idsVisibles(encargado), ["cuenta.perfil", "empresa.datos", "empresa.equipo", "tobt.pedidos"]);
});

test("accesibles: tolera una respuesta sin permisos ni servicios (fallo seguro)", () => {
  assert.deepEqual(destinosAccesibles({}, catalogoDePrueba).map((d) => d.id), ["cuenta.perfil", "empresa.datos"]);
  assert.deepEqual(destinosAccesibles(null, catalogoDePrueba).map((d) => d.id), ["cuenta.perfil", "empresa.datos"]);
});

test("accesibles: un destino previsto (no disponible) nunca se muestra", () => {
  assert.ok(!destinosAccesibles(yoCon(["*"])).some((d) => !d.disponible));
});

// ---------- paginaPrincipal ----------
test("resolver: devuelve el destino guardado si aplica en la empresa activa", () => {
  const d = resolverPaginaPrincipal(yoCon(MESERO, ["tobt"], { paginaPrincipal: "tobt.pedidos" }), catalogoDePrueba);
  assert.equal(d?.id, "tobt.pedidos");
  assert.equal(resolverPaginaPrincipal(yoCon(MESERO, ["tobt"], { paginaPrincipal: "cuenta.perfil" }))?.id, "cuenta.perfil");
});

test("resolver: cae a Inicio (null), sin error, si no aplica", () => {
  const con = (pp, permisos = MESERO, servicios = ["tobt"]) =>
    resolverPaginaPrincipal(yoCon(permisos, servicios, { paginaPrincipal: pp }), catalogoDePrueba);
  assert.equal(con(null), null); // sin elegir
  assert.equal(con(""), null);
  assert.equal(con("tobt.cocina"), null); // el mesero no tiene la estación
  assert.equal(con("tobt.pedidos", MESERO, ["siscore"]), null); // otra empresa sin ese servicio
  assert.equal(con("empresa.equipo"), null); // sin permiso
  assert.equal(con("destino.que.ya.no.existe"), null); // retirado del registro
  assert.equal(con("https://malo.com"), null); // una URL nunca es un destino
});

test("resolver: un destino previsto (aún sin pantalla) no se abre aunque esté guardado", () => {
  assert.equal(resolverPaginaPrincipal(yoCon(["*"], ["tobt"], { paginaPrincipal: "empresa.clientes" })), null);
});

// ---------- marcas de "ya se abrió" ----------
const almacenFalso = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
};
const almacenRoto = () => ({
  getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); },
  removeItem() { throw new Error("bloqueado"); }, key() { throw new Error("bloqueado"); },
  get length() { throw new Error("bloqueado"); },
});

test("marcas: la clave distingue persona y empresa; se abre una vez y se olvida al salir", () => {
  const a = almacenFalso();
  const k1 = claveDeSesion(yoCon([], [], { empresaActivaId: "e1" }));
  const k2 = claveDeSesion(yoCon([], [], { empresaActivaId: "e2" }));
  assert.notEqual(k1, k2);
  assert.equal(yaSeAbrio(k1, a), false);
  marcarAbierta(k1, a);
  assert.equal(yaSeAbrio(k1, a), true);
  assert.equal(yaSeAbrio(k2, a), false); // otra empresa se reevalúa
  a.setItem("otra.cosa", "1");
  olvidarMarcas(a);
  assert.equal(yaSeAbrio(k1, a), false);
  assert.equal(a.getItem("otra.cosa"), "1"); // solo borra las suyas
});

test("marcas: con el almacenamiento bloqueado actúa como 'ya se abrió' (nada de bucles) y no lanza", () => {
  const roto = almacenRoto();
  assert.equal(yaSeAbrio("x", roto), true);
  assert.doesNotThrow(() => marcarAbierta("x", roto));
  assert.doesNotThrow(() => olvidarMarcas(roto));
});
