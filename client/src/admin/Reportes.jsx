import { useEffect, useMemo, useRef, useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import {
  ATAJOS, ATAJO_POR_DEFECTO, GRANULARIDADES, DIAS_SEMANA, NIVELES_CALOR,
  consultaDe, rotuloCubeta, rotuloLargo, dinero, entero, compacto, porcentaje,
  geometriaLinea, rutaLinea, rutaArea, indiceMasCercano, pasoDeRotulos,
  largosDeBarra, nivelDeCalor, celdaPico, textoPico, rotuloHora, rotuloCelda, matrizDeHoras,
  asignarColores, variableDeColor, filasDeTabla, hayVentas, hayPromociones, barrasDePromociones,
} from "./reportes-logica.js";
import "./reportes.css";

// Reportes de ventas (5.35). Todo viene resumido del servidor (`GET tobt/reportes/ventas`): aquí solo se dibuja.
// Una venta es lo cobrado (ítems pagados); el mesero es quien cobró. Los gráficos son SVG o HTML propios, sin librerías.
// Cada gráfico tiene su vista de tabla (los tooltips ayudan, pero nunca son la única forma de leer un valor).

function useAncho(ref, inicial = 640) {
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setAncho(Math.max(260, Math.round(el.clientWidth) || inicial));
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, inicial]);
  return ancho;
}

// Un solo tooltip por gráfico. Los textos son datos (nombres de platos, clientes): se pintan como texto, nunca como HTML.
function useTip() {
  const caja = useRef(null);
  const [tip, setTip] = useState(null);
  const origen = () => caja.current?.getBoundingClientRect();
  const mostrar = (e, contenido) => {
    const r = origen();
    if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, ...contenido });
  };
  const mostrarEn = (el, contenido) => {
    const r = origen();
    const a = el?.getBoundingClientRect();
    if (r && a) setTip({ x: a.left - r.left + a.width / 2, y: a.top - r.top + a.height / 2, ...contenido });
  };
  const ocultar = () => setTip(null);
  const nodo = tip && (
    <div className={`rep-tip${tip.x > (caja.current?.clientWidth ?? 0) * 0.6 ? " rep-tip--izq" : ""}`} style={{ left: tip.x, top: tip.y }} role="status">
      <div className="rep-tip-titulo">{tip.titulo}</div>
      {tip.filas.map(([valor, etiqueta], i) => (
        <div className="rep-tip-fila" key={i}>
          <strong>{valor}</strong>
          <span>{etiqueta}</span>
        </div>
      ))}
    </div>
  );
  return { caja, mostrar, mostrarEn, ocultar, nodo };
}

