import { useEffect, useMemo, useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import BotonExcel from "./BotonExcel.jsx";
import { ATAJOS, ATAJO_POR_DEFECTO, consultaDe } from "./reportes-logica.js";
import {
  avisoSinCosto, consultaDeInventario, normalizarReporteInventario, textoCantidad, textoCoberturaDeCosto, textoDinero, textoMargenPct,
} from "./inventario-logica.js";

// Vista «Reportes» de Inventario (5.78): consumo de insumos, costo de ventas y margen por plato en un rango de fechas
// (`GET tobt/reportes/inventario`; pide reporte:leer y kardex:leer). El costo de cada plato es el que descontó el kardex
// al hacer cada pedido, no el de hoy. Todo viene resumido del servidor: aquí solo se muestra.
export default function InventarioReportes() {
  const [atajo, setAtajo] = useState(ATAJO_POR_DEFECTO);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const q = useMemo(() => consultaDeInventario({ atajo, desde, hasta }, consultaDe), [atajo, desde, hasta]);

  useEffect(() => {
    if (q.error) {
      setCargando(false);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    api
      .get("tobt/reportes/inventario", q.consulta)
      .then((r) => {
        if (!vigente) return;
        setDatos(normalizarReporteInventario(r));
        setError("");
      })
      .catch((err) => vigente && setError(mensajeAdmin(err)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [q]);

  const elegirPersonalizado = () => {
    if (!desde && datos) {
      setDesde(datos.desde);
      setHasta(datos.hasta);
    }
    setAtajo("personalizado");
  };

  const r = datos?.resumen;
  const aviso = r ? avisoSinCosto(r) : "";
  return (
    <div>
      <div className="adm-filtros" role="group" aria-label="Rango de fechas">
        {ATAJOS.map((a) => (
          <button key={a.id} type="button" aria-pressed={atajo === a.id} className={atajo === a.id ? "adm-btn adm-btn--primario" : "adm-btn"} onClick={() => setAtajo(a.id)}>{a.titulo}</button>
        ))}
        <button type="button" aria-pressed={atajo === "personalizado"} className={atajo === "personalizado" ? "adm-btn adm-btn--primario" : "adm-btn"} onClick={elegirPersonalizado}>Personalizado</button>
        {atajo === "personalizado" && (
          <>
            <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </>
        )}
      </div>
      <Aviso onCerrar={() => setError("")}>{error || q.error || ""}</Aviso>

      {cargando && !datos && <p className="adm-vacio">Cargando…</p>}
      {datos && (
        <div aria-busy={cargando}>
          <p className="adm-nota">
            Del {datos.desde} al {datos.hasta} ({datos.dias} {datos.dias === 1 ? "día" : "días"}, horario de {datos.zona}){datos.moneda ? ` · importes en ${datos.moneda}` : ""}.
            El costo de cada plato es el que descontó el inventario al hacer el pedido.
          </p>
          <p><BotonExcel tipo="inventario" datos={datos} /></p>
          <dl className="adm-resumen">
            <div><dt>Ventas</dt><dd>{textoDinero(r.ventas)}</dd></div>
            <div><dt>Costo de ventas</dt><dd>{textoDinero(r.costoDeVentas)}</dd></div>
            <div><dt>Ventas con costo</dt><dd>{textoCoberturaDeCosto(r)}</dd></div>
            <div><dt>Margen (solo ventas con costo)</dt><dd>{textoDinero(r.margen)}</dd></div>
            <div><dt>Margen % (solo ventas con costo)</dt><dd>{textoMargenPct(r.margenPct)}</dd></div>
            <div><dt>Insumos consumidos</dt><dd>{textoDinero(r.consumo)}</dd></div>
            <div><dt>Mermas</dt><dd>{textoDinero(r.merma)}</dd></div>
            <div><dt>Compras</dt><dd>{textoDinero(r.compras)}</dd></div>
          </dl>
          {aviso && <p className="adm-nota adm-nota--alerta" role="status">{aviso}</p>}

          <h3>Margen por plato</h3>
          {datos.platos.length === 0 ? (
            <p className="adm-vacio">No hay ventas cobradas en este rango.</p>
          ) : (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <thead>
                  <tr><th>Plato</th><th className="adm-num">Vendidos</th><th className="adm-num">Ventas</th><th className="adm-num">Costo</th><th className="adm-num">Margen</th><th className="adm-num">Margen %</th></tr>
                </thead>
                <tbody>
                  {datos.platos.map((p) => (
                    <tr key={p.codigo ?? `libre:${p.nombre}`}>
                      <td>
                        {p.nombre}
                        {p.categoria && <small className="adm-sub">{p.categoria}</small>}
                        {p.itemsSinCosto > 0 && <small className="adm-sub">{p.itemsSinCosto === p.items ? "Sin costo: no tiene receta o se vendió antes del inventario" : `${p.itemsSinCosto} de ${p.items} ítems sin costo`}</small>}
                      </td>
                      <td className="adm-num">{p.unidades}</td>
                      <td className="adm-num">{textoDinero(p.ventas)}</td>
                      <td className="adm-num">{p.margen === null ? "—" : textoDinero(p.costo)}</td>
                      <td className="adm-num">{p.margen === null ? "—" : textoDinero(p.margen)}</td>
                      <td className="adm-num">{textoMargenPct(p.margenPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {datos.platosTruncados && <p className="adm-nota">Se muestran los 500 platos que más vendieron.</p>}

          <h3>Consumo de insumos</h3>
          {datos.insumos.length === 0 ? (
            <p className="adm-vacio">No hubo movimientos de insumos en este rango.</p>
          ) : (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <thead>
                  <tr><th>Insumo</th><th className="adm-num">Consumo</th><th className="adm-num">Costo</th><th className="adm-num">Merma</th><th className="adm-num">Compras</th><th className="adm-num">Ajuste (conteo)</th></tr>
                </thead>
                <tbody>
                  {datos.insumos.map((i) => (
                    <tr key={i.insumoId}>
                      <td>{i.nombre}{i.codigo && <small className="adm-sub">{i.codigo}</small>}</td>
                      <td className="adm-num">{textoCantidad(i.consumo.cantidad, i.unidad)}</td>
                      <td className="adm-num">{textoDinero(i.consumo.valor)}</td>
                      <td className="adm-num">{i.merma.cantidad > 0 ? `${textoCantidad(i.merma.cantidad, i.unidad)} · ${textoDinero(i.merma.valor)}` : "—"}</td>
                      <td className="adm-num">{i.compras.cantidad > 0 ? `${textoCantidad(i.compras.cantidad, i.unidad)} · ${textoDinero(i.compras.valor)}` : "—"}</td>
                      <td className="adm-num">{i.ajuste.cantidad !== 0 ? `${i.ajuste.cantidad > 0 ? "+" : ""}${textoCantidad(i.ajuste.cantidad, i.unidad)} · ${textoDinero(i.ajuste.valor)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
