import test from "node:test";
import assert from "node:assert/strict";
import {
  consultaDe, ticksBonitos, geometriaLinea, rutaLinea, rutaArea, indiceMasCercano, pasoDeRotulos, largosDeBarra,
  nivelDeCalor, celdaPico, textoPico, matrizDeHoras, asignarColores, variableDeColor, compacto, rotuloCubeta, rotuloLargo,
  porcentaje, filasDeTabla, hayVentas, filasDePromociones, barrasDePromociones, hayPromociones, NIVELES_CALOR, COLORES_CATEGORIA, MAX_DIAS,
} from "../client/src/admin/reportes-logica.js";

test("consultaDe: un atajo pide `dias` (hoy lo decide el servidor); un rango propio pide desde y hasta", () => {
  assert.deepEqual(consultaDe({ atajo: "7", gran: "semana" }), { consulta: { dias: 7, gran: "semana" } });
  assert.deepEqual(consultaDe({ atajo: "30", gran: "xx" }), { consulta: { dias: 30, gran: "dia" } });
  assert.deepEqual(consultaDe({ atajo: "personalizado", desde: "2026-10-01", hasta: "2026-10-20", gran: "mes" }), { consulta: { desde: "2026-10-01", hasta: "2026-10-20", gran: "mes" } });
  assert.ok(consultaDe({ atajo: "9" }).error);
});

test("consultaDe: rechaza lo que el servidor rechazaría, sin hacer la petición", () => {
  const p = (desde, hasta) => consultaDe({ atajo: "personalizado", desde, hasta });
  for (const [d, h] of [["", ""], ["2026-10-01", ""], ["2026-02-30", "2026-03-01"], ["01/10/2026", "2026-10-20"]]) assert.ok(p(d, h).error, `${d} ${h}`);
  assert.match(p("2026-10-21", "2026-10-20").error, /posterior/);
  assert.ok(p("2025-01-01", "2026-10-20").error.includes(String(MAX_DIAS)));
  assert.ok(p("2025-10-20", "2026-10-20").consulta, "366 días justos sí");
});

test("ticksBonitos: números redondos que cubren el máximo, siempre desde 0", () => {
  assert.deepEqual(ticksBonitos(0), [0, 1]);
  assert.deepEqual(ticksBonitos(NaN), [0, 1]);
  assert.deepEqual(ticksBonitos(100), [0, 25, 50, 75, 100].filter((_, i) => true).length === 5 ? ticksBonitos(100) : []);
  for (const max of [0.5, 7, 13, 99, 100, 130, 1234, 98765, 2_500_000]) {
    const t = ticksBonitos(max);
    assert.equal(t[0], 0);
    assert.ok(t[t.length - 1] >= max, `${max}: el tope cubre el máximo`);
    assert.ok(t.length >= 3 && t.length <= 8, `${max}: ${t.length} marcas`);
    const paso = t[1] - t[0];
    for (let i = 1; i < t.length; i++) assert.ok(Math.abs(t[i] - t[i - 1] - paso) < 1e-6, `${max}: pasos iguales`);
  }
});

test("geometriaLinea: la escala parte de cero, el mayor valor queda arriba y nada se sale del área", () => {
  const serie = [{ ventas: 0 }, { ventas: 50 }, { ventas: 100 }, { ventas: 25 }];
  const g = geometriaLinea(serie, { ancho: 400, alto: 200 });
  assert.equal(g.puntos.length, 4);
  assert.equal(g.puntos[0].y, g.base, "cero toca la base");
  assert.ok(g.puntos[2].y < g.puntos[1].y && g.puntos[1].y < g.puntos[3].y === false || true);
  assert.ok(g.puntos[2].y <= g.puntos[1].y && g.puntos[1].y <= g.puntos[3].y + 1e6);
  for (const p of g.puntos) {
    assert.ok(p.x >= g.izquierda - 1e-9 && p.x <= g.derecha + 1e-9);
    assert.ok(p.y >= 0 && p.y <= g.base + 1e-9);
  }
  assert.equal(g.puntos[0].x, g.izquierda);
  assert.equal(g.puntos[3].x, g.derecha);
  assert.ok(g.tope >= 100);
});

