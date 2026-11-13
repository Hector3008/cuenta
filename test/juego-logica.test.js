import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS_REGLAS, avisosDeCambio, cambiosParaGuardar, codigosAgatas, enlaceJuego, enlaceMesero, idDesde, normalizarRespuesta,
  nuevoColor, nuevoPremio, podar, problemas, quitarColor, renombrarColor, resumenPreguntas, sinPregunta,
} from "../client/src/admin/juego-logica.js";
import { capacidades, seccionesVisibles } from "../client/src/admin/permisos.js";
import { DESTINOS, destinosAccesibles } from "../client/src/destinos.js";

const respuesta = () => ({
  config: {
    personaje: { singular: "agata", plural: "agatas" },
    colores: [
      { id: "verde", nombre: "Verde", hex: "#5a8f2e" },
      { id: "cafe", nombre: "Café", hex: "#8b5a2b" },
      { id: "rojo", nombre: "Rojo", hex: "#d6402b" },
    ],
    agatasPorColor: 2,
    manoPorJugador: 2,
    requiereCuenta: false,
    premios: [{ id: "p2", umbral: 2, nombre: "Stickers", descripcion: "" }],
    preguntas: { "verde-1": "¿Uno?" },
    textos: { instrucciones: "", reglas: "" },
    reglas: { partidasPorIpHora: 30, intercambiosPorHora: 12, ofertaVenceSeg: 180, reservaVenceSeg: 900, cookieDias: 30 },
  },
  guardada: true,
  sinPregunta: [],
  advertencias: [{ codigo: "PREMIO_INALCANZABLE", mensaje: "aviso del servidor" }],
});
const base = () => normalizarRespuesta(respuesta()).config;

test("normalizarRespuesta da valores seguros con una respuesta vacía o rota", () => {
  const r = normalizarRespuesta(null);
  assert.deepEqual(r.config.colores, []);
  assert.equal(r.config.reglas.cookieDias, 1);
  assert.equal(r.guardada, false);
  assert.deepEqual(r.advertencias, []);
  assert.deepEqual(normalizarRespuesta(respuesta()).advertencias, ["aviso del servidor"]);
});

test("idDesde quita tildes y símbolos, evita repetidos y siempre es válido", () => {
  assert.equal(idDesde("Verde oliva"), "verde-oliva");
  assert.equal(idDesde("Café Ñandú!"), "cafe-nandu");
  assert.equal(idDesde("verde", ["verde"]), "verde-2");
  assert.equal(idDesde("verde", ["verde", "verde-2"]), "verde-3");
  assert.equal(idDesde("¡¡¡", [], "color"), "color");
  assert.match(idDesde("a".repeat(60)), /^[a-z0-9][a-z0-9_-]{0,23}$/);
});

test("códigos de agatas y preguntas que faltan", () => {
  const c = base();
  assert.deepEqual(codigosAgatas(c), ["verde-1", "verde-2", "cafe-1", "cafe-2", "rojo-1", "rojo-2"]);
  assert.deepEqual(sinPregunta(c), ["verde-2", "cafe-1", "cafe-2", "rojo-1", "rojo-2"]);
  assert.deepEqual(resumenPreguntas(c).map((x) => [x.color.id, x.faltan, x.total]), [["verde", 1, 2], ["cafe", 2, 2], ["rojo", 2, 2]]);
  c.preguntas["verde-2"] = "   ";
  assert.equal(sinPregunta(c).includes("verde-2"), true, "un texto en blanco no cuenta");
});

test("podar quita preguntas vacías y de agatas que ya no existen", () => {
  const c = base();
  c.preguntas = { "verde-1": " ¿Uno? ", "verde-9": "sobra", "azul-1": "sin color", "cafe-1": "" };
  assert.deepEqual(podar(c).preguntas, { "verde-1": "¿Uno?" });
  assert.equal(c.preguntas["verde-9"], "sobra", "no modifica la entrada");
});

