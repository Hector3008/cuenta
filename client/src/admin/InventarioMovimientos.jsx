import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import {
  TIPOS_MOVIMIENTO, accionDeCorreccion, formularioDeCorreccion, normalizarMovimiento, parsearAnulacion, puedeAnular, textoCantidad, textoCostoUnitario, textoDinero, textoFechaHora, textoPresentacion,
} from "./inventario-logica.js";

const PAGINA = 50;

// Vista «Movimientos» de Inventario (5.77): el libro del kardex, del más reciente al más antiguo. Los movimientos no se editan
// ni se borran: un error se corrige anulándolo (5.84; queda otro movimiento de signo contrario y el original marcado) y, si hace
// falta, registrándolo de nuevo con «Corregir». Anular pide kardex:gestionar. Filtra por insumo y por tipo.
export default function InventarioMovimientos({ cap = {}, insumos, recargar = async () => {}, alCorregir = () => {} }) {
  const [insumoId, setInsumoId] = useState("");
  const [tipo, setTipo] = useState("");
  const [lista, setLista] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [anulando, setAnulando] = useState(null); // { mov, volver, motivo }
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(
    async (desde) => {
      setCargando(true);
      try {
        const r = await api.get("kardex/movimientos", { insumoId, tipo, limite: PAGINA, saltar: desde });
        const pagina = comoLista(r?.movimientos ?? []).map(normalizarMovimiento);
        setLista((antes) => (desde === 0 ? pagina : [...antes, ...pagina]));
        setHayMas(pagina.length === PAGINA);
        setError("");
      } catch (err) {
        setError(mensajeAdmin(err));
      } finally {
        setCargando(false);
      }
    },
    [insumoId, tipo],
  );

  useEffect(() => {
    cargar(0);
  }, [cargar]);

  const insumo = (id) => insumos.find((i) => i.id === id);

  async function anular(ev) {
    ev.preventDefault();
    const r = parsearAnulacion(anulando.motivo);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    try {
      await api.post(`kardex/movimientos/${anulando.mov.id}/anular`, r.cuerpo);
      const { mov, volver } = anulando;
      setAnulando(null);
      await recargar();
      if (volver) {
        alCorregir({ tipo: accionDeCorreccion(mov), insumoId: mov.insumoId, datos: formularioDeCorreccion(mov) });
      } else {
        setOk("Movimiento anulado: el saldo y el costo promedio ya no lo cuentan.");
        await cargar(0);
      }
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      {anulando && (
        <form className="adm-form" onSubmit={anular}>
          <h3>{anulando.volver ? "Corregir" : "Anular"} {TIPOS_MOVIMIENTO[anulando.mov.tipo].toLowerCase()} de {insumo(anulando.mov.insumoId)?.nombre ?? "este insumo"}</h3>
          <p className="adm-nota">
            Se registra un movimiento contrario por {textoCantidad(Math.abs(anulando.mov.cantidad), insumo(anulando.mov.insumoId)?.unidad ?? "")} y el original queda marcado como anulado: el historial no se borra.
            {anulando.volver ? " Después se abre el formulario con los mismos datos para que cambies lo que estaba mal." : ""}
          </p>
          <Campo etiqueta="Motivo">
            <input required autoFocus maxLength={200} value={anulando.motivo} onChange={(e) => setAnulando((x) => ({ ...x, motivo: e.target.value }))} placeholder="me equivoqué en la cantidad" />
          </Campo>
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Anulando…" : anulando.volver ? "Anular y corregir" : "Anular"}</button>
            <button type="button" className="adm-btn" onClick={() => setAnulando(null)} disabled={enviando}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="adm-filtros">
        <select value={insumoId} onChange={(e) => setInsumoId(e.target.value)} aria-label="Insumo">
          <option value="">Todos los insumos</option>
          {insumos.map((i) => (<option key={i.id} value={i.id}>{i.nombre}</option>))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de movimiento">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([id, titulo]) => (<option key={id} value={id}>{titulo}</option>))}
        </select>
      </div>

      {lista.length === 0 && !cargando ? (
        <p className="adm-vacio">No hay movimientos con ese filtro.</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Fecha</th><th>Insumo</th><th>Movimiento</th><th className="adm-num">Cantidad</th><th className="adm-num">Costo</th><th className="adm-num">Valor</th><th className="adm-num">Queda</th>{cap.gestionar && <th>Acciones</th>}</tr>
            </thead>
            <tbody>
              {lista.map((m) => {
                const i = insumo(m.insumoId);
                const u = i?.unidad ?? "";
                const pres = textoPresentacion(m, u);
                return (
                  <tr key={m.id}>
                    <td>{textoFechaHora(m.ts)}</td>
                    <td>{i?.nombre ?? "—"}</td>
                    <td>
                      {TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo}{m.anulado && <small className="adm-sub"><strong>Anulado</strong></small>}
                      {(pres || m.detalle || m.referencia) && <small className="adm-sub">{[pres, m.detalle, m.referencia].filter(Boolean).join(" · ")}</small>}
                    </td>
                    <td className="adm-num">{m.cantidad > 0 ? "+" : ""}{textoCantidad(m.cantidad, u)}</td>
                    <td className="adm-num">{textoCostoUnitario(m.costoUnitario)}</td>
                    <td className="adm-num">{textoDinero(m.valor)}</td>
                    <td className="adm-num">{textoCantidad(m.existenciaDespues, u)}</td>
                    {cap.gestionar && (
                      <td className="adm-celda-acciones">
                        {puedeAnular(m) && (
                          <>
                            {accionDeCorreccion(m) && (
                              <button type="button" className="adm-btn" onClick={() => { setOk(""); setError(""); setAnulando({ mov: m, volver: true, motivo: "" }); }}>Corregir</button>
                            )}
                            <button type="button" className="adm-btn" onClick={() => { setOk(""); setError(""); setAnulando({ mov: m, volver: false, motivo: "" }); }}>Anular</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {cargando && <p className="adm-vacio">Cargando…</p>}
      {hayMas && !cargando && (
        <div className="adm-acciones"><button type="button" className="adm-btn" onClick={() => cargar(lista.length)}>Ver más</button></div>
      )}
    </div>
  );
}