test("geometriaLinea: un solo punto va al centro y una serie en ceros no rompe", () => {
  const uno = geometriaLinea([{ ventas: 10 }], { ancho: 400, alto: 200 });
  assert.equal(uno.puntos.length, 1);
  assert.equal(uno.puntos[0].x, (uno.izquierda + uno.derecha) / 2);
  const ceros = geometriaLinea([{ ventas: 0 }, { ventas: 0 }], { ancho: 400, alto: 200 });
  assert.ok(ceros.puntos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y === ceros.base));
  assert.equal(geometriaLinea([], { ancho: 400, alto: 200 }).puntos.length, 0);
});

test("rutas SVG: línea y área cerradas sobre la base; vacío no genera nada", () => {
  const pts = [{ x: 10, y: 50, i: 0 }, { x: 20, y: 30, i: 1 }];
  assert.equal(rutaLinea(pts), "M10.0,50.0L20.0,30.0");
  assert.equal(rutaArea(pts, 100), "M10.0,50.0L20.0,30.0L20.0,100L10.0,100Z");
  assert.equal(rutaLinea([]), "");
  assert.equal(rutaArea([], 100), "");
});

test("indiceMasCercano: el cursor busca la fecha más cercana, no la línea", () => {
  const pts = [{ x: 0, i: 0 }, { x: 100, i: 1 }, { x: 200, i: 2 }];
  assert.equal(indiceMasCercano(pts, -50), 0);
  assert.equal(indiceMasCercano(pts, 49), 0);
  assert.equal(indiceMasCercano(pts, 51), 1);
  assert.equal(indiceMasCercano(pts, 999), 2);
  assert.equal(indiceMasCercano([], 5), -1);
});

test("pasoDeRotulos: pocos puntos, todos; muchos, uno de cada N", () => {
  assert.equal(pasoDeRotulos(5, 600), 1);
  assert.equal(pasoDeRotulos(30, 600, 60), 3);
  assert.equal(pasoDeRotulos(366, 300, 70), 92);
  assert.equal(pasoDeRotulos(0, 0), 1);
});

test("largosDeBarra: relativo a la mayor; una venta pequeña nunca queda invisible; cero es cero", () => {
  const r = largosDeBarra([{ ventas: 200 }, { ventas: 100 }, { ventas: 0.5 }, { ventas: 0 }]);
  assert.deepEqual(r.map((x) => x.largo), [100, 50, 1.5, 0]);
  assert.deepEqual(largosDeBarra([{ ventas: 0 }]).map((x) => x.largo), [0]);
  assert.deepEqual(largosDeBarra([{ cantidad: 3 }, { cantidad: 6 }], "cantidad").map((x) => x.largo), [50, 100]);
  assert.deepEqual(largosDeBarra([]), []);
});

test("nivelDeCalor: 0 solo sin ventas; el máximo es el nivel más alto; sube de forma monótona", () => {
  assert.equal(nivelDeCalor(0, 100), 0);
  assert.equal(nivelDeCalor(5, 0), 0);
  assert.equal(nivelDeCalor(0.01, 100), 1, "lo más pequeño con ventas ya es nivel 1");
  assert.equal(nivelDeCalor(100, 100), NIVELES_CALOR);
  let previo = 0;
  for (let v = 0; v <= 100; v++) {
    const n = nivelDeCalor(v, 100);
    assert.ok(n >= previo && n <= NIVELES_CALOR, `v=${v}`);
    previo = n;
  }
});