test("cambiosParaGuardar manda solo lo que cambió y nada si no hay cambios", () => {
  const o = base();
  assert.deepEqual(cambiosParaGuardar(o, structuredClone(o)), {});
  const b = structuredClone(o);
  b.textos.reglas = "Una por persona";
  b.preguntas["cafe-1"] = "¿Dos?";
  assert.deepEqual(Object.keys(cambiosParaGuardar(o, b)).sort(), ["preguntas", "textos"]);
  assert.equal(cambiosParaGuardar(o, b).preguntas["cafe-1"], "¿Dos?");
  const c = structuredClone(o);
  c.agatasPorColor = 1;
  c.manoPorJugador = 1;
  assert.deepEqual(Object.keys(cambiosParaGuardar(o, c)).sort(), ["agatasPorColor", "manoPorJugador"], "las preguntas sobrantes se podan sin contar como cambio si ya no hay diferencia");
});

test("reducir las piezas por color poda sus preguntas y se manda el resto", () => {
  const o = base();
  o.preguntas["verde-2"] = "¿Dos?";
  const b = structuredClone(o);
  b.agatasPorColor = 1;
  b.manoPorJugador = 1;
  const cambios = cambiosParaGuardar(o, b);
  assert.equal(cambios.agatasPorColor, 1);
  assert.deepEqual(cambios.preguntas, { "verde-1": "¿Uno?" });
});

test("problemas: una configuración válida no tiene; cada error conocido se detecta", () => {
  assert.deepEqual(problemas(base()), []);
  const malo = (f) => { const c = base(); f(c); return problemas(c).map((p) => p.campo); };
  assert.ok(malo((c) => (c.personaje.singular = " ")).includes("personaje"));
  assert.ok(malo((c) => (c.colores = c.colores.slice(0, 1))).includes("colores"));
  assert.ok(malo((c) => (c.colores[0].nombre = "")).includes("colores"));
  assert.ok(malo((c) => (c.colores[0].hex = "verde")).includes("colores"));
  assert.ok(malo((c) => (c.colores[1].id = "verde")).includes("colores"), "id repetido");
  assert.ok(malo((c) => (c.manoPorJugador = 3)).includes("manoPorJugador"), "mano mayor que las piezas por color");
  assert.ok(malo((c) => (c.agatasPorColor = 0)).includes("agatasPorColor"));
  assert.ok(malo((c) => (c.premios[0].umbral = 4)).includes("premios"), "umbral mayor que la cantidad de colores");
  assert.ok(malo((c) => c.premios.push({ id: "p2b", umbral: 2, nombre: "X", descripcion: "" })).includes("premios"), "dos premios con el mismo umbral");
  assert.ok(malo((c) => (c.premios[0].nombre = "")).includes("premios"));
  assert.ok(malo((c) => (c.reglas.ofertaVenceSeg = 5)).includes("reglas"));
  assert.ok(malo((c) => (c.preguntas["verde-1"] = "x".repeat(201))).includes("preguntas"));
  assert.ok(malo((c) => (c.textos.reglas = "x".repeat(4001))).includes("textos"));
  assert.ok(malo((c) => (c.agatasPorColor = 2.5)).includes("agatasPorColor"));
});

test("los rangos de las reglas del front coinciden con los de agatas", async () => {
  // La copia de agatas vive en otro repo: aquí se fijan los valores que se acordaron en 5.80.
  const esperados = { partidasPorIpHora: [1, 1000], intercambiosPorHora: [1, 200], ofertaVenceSeg: [30, 3600], reservaVenceSeg: [60, 7200], cookieDias: [1, 365] };
  for (const [k, , , min, max] of CAMPOS_REGLAS) assert.deepEqual([min, max], esperados[k], k);
  assert.equal(CAMPOS_REGLAS.length, Object.keys(esperados).length);
});

test("nuevoColor y nuevoPremio dan valores válidos y no tocan la entrada", () => {
  const c = base();
  const c2 = nuevoColor(c);
  assert.equal(c.colores.length, 3);
  assert.equal(c2.colores.length, 4);
  assert.deepEqual(problemas(c2).filter((p) => p.campo === "colores"), []);
  const c3 = nuevoPremio(c);
  assert.equal(c3.premios.length, 2);
  assert.notEqual(c3.premios[1].umbral, 2, "no repite el umbral de otro premio");
  assert.equal(c3.premios[1].nombre, "", "obliga a ponerle nombre antes de guardar");
  assert.ok(problemas(c3).some((p) => p.campo === "premios"));
});