function Tabla({ titulo, cabeceras, filas }) {
  return (
    <div className="adm-tabla-caja">
      <table className="adm-tabla">
        <caption className="rep-solo-lectores">{titulo}</caption>
        <thead>
          <tr>{cabeceras.map((c, i) => <th key={c} className={i > 0 ? "adm-num" : undefined} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>{f.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className="adm-num">{c}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tarjeta({ id, titulo, subtitulo, ancha = false, vacia, tabla, children, nota }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <section className={`rep-tarjeta${ancha ? " rep-tarjeta--ancha" : ""}`} aria-labelledby={`rep-${id}`}>
      <header className="rep-tarjeta-cab">
        <div>
          <h3 id={`rep-${id}`}>{titulo}</h3>
          {subtitulo && <p className="adm-nota">{subtitulo}</p>}
        </div>
        {!vacia && (
          <button type="button" className="adm-btn" aria-pressed={verTabla} onClick={() => setVerTabla((v) => !v)}>
            {verTabla ? "Ver gráfico" : "Ver tabla"}
          </button>
        )}
      </header>
      {vacia ? <p className="adm-vacio">{vacia}</p> : verTabla ? <Tabla titulo={titulo} {...tabla} /> : children}
      {nota && !vacia && <p className="adm-nota rep-nota">{nota}</p>}
    </section>
  );
}

// ---------- ventas en el tiempo ----------

function LineaTiempo({ serie, gran, moneda }) {
  const caja = useRef(null);
  const ancho = useAncho(caja);
  const alto = 240;
  const [activo, setActivo] = useState(null);
  const g = useMemo(() => geometriaLinea(serie, { ancho, alto }), [serie, ancho]);
  const paso = pasoDeRotulos(serie.length, ancho - g.izquierda, 70);
  const p = activo === null ? null : g.puntos[activo];
  const total = serie.reduce((n, s) => n + s.ventas, 0);

  const desdePuntero = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActivo(indiceMasCercano(g.puntos, ((e.clientX - r.left) / r.width) * ancho));
  };
  const teclas = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setActivo((i) => Math.min(serie.length - 1, Math.max(0, (i ?? serie.length - 1) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setActivo(null);
  };

  return (
    <div className="rep-caja" ref={caja}>
      <svg
        className="rep-svg" width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" tabIndex={0}
        aria-label={`Ventas por ${gran === "dia" ? "día" : gran}: ${dinero(total, moneda)} en total, ${serie.length} ${serie.length === 1 ? "punto" : "puntos"}. Usa las flechas para recorrerlos.`}
        onKeyDown={teclas} onFocus={() => setActivo((i) => i ?? serie.length - 1)} onBlur={() => setActivo(null)}
      >
        {g.ticks.map((t) => (
          <g key={t.valor}>
            <line className="rep-rejilla" x1={g.izquierda} x2={g.derecha} y1={t.y} y2={t.y} />
            <text className="rep-eje" x={g.izquierda - 8} y={t.y} textAnchor="end" dominantBaseline="middle">{compacto(t.valor)}</text>
          </g>
        ))}
        <line className="rep-base" x1={g.izquierda} x2={g.derecha} y1={g.base} y2={g.base} />
        {/* Rótulos contando desde el último punto: el más reciente siempre lleva el suyo y los demás no se pisan */}
        {serie.map((s, i) => ((serie.length - 1 - i) % paso === 0 ? (
          <text key={s.clave} className="rep-eje" x={g.puntos[i].x} y={g.base + 18} textAnchor="middle">{rotuloCubeta(s, gran)}</text>
        ) : null))}
        <path className="rep-area" d={rutaArea(g.puntos, g.base)} />
        <path className="rep-linea" d={rutaLinea(g.puntos)} />
        {p ? <line className="rep-mira" x1={p.x} x2={p.x} y1={12} y2={g.base} /> : null}
        {(() => {
          const q = p ?? g.puntos[g.puntos.length - 1];
          return q ? <circle className="rep-punto" cx={q.x} cy={q.y} r={4} /> : null;
        })()}
        <rect
          x={g.izquierda} y={0} width={Math.max(1, g.derecha - g.izquierda)} height={g.base} fill="transparent"
          onPointerMove={desdePuntero} onPointerDown={desdePuntero} onPointerLeave={() => setActivo(null)}
        />
      </svg>
      {p && (
        <div className={`rep-tip${p.x > ancho * 0.6 ? " rep-tip--izq" : ""}`} style={{ left: p.x, top: p.y }} role="status">
          <div className="rep-tip-titulo">{rotuloLargo(serie[activo], gran)}</div>
          <div className="rep-tip-fila"><strong>{dinero(serie[activo].ventas, moneda)}</strong><span>ventas</span></div>
          <div className="rep-tip-fila"><strong>{entero(serie[activo].items)}</strong><span>{serie[activo].items === 1 ? "ítem cobrado" : "ítems cobrados"}</span></div>
        </div>
      )}
    </div>
  );
}

// ---------- proporción por categoría (una barra apilada + leyenda con valores) ----------

function Proporcion({ filas, colores, moneda }) {
  const tip = useTip();
  const colorDe = (c) => variableDeColor(c.otros || c.sinCategoria ? -1 : colores.get(c.nombre) ?? -1);
  const contenido = (c) => ({ titulo: c.nombre, filas: [[dinero(c.ventas, moneda), "ventas"], [porcentaje(c.porcentaje), "del total"]] });
  return (
    <div className="rep-caja" ref={tip.caja}>
      <div className="rep-apilada" role="img" aria-label={`Ventas por categoría: ${filas.map((c) => `${c.nombre} ${porcentaje(c.porcentaje)}`).join(", ")}`}>
        {filas.map((c) => (
          <span
            key={c.nombre} className="rep-segmento" style={{ flexGrow: Math.max(c.ventas, 0.0001), background: colorDe(c) }}
            onPointerMove={(e) => tip.mostrar(e, contenido(c))} onPointerLeave={tip.ocultar}
          />
        ))}
      </div>
      <ul className="rep-leyenda">
        {filas.map((c) => (
          <li key={c.nombre} tabIndex={0} onFocus={(e) => tip.mostrarEn(e.currentTarget, contenido(c))} onBlur={tip.ocultar}>
            <i className="rep-llave" style={{ background: colorDe(c) }} aria-hidden="true" />
            <span className="rep-leyenda-nombre">{c.nombre}</span>
            <strong>{dinero(c.ventas, moneda)}</strong>
            <span className="rep-leyenda-pct">{porcentaje(c.porcentaje)}</span>
          </li>
        ))}
      </ul>
      {tip.nodo}
    </div>
  );
}

// ---------- barras horizontales (mesero, cliente, plato) ----------

function Barras({ filas, campo = "ventas", valor, detalle, apagada, etiqueta }) {
  const tip = useTip();
  const con = useMemo(() => largosDeBarra(filas, campo), [filas, campo]);
  return (
    <div className="rep-caja" ref={tip.caja}>
      <ul className="rep-barras">
        {con.map((f, i) => {
          const contenido = { titulo: etiqueta(f), filas: detalle(f) };
          return (
            <li
              key={`${i}-${etiqueta(f)}`} className="rep-barra-fila" tabIndex={0}
              onPointerMove={(e) => tip.mostrar(e, contenido)} onPointerLeave={tip.ocultar}
              onFocus={(e) => tip.mostrarEn(e.currentTarget, contenido)} onBlur={tip.ocultar}
            >
              <span className="rep-barra-nombre" title={etiqueta(f)}>{etiqueta(f)}</span>
              <span className="rep-barra-pista">
                <span className={`rep-barra${apagada?.(f) ? " rep-barra--apagada" : ""}`} style={{ width: `calc((100% - 15ch) * ${f.largo / 100})` }} />
                <span className="rep-barra-valor">{valor(f)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {tip.nodo}
    </div>
  );
}

// ---------- horas pico (mapa de calor 7 × 24, una sola tonalidad) ----------

function MapaCalor({ horas, moneda }) {
  const tip = useTip();
  const matriz = useMemo(() => matrizDeHoras(horas), [horas]);
  const max = useMemo(() => Math.max(0, ...horas.map((c) => c.ventas)), [horas]);
  return (
    <div className="rep-caja" ref={tip.caja}>
      <div className="rep-calor-desplaza">
        <div className="rep-calor" role="img" aria-label="Ventas por día de la semana y hora">
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="rep-calor-hora">{h % 3 === 0 ? rotuloHora(h).slice(0, 2) : ""}</span>)}
          {matriz.map((fila, d) => [
            <span key={`d${d}`} className="rep-calor-dia">{DIAS_SEMANA[d]}</span>,
            ...fila.map((c) => (
              <span
                key={`${d}-${c.hora}`} className="rep-celda" data-nivel={nivelDeCalor(c.ventas, max)}
                onPointerMove={(e) => tip.mostrar(e, { titulo: rotuloCelda(c), filas: [[dinero(c.ventas, moneda), "ventas"], [entero(c.items), c.items === 1 ? "ítem cobrado" : "ítems cobrados"]] })}
                onPointerLeave={tip.ocultar}
              />
            )),
          ])}
        </div>
      </div>
      <div className="rep-escala" aria-hidden="true">
        <span>Menos</span>
        {Array.from({ length: NIVELES_CALOR + 1 }, (_, n) => <i key={n} className="rep-celda rep-celda--escala" data-nivel={n} />)}
        <span>Más</span>
      </div>
      {tip.nodo}
    </div>
  );
}

// ---------- pantalla ----------

export default function Reportes() {
  const [atajo, setAtajo] = useState(ATAJO_POR_DEFECTO);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [gran, setGran] = useState("dia");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const pedido = useRef(0);
  const colores = useRef(new Map());

  const q = useMemo(() => consultaDe({ atajo, desde, hasta, gran }), [atajo, desde, hasta, gran]);

  useEffect(() => {
    if (q.error) {
      setError(q.error);
      setCargando(false);
      return;
    }
    const n = ++pedido.current;
    setCargando(true);
    setError("");
    api
      .get("tobt/reportes/ventas", q.consulta)
      .then((d) => {
        if (n !== pedido.current) return; // una respuesta vieja nunca pisa a una más nueva
        colores.current = asignarColores(colores.current, (d.categorias ?? []).filter((c) => !c.otros && !c.sinCategoria).map((c) => c.nombre));
        setDatos(d);
      })
      .catch((e) => {
        if (n === pedido.current) setError(mensajeAdmin(e));
      })
      .finally(() => {
        if (n === pedido.current) setCargando(false);
      });
  }, [q, recarga]);

  const elegirPersonalizado = () => {
    if (!desde && datos) {
      setDesde(datos.desde);
      setHasta(datos.hasta);
    }
    setAtajo("personalizado");
  };

  const moneda = datos?.moneda ?? null;
  const con = hayVentas(datos);
  const tablas = useMemo(() => (datos ? filasDeTabla(datos, datos.gran) : null), [datos]);
  const pico = datos ? celdaPico(datos.horas) : null;
  const sinVentas = "No hay ventas cobradas en este rango.";

  return (
    <div className="rep">
      <div className="adm-cabecera">
        <h2>Reportes de ventas</h2>
      </div>

      <div className="rep-filtros" role="group" aria-label="Rango y agrupación">
        <div className="rep-segmentado" role="group" aria-label="Rango">
          {ATAJOS.map((a) => (
            <button key={a.id} type="button" className="rep-seg" aria-pressed={atajo === a.id} onClick={() => setAtajo(a.id)}>{a.titulo}</button>
          ))}
          <button type="button" className="rep-seg" aria-pressed={atajo === "personalizado"} onClick={elegirPersonalizado}>Personalizado</button>
        </div>
        {atajo === "personalizado" && (
          <div className="rep-fechas">
            <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
        )}
        <label className="rep-gran">
          Agrupar por
          <select value={gran} onChange={(e) => setGran(e.target.value)}>
            {GRANULARIDADES.map((g) => <option key={g.id} value={g.id}>{g.titulo}</option>)}
          </select>
        </label>
      </div>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {error && !q.error && <button type="button" className="adm-btn" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>}

      {!datos && !error && <p className="adm-vacio" role="status">Cargando reportes…</p>}

      {datos && (
        <div className={cargando ? "rep-contenido rep-contenido--recarga" : "rep-contenido"} aria-busy={cargando}>
          <p className="adm-nota">
            {rotuloLargo({ inicio: datos.desde }, "dia")} – {rotuloLargo({ inicio: datos.hasta }, "dia")} · {entero(datos.dias)} {datos.dias === 1 ? "día" : "días"} · horario de {datos.zona}.
            Ventas = lo cobrado (sin anulados ni pedidos abiertos), con las promociones y los vales ya descontados y sin propinas.
          </p>

          <div className="rep-fichas">
            <div className="rep-ficha rep-ficha--heroe">
              <span className="rep-ficha-etiqueta">Ventas</span>
              <strong className="rep-heroe">{dinero(datos.resumen.ventas, moneda)}</strong>
            </div>
            <div className="rep-ficha">
              <span className="rep-ficha-etiqueta">Pedidos cobrados</span>
              <strong className="rep-ficha-valor">{entero(datos.resumen.pedidos)}</strong>
            </div>
            <div className="rep-ficha">
              <span className="rep-ficha-etiqueta">Ticket promedio</span>
              <strong className="rep-ficha-valor">{datos.resumen.ticketPromedio === null ? "—" : dinero(datos.resumen.ticketPromedio, moneda)}</strong>
            </div>
            {hayPromociones(datos) && (
              <div className="rep-ficha">
                <span className="rep-ficha-etiqueta">Descontado por promociones</span>
                <strong className="rep-ficha-valor">{dinero(datos.promociones.ahorro, moneda)}</strong>
                <small className="adm-nota">{porcentaje(datos.promociones.porcentaje)} de lo que habrían sido las ventas ({dinero(datos.promociones.ventasAntes, moneda)})</small>
              </div>
            )}
          </div>

          <div className="rep-rejilla-tarjetas">
            <Tarjeta
              id="tiempo" ancha titulo="Ventas en el tiempo" subtitulo={`Por ${GRANULARIDADES.find((g) => g.id === datos.gran)?.titulo.toLowerCase()}`}
              vacia={con ? null : sinVentas} tabla={{ cabeceras: ["Período", "Ventas", "Ítems"], filas: tablas.serie }}
            >
              <LineaTiempo serie={datos.serie} gran={datos.gran} moneda={moneda} />
            </Tarjeta>

            <Tarjeta
              id="categoria" titulo="Ventas por categoría" subtitulo="Proporción del total"
              vacia={con ? null : sinVentas} tabla={{ cabeceras: ["Categoría", "Ventas", "Del total"], filas: tablas.categorias }}
            >
              <Proporcion filas={datos.categorias} colores={colores.current} moneda={moneda} />
            </Tarjeta>

            <Tarjeta
              id="mesero" titulo="Ventas por mesero" subtitulo="Quien cobró"
              vacia={con ? null : sinVentas} tabla={{ cabeceras: ["Mesero", "Ventas", "Pedidos", "Del total"], filas: tablas.meseros }}
              nota="«Sin atribuir»: cobros que hizo el sistema, sin una persona."
            >
              <Barras
                filas={datos.meseros} etiqueta={(m) => m.nombre} valor={(m) => dinero(m.ventas, moneda)} apagada={(m) => m.sinAtribuir}
                detalle={(m) => [[dinero(m.ventas, moneda), "ventas"], [entero(m.pedidos), m.pedidos === 1 ? "pedido" : "pedidos"], [porcentaje(m.porcentaje), "del total"]]}
              />
            </Tarjeta>

            <Tarjeta
              id="cliente" titulo="Ventas por cliente" subtitulo={`Los ${datos.clientes.top.length} que más compraron`}
              vacia={con ? null : sinVentas} tabla={{ cabeceras: ["Cliente", "Ventas", "Del total"], filas: tablas.clientes }}
              nota="Lo que no tiene cliente asignado aparece como «Sin cliente»."
            >
              <Barras
                filas={[
                  ...datos.clientes.top.map((c) => ({ ...c, tipo: "cliente" })),
                  ...(datos.clientes.otros ? [{ nombre: "Otros clientes", ...datos.clientes.otros, tipo: "otros" }] : []),
                  ...(datos.clientes.sinCliente.ventas > 0 ? [{ nombre: "Sin cliente", ...datos.clientes.sinCliente, tipo: "sin" }] : []),
                ]}
                etiqueta={(c) => c.nombre} valor={(c) => dinero(c.ventas, moneda)} apagada={(c) => c.tipo !== "cliente"}
                detalle={(c) => [[dinero(c.ventas, moneda), "ventas"], [porcentaje(c.porcentaje), "del total"]]}
              />
            </Tarjeta>

            <Tarjeta
              id="platos" titulo="Platos más vendidos" subtitulo="Por unidades"
              vacia={con ? null : sinVentas} tabla={{ cabeceras: ["Plato", "Unidades", "Ventas"], filas: tablas.platos }}
            >
              <Barras
                filas={datos.platos} campo="cantidad" etiqueta={(p) => p.nombre} valor={(p) => `${entero(p.cantidad)} u.`}
                detalle={(p) => [[`${entero(p.cantidad)} u.`, "vendidas"], [dinero(p.ventas, moneda), "ventas"], ...(p.categoria ? [[p.categoria, "categoría"]] : [])]}
              />
            </Tarjeta>

            <Tarjeta
              id="promociones" titulo="Promociones" subtitulo="Cuánto se descontó con cada una"
              vacia={con ? (hayPromociones(datos) ? null : "No se aplicó ninguna promoción en este rango.") : sinVentas}
              tabla={{ cabeceras: ["Promoción", "Descontado", "Ítems", "Del descuento"], filas: tablas.promociones }}
              nota="Las ventas de arriba ya tienen estos descuentos restados. «Ítems» cuenta los ítems cobrados a los que se les aplicó."
            >
              <Barras
                filas={barrasDePromociones(datos.promociones)} campo="ahorro" etiqueta={(x) => x.nombre} valor={(x) => dinero(x.ahorro, moneda)} apagada={(x) => x.tipo === "otras"}
                detalle={(x) => [[dinero(x.ahorro, moneda), "descontado"], [entero(x.items), x.items === 1 ? "ítem" : "ítems"], [porcentaje(x.porcentaje), "del descuento total"]]}
              />
            </Tarjeta>

            <Tarjeta
              id="horas" ancha titulo="Horas pico" subtitulo={pico ? `Lo más fuerte: ${textoPico(pico, moneda)}` : "Ventas por día de la semana y hora"}
              vacia={con ? null : sinVentas} tabla={{ cabeceras: ["Día y hora", "Ventas", "Ítems"], filas: tablas.horas }}
            >
              <MapaCalor horas={datos.horas} moneda={moneda} />
            </Tarjeta>
          </div>
        </div>
      )}
    </div>
  );
}