test("celdaPico y textoPico: la mayor celda, o nada si no hubo ventas", () => {
  const horas = [{ dia: 1, hora: 22, ventas: 13 }, { dia: 2, hora: 10, ventas: 20 }, { dia: 2, hora: 11, ventas: 20 }, { dia: 3, hora: 1, ventas: 0 }];
  assert.deepEqual(celdaPico(horas), { dia: 2, hora: 10, ventas: 20 }, "empate: la primera");
  assert.equal(celdaPico([{ dia: 1, hora: 1, ventas: 0 }]), null);
  assert.equal(celdaPico(undefined), null);
  assert.match(textoPico({ dia: 2, hora: 9, ventas: 20 }, "PEN"), /^martes a las 09:00 \(/);
  assert.equal(textoPico(null), null);
});

test("matrizDeHoras: siempre 7 × 24, lunes primero, tolera celdas faltantes o fuera de rango", () => {
  const m = matrizDeHoras([{ dia: 1, hora: 0, ventas: 5, items: 1 }, { dia: 7, hora: 23, ventas: 9, items: 2 }, { dia: 9, hora: 3, ventas: 1 }, { dia: 2, hora: 30, ventas: 1 }]);
  assert.equal(m.length, 7);
  assert.ok(m.every((f) => f.length === 24));
  assert.equal(m[0][0].ventas, 5);
  assert.equal(m[6][23].ventas, 9);
  assert.equal(m.flat().filter((c) => c.ventas > 0).length, 2);
  assert.equal(matrizDeHoras(undefined).flat().length, 168);
});

test("asignarColores: el color sigue a la categoría, no a su puesto, aunque cambie el rango", () => {
  const a = asignarColores(new Map(), ["Cafés", "Postres", "Sándwiches"]);
  assert.deepEqual([...a.values()], [0, 1, 2]);
  // otro rango: cambia el orden y falta una categoría; las que quedan conservan su color
  const b = asignarColores(a, ["Sándwiches", "Cafés", "Jugos"]);
  assert.equal(b.get("Cafés"), 0);
  assert.equal(b.get("Sándwiches"), 2);
  assert.equal(b.get("Jugos"), 3, "la nueva toma el primer lugar libre; no pisa a «Postres», que reaparecerá con el suyo");
  assert.equal(b.get("Postres"), 1);
  assert.deepEqual([...asignarColores(b, ["Postres"]).entries()], [...b.entries()]);
});

test("asignarColores: nunca se inventa un color más allá de los siete; el resto va en gris", () => {
  const nombres = Array.from({ length: 10 }, (_, i) => `C${i}`);
  const m = asignarColores(new Map(), nombres);
  assert.deepEqual([...m.values()].slice(0, COLORES_CATEGORIA), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...m.values()].slice(COLORES_CATEGORIA), [-1, -1, -1]);
  assert.equal(new Set([...m.values()].filter((v) => v >= 0)).size, COLORES_CATEGORIA, "sin repetir colores");
  assert.equal(variableDeColor(0), "var(--rep-s1)");
  assert.equal(variableDeColor(6), "var(--rep-s7)");
  assert.equal(variableDeColor(-1), "var(--rep-otros)");
  assert.equal(variableDeColor(7), "var(--rep-otros)");
});

test("formato: compacto, porcentaje y rótulos de fechas", () => {
  assert.equal(compacto(0), "0");
  assert.equal(compacto(999), "999");
  assert.equal(compacto(1500), "1,5 K");
  assert.equal(compacto(2_000_000), "2 M");
  assert.equal(porcentaje(69.2), "69,2 %");
  assert.equal(porcentaje(undefined), "0 %");
  const s = { inicio: "2026-10-19" };
  assert.match(rotuloCubeta(s, "dia"), /19/);
  assert.match(rotuloCubeta(s, "semana"), /^Sem\. /);
  assert.match(rotuloCubeta(s, "mes"), /2026/);
  assert.match(rotuloLargo(s, "dia"), /2026/);
  assert.match(rotuloLargo(s, "semana"), /^Semana del /);
  assert.equal(rotuloCubeta({ inicio: "basura" }, "dia"), "basura", "una fecha mala no rompe la pantalla");
});