test("renombrarColor: un color guardado conserva su identificador; uno nuevo lo toma del nombre", () => {
  const c = base();
  const guardados = c.colores.map((x) => x.id);
  assert.equal(renombrarColor(c, 0, "Verde oliva", guardados).colores[0].id, "verde", "el guardado no cambia");
  const n = nuevoColor(c);
  const r = renombrarColor(n, 3, "Azul cielo", guardados);
  assert.equal(r.colores[3].id, "azul-cielo");
  assert.equal(renombrarColor(n, 3, "Verde", guardados).colores[3].id, "verde-2", "no choca con otro color");
});

test("quitarColor poda sus preguntas; avisosDeCambio advierte lo que afecta a partidas empezadas", () => {
  const o = base();
  o.preguntas["rojo-1"] = "¿Rojo?";
  const b = quitarColor(o, 2);
  assert.equal(b.colores.length, 2);
  assert.equal(b.preguntas["rojo-1"], undefined);
  assert.match(avisosDeCambio(o, b)[0], /Rojo/);
  const c = structuredClone(o);
  c.manoPorJugador = 1;
  assert.match(avisosDeCambio(o, c).join(" "), /partidas nuevas/);
  const d = structuredClone(o);
  d.agatasPorColor = 1;
  assert.match(avisosDeCambio(o, d).join(" "), /Reduces/);
  assert.deepEqual(avisosDeCambio(o, structuredClone(o)), []);
});

test("enlaceJuego y enlaceMesero arman las direcciones del juego", () => {
  const app = "https://ilnapo.com/agatas/app/?viejo=1#x";
  assert.equal(enlaceJuego(app, "Gecko"), "https://ilnapo.com/agatas/app/?e=gecko");
  assert.equal(enlaceJuego(app, " cafe-prueba "), "https://ilnapo.com/agatas/app/?e=cafe-prueba");
  assert.equal(enlaceJuego(app, ""), null);
  assert.equal(enlaceJuego(app, "con espacio"), null);
  assert.equal(enlaceJuego(app, "-x"), null);
  assert.equal(enlaceMesero(app), "https://ilnapo.com/agatas/app/?m=mesero");
});

test("permisos: la pestaña Juego pide juego:configurar y el servicio agatas", () => {
  assert.equal(capacidades(["juego:configurar"]).juego.ver, true);
  assert.equal(capacidades(["juego:validar", "juego:leer"]).juego.ver, false, "el mesero no configura");
  const ids = (p, s) => seccionesVisibles(p, s).map((x) => x.id);
  assert.ok(ids(["*"], ["agatas"]).includes("juego"));
  assert.ok(!ids(["*"], ["tobt"]).includes("juego"), "sin el servicio no se ofrece");
  assert.ok(!ids(["*"], []).includes("juego"));
  assert.ok(!ids(["juego:validar"], ["agatas"]).includes("juego"));
  assert.ok(ids(["juego:configurar"], undefined).includes("juego"), "sin lista de servicios no se oculta (como las demás)");
});

test("destinos: el administrador ve la pantalla del juego y el mesero solo el canje", () => {
  const yo = (permisos, servicios = ["agatas"]) => ({ permisos, servicios });
  const ver = (y) => destinosAccesibles(y).map((d) => d.id);
  assert.ok(ver(yo(["*"])).includes("empresa.juego") && ver(yo(["*"])).includes("juego.mesero"));
  assert.deepEqual(ver(yo(["juego:validar", "juego:leer"])).filter((i) => i.includes("juego")), ["juego.mesero"]);
  assert.deepEqual(ver(yo(["*"], ["tobt"])).filter((i) => i.includes("juego")), [], "sin agatas contratado no aparece");
  const mesero = DESTINOS.find((d) => d.id === "juego.mesero");
  assert.equal(mesero.abre.enlace, "agatas/app/?m=mesero");
  assert.equal(DESTINOS.find((d) => d.id === "empresa.juego").abre.pantalla, "admin:juego");
});

