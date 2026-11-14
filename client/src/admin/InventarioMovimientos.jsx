import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import {
  TIPOS_MOVIMIENTO, normalizarMovimiento, textoCantidad, textoCostoUnitario, textoDinero, textoFechaHora, textoPresentacion,
} from "./inventario-logica.js";

const PAGINA = 50;

// Vista «Movimientos» de Inventario (5.77): el libro del kardex, del más reciente al más antiguo. Solo se lee: los movimientos
// no se editan ni se borran (un error se corrige con un conteo o una reversa). Filtra por insumo y por tipo.
export default function InventarioMovimientos({ insumos }) {
  const [insumoId, setInsumoId] = useState("");
  const [tipo, setTipo] = useState("");
  const [lista, setLista] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
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
              <tr><th>Fecha</th><th>Insumo</th><th>Movimiento</th><th className="adm-num">Cantidad</th><th className="adm-num">Costo</th><th className="adm-num">Valor</th><th className="adm-num">Queda</th></tr>
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
                      {TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo}
                      {(pres || m.detalle || m.referencia) && <small className="adm-sub">{[pres, m.detalle, m.referencia].filter(Boolean).join(" · ")}</small>}
                    </td>
                    <td className="adm-num">{m.cantidad > 0 ? "+" : ""}{textoCantidad(m.cantidad, u)}</td>
                    <td className="adm-num">{textoCostoUnitario(m.costoUnitario)}</td>
                    <td className="adm-num">{textoDinero(m.valor)}</td>
                    <td className="adm-num">{textoCantidad(m.existenciaDespues, u)}</td>
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
