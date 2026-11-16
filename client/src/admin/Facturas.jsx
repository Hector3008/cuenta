import { useCallback, useEffect, useMemo, useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import { formatoPrecio } from "./formato.js";
import { fechaHoraEn } from "./reportes-excel.js";
import { ATAJOS, consultaDe } from "./reportes-logica.js";
import {
  ESTADOS_FACTURA, MOTIVOS_DESHACER, RANGO_TODO, consultaDeFacturas, normalizarFacturas, parsearMotivoDeshacer, parsearNumeroFactura, textoPendientes,
} from "./facturas-logica.js";

// Pestaña «Facturas» (5.88): los recibos en que el cliente pidió factura (5.86). La factura se emite fuera del sistema; aquí se
// marca cuál ya se emitió (con su número) para saber qué falta. `GET tobt/facturas`; marcar y deshacer piden documento:editar.
export default function Facturas({ cap }) {
  const [estado, setEstado] = useState("pendientes");
  const [atajo, setAtajo] = useState(RANGO_TODO);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [abierta, setAbierta] = useState(null); // { recibo, accion: "emitir" | "deshacer" }
  const [numero, setNumero] = useState("");
  const [motivo, setMotivo] = useState("error_de_marca");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);

  const q = useMemo(() => consultaDeFacturas({ estado, atajo, desde, hasta }, consultaDe), [estado, atajo, desde, hasta]);

  useEffect(() => {
    if (q.error) {
      setCargando(false);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    api
      .get("tobt/facturas", q.consulta)
      .then((r) => {
        if (!vigente) return;
        setDatos(normalizarFacturas(r));
        setError("");
      })
      .catch((err) => vigente && setError(mensajeAdmin(err)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [q, recarga]);

  const abrir = (recibo, accion) => {
    setAbierta({ recibo, accion });
    setNumero("");
    setMotivo("error_de_marca");
    setDetalle("");
    setError("");
  };

  const enviar = useCallback(
    async (f) => {
      const emitir = abierta.accion === "emitir";
      const p = emitir ? parsearNumeroFactura(numero, { obligatorio: datos?.numeroObligatorio }) : parsearMotivoDeshacer(motivo, detalle);
      if (!p.ok) return setError(p.error);
      setEnviando(true);
      setError("");
      try {
        await api.post(`tobt/facturas/${encodeURIComponent(f.recibo)}/${emitir ? "emitida" : "deshacer"}`, emitir ? { numero: p.numero, esperaVersion: f.version ?? undefined } : { motivo: p.motivo, esperaVersion: f.version ?? undefined });
        setAbierta(null);
        setRecarga((n) => n + 1);
      } catch (err) {
        setError(mensajeAdmin(err));
      } finally {
        setEnviando(false);
      }
    },
    [abierta, numero, motivo, detalle, datos],
  );

  const elegirPersonalizado = () => {
    if (!desde && datos?.desde) {
      setDesde(datos.desde);
      setHasta(datos.hasta);
    }
    setAtajo("personalizado");
  };

  const dinero = (v) => formatoPrecio(v, datos?.moneda);
  return (
    <div>
      <div className="adm-filtros" role="group" aria-label="Estado de la factura">
        {ESTADOS_FACTURA.map((e) => (
          <button key={e.id} type="button" aria-pressed={estado === e.id} className={estado === e.id ? "adm-btn adm-btn--primario" : "adm-btn"} onClick={() => setEstado(e.id)}>
            {e.titulo}{datos && e.id !== "todas" ? ` (${datos.resumen[e.id].cantidad})` : ""}
          </button>
        ))}
      </div>
      <div className="adm-filtros" role="group" aria-label="Rango de fechas">
        <button type="button" aria-pressed={atajo === RANGO_TODO} className={atajo === RANGO_TODO ? "adm-btn adm-btn--primario" : "adm-btn"} onClick={() => setAtajo(RANGO_TODO)}>Todo</button>
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
          <p className="adm-nota" role="status">
            <strong>{textoPendientes(datos.resumen.pendientes.cantidad)}</strong>
            {datos.resumen.pendientes.cantidad > 0 ? ` · ${dinero(datos.resumen.pendientes.total)} por facturar` : ""}.
            {" "}La factura se emite fuera del sistema; aquí solo se marca cuál ya se emitió.
          </p>
          {datos.facturas.length === 0 ? (
            <p className="adm-vacio">{estado === "pendientes" ? "No hay facturas pendientes." : "No hay facturas con este filtro."}</p>
          ) : (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <thead>
                  <tr><th>Recibo</th><th>Fecha</th><th>Cliente</th><th>RUC / referencia</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {datos.facturas.map((f) => (
                    <tr key={f.recibo}>
                      <td>{f.recibo}{f.pedido ? <small> · {f.pedido}</small> : null}</td>
                      <td>{fechaHoraEn(f.ts, datos.zona) ?? "—"}</td>
                      <td>{f.cliente ?? "—"}</td>
                      <td>{f.rucReferencia ?? "—"}</td>
                      <td>{dinero(f.total)}</td>
                      <td>
                        {f.estado === "emitida" ? (
                          <>Emitida{f.emision?.numero ? ` · ${f.emision.numero}` : ""}
                            {f.emision?.por || f.emision?.ts ? <small> · {[f.emision.por, fechaHoraEn(f.emision.ts, datos.zona)].filter(Boolean).join(", ")}</small> : null}</>
                        ) : "Pendiente"}
                      </td>
                      <td>
                        {cap.marcar && abierta?.recibo !== f.recibo && (
                          f.estado === "pendiente"
                            ? <button type="button" className="adm-btn" onClick={() => abrir(f.recibo, "emitir")}>Marcar como emitida</button>
                            : <button type="button" className="adm-btn" onClick={() => abrir(f.recibo, "deshacer")}>Deshacer</button>
                        )}
                        {abierta?.recibo === f.recibo && (
                          <form className="adm-form" onSubmit={(ev) => { ev.preventDefault(); enviar(f); }}>
                            {abierta.accion === "emitir" ? (
                              <label>N.º de factura{datos.numeroObligatorio ? "" : " (opcional)"}
                                <input value={numero} maxLength={30} onChange={(e) => setNumero(e.target.value)} placeholder="F001-123" autoFocus />
                              </label>
                            ) : (
                              <>
                                <label>Motivo
                                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                                    {MOTIVOS_DESHACER.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                                  </select>
                                </label>
                                {motivo === "otro" && <label>Cuéntanos <input value={detalle} maxLength={200} onChange={(e) => setDetalle(e.target.value)} /></label>}
                              </>
                            )}
                            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{abierta.accion === "emitir" ? "Marcar" : "Deshacer"}</button>
                            <button type="button" className="adm-btn" onClick={() => setAbierta(null)}>Cancelar</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {datos.truncado && <p className="adm-nota adm-nota--alerta">Se muestran las primeras 500; acota las fechas para ver el resto.</p>}
        </div>
      )}
      {cap.configurar && <ConfigFactura alCambiar={() => setRecarga((n) => n + 1)} />}
    </div>
  );
}

// «El número de la factura es obligatorio»: ajuste de la empresa (`GET/PUT auth/facturacion`, pide empresa:datos).
function ConfigFactura({ alCambiar }) {
  const [obligatorio, setObligatorio] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    api.get("auth/facturacion").then((r) => vigente && setObligatorio(r?.numeroObligatorio === true), (e) => vigente && setError(mensajeAdmin(e)));
    return () => {
      vigente = false;
    };
  }, []);
  const cambiar = async (v) => {
    setError("");
    try {
      const r = await api.put("auth/facturacion", { numeroObligatorio: v });
      setObligatorio(r?.numeroObligatorio === true);
      alCambiar();
    } catch (e) {
      setError(mensajeAdmin(e));
    }
  };
  if (obligatorio === null && !error) return null;
  return (
    <div className="adm-form">
      <label>
        <input type="checkbox" checked={obligatorio === true} onChange={(e) => cambiar(e.target.checked)} disabled={obligatorio === null} />
        {" "}El número de la factura es obligatorio al marcarla como emitida
      </label>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
    </div>
  );
}