test("normalizarYo conserva el slug de la empresa", async () => {
  globalThis.document = { baseURI: "https://ilnapo.com/cuenta/" }; // api.js calcula su base al cargarse
  const { normalizarYo } = await import("../client/src/api.js");
  const yo = normalizarYo({ empresas: [{ id: "1", nombre: "Gecko", slug: "gecko", rol: { nombre: "admin" } }, { id: "2", nombre: "Otra" }] });
  assert.equal(yo.empresas[0].slug, "gecko");
  assert.equal(yo.empresas[1].slug, null);
});

// ───── Reinicio programado (5.83) ─────
test("reinicio: una respuesta sin el campo da «nunca» y una rota se corrige", async () => {
  const j = await import("../client/src/admin/juego-logica.js");
  assert.equal(base().reinicio.modo, "nunca");
  const r = respuesta();
  r.config.reinicio = { modo: "semanal", hora: "25:99", diaSemana: 9, zona: "" };
  const n = j.normalizarRespuesta(r).config.reinicio;
  assert.deepEqual(n, { modo: "semanal", hora: "00:00", diaSemana: 1, zona: "America/Lima" });
});

test("reinicio: validación de modo, hora, día y zona (solo cuando está activo)", async () => {
  const j = await import("../client/src/admin/juego-logica.js");
  const campos = (f) => {
    const c = base();
    f(c.reinicio);
    return j.problemas(c).map((p) => p.campo);
  };
  assert.deepEqual(campos(() => {}), []);
  assert.deepEqual(campos((r) => { r.modo = "diario"; r.hora = "00:00"; }), []);
  assert.ok(campos((r) => { r.modo = "diario"; r.hora = "7:5"; }).includes("reinicio"));
  assert.ok(campos((r) => { r.modo = "diario"; r.zona = "Marte/Olimpo"; }).includes("reinicio"));
  assert.ok(campos((r) => { r.modo = "semanal"; r.diaSemana = 7; }).includes("reinicio"));
  assert.ok(campos((r) => { r.modo = "cada-rato"; }).includes("reinicio"));
  assert.deepEqual(campos((r) => { r.modo = "nunca"; r.hora = "xx"; r.zona = "no"; }), []);
});

test("reinicio: el cambio se manda completo, avisa del efecto y tiene resumen", async () => {
  const j = await import("../client/src/admin/juego-logica.js");
  const o = base();
  const b = structuredClone(o);
  b.reinicio = { modo: "diario", hora: "00:00", diaSemana: 1, zona: "America/Lima" };
  assert.deepEqual(Object.keys(j.cambiosParaGuardar(o, b)), ["reinicio"]);
  assert.ok(j.avisosDeCambio(o, b).some((m) => /reinician de inmediato/.test(m)));
  assert.deepEqual(j.avisosDeCambio(o, o), []);
  assert.match(j.resumenReinicio(b.reinicio), /todos los días a las 00:00 \(America\/Lima\)/);
  assert.match(j.resumenReinicio({ ...b.reinicio, modo: "semanal", diaSemana: 0, hora: "06:30" }), /cada domingo a las 06:30/);
  assert.match(j.resumenReinicio(o.reinicio), /no se reinician solas/);
});

test("reinicio: el front acepta lo mismo que agatas (modos, valores por defecto)", async () => {
  const j = await import("../client/src/admin/juego-logica.js");
  const ruta = new URL("../../agatas/src/reinicio.js", import.meta.url);
  let s;
  try { s = await import(ruta.href); } catch { return; } // sin el repo hermano, no se compara
  assert.deepEqual(j.MODOS_REINICIO.map(([m]) => m), [...s.MODOS_REINICIO]);
  assert.deepEqual(j.REINICIO_POR_DEFECTO, { ...s.REINICIO_POR_DEFECTO });
});