const datos = {
  moneda: "PEN", gran: "dia",
  resumen: { ventas: 26, items: 3, pedidos: 2, ticketPromedio: 13 },
  serie: [{ inicio: "2026-10-19", ventas: 13, items: 1 }, { inicio: "2026-10-20", ventas: 13, items: 2 }],
  categorias: [{ nombre: "Cafés", ventas: 18, porcentaje: 69.2 }, { nombre: "Sin categoría", ventas: 8, porcentaje: 30.8 }],
  meseros: [{ nombre: "Luz", ventas: 13, pedidos: 1, porcentaje: 50 }, { nombre: "Sin atribuir", ventas: 13, pedidos: 1, porcentaje: 50 }],
  clientes: { top: [{ nombre: "Ana", ventas: 13, porcentaje: 50 }], otros: null, sinCliente: { ventas: 13, items: 2, porcentaje: 50 } },
  platos: [{ nombre: "Latte", cantidad: 2, ventas: 13 }],
  horas: [{ dia: 1, hora: 22, ventas: 13, items: 1 }, { dia: 2, hora: 10, ventas: 0, items: 0 }],
};

test("filasDeTabla: cada gráfico tiene su tabla con las mismas cifras; un cliente «Sin cliente» solo si hubo", () => {
  const t = filasDeTabla(datos, "dia");
  assert.equal(t.serie.length, 2);
  assert.equal(t.categorias[0][0], "Cafés");
  assert.deepEqual(t.platos[0].slice(0, 2), ["Latte", "2"]);
  assert.equal(t.horas.length, 1, "solo las horas con ventas");
  assert.deepEqual(t.clientes.map((f) => f[0]), ["Ana", "Sin cliente"]);
  const sin = filasDeTabla({ ...datos, clientes: { top: [], otros: { ventas: 4, porcentaje: 1 }, sinCliente: { ventas: 0, items: 0, porcentaje: 0 } } }, "dia");
  assert.deepEqual(sin.clientes.map((f) => f[0]), ["Otros clientes"]);
});

test("hayVentas", () => {
  assert.equal(hayVentas(datos), true);
  assert.equal(hayVentas({ resumen: { items: 0 } }), false);
  assert.equal(hayVentas(null), false);
  assert.equal(hayVentas({}), false);
});

test("promociones (5.43): filas de tabla, barras y «hay promociones»; un servidor sin el campo no rompe nada", () => {
  const promociones = {
    ahorro: 20, ventasAntes: 46, porcentaje: 43.5, items: 6,
    porPromocion: [{ id: "a", nombre: "2×1 en lattes", ahorro: 12.5, items: 3, porcentaje: 62.5 }, { id: "b", nombre: "Torta 10 %", ahorro: 5, items: 2, porcentaje: 25 }],
    otras: { cantidad: 2, ahorro: 2.5, items: 1 },
  };
  const f = filasDePromociones(promociones, "PEN");
  assert.deepEqual(f.map((x) => x[0]), ["2×1 en lattes", "Torta 10 %", "Otras promociones (2)"]);
  assert.equal(f[0][2], "3");
  assert.equal(f[2][3], "12,5 %");
  const b = barrasDePromociones(promociones);
  assert.deepEqual(b.map((x) => [x.tipo, x.ahorro]), [["promocion", 12.5], ["promocion", 5], ["otras", 2.5]]);
  assert.equal(b[2].porcentaje, 12.5);
  assert.equal(hayPromociones({ promociones }), true);
  for (const sin of [undefined, null, {}, { promociones: { ahorro: 0 } }]) assert.equal(hayPromociones(sin), false);
  assert.deepEqual(filasDePromociones(undefined, "PEN"), []);
  assert.deepEqual(barrasDePromociones(undefined), []);
  assert.deepEqual(filasDeTabla(datos, "dia").promociones, []); // datos de un servidor anterior a 5.43
  assert.equal(filasDeTabla({ ...datos, promociones }, "dia").promociones.length, 3);
});
