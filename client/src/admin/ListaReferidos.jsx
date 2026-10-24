import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import { ESTADOS_REFERIDO } from "./formato.js";

// Lista de referidos (5.46): quién trajo a quién, y si ya se dieron los puntos. Pide fidelizacion:gestionar.

const fecha = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
};

export function normalizarReferido(r) {
  return {
    id: String(r?.id ?? ""),
    referente: r?.referente?.nombre ?? "—",
    referido: r?.referido?.nombre ?? "—",
    estado: r?.estado ?? "pendiente",
    ts: r?.ts ?? null,
    puntosReferente: r?.puntosReferente ?? 0,
    puntosReferido: r?.puntosReferido ?? 0,
  };
}

export default function ListaReferidos() {
  const [datos, setDatos] = useState(null); // { total, resumen, referidos }
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await api.get(`clientes/referidos${estado ? `?estado=${estado}` : ""}`);
      setDatos({ total: r?.total ?? 0, resumen: r?.resumen ?? { premiados: 0, pendientes: 0 }, referidos: comoLista(r?.referidos).map(normalizarReferido) });
      setError("");
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="adm-form">
      <h3>Referidos</h3>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {datos && (
        <p className="adm-nota">
          {datos.resumen.premiados} premiados · {datos.resumen.pendientes} pendientes de su primer consumo
        </p>
      )}
      <Campo etiqueta="Mostrar">
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(ESTADOS_REFERIDO).map(([id, t]) => (<option key={id} value={id}>{t}</option>))}
        </select>
      </Campo>
      {!datos ? (
        <p className="adm-vacio">Cargando…</p>
      ) : datos.referidos.length === 0 ? (
        <p className="adm-vacio">Todavía no hay referidos. Se anotan cuando un cliente nuevo se registra con el código de un amigo o cuando el personal lo indica al crear su ficha.</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Lo trajo</th><th>Amigo</th><th>Estado</th><th className="adm-num">Puntos (quien refiere / amigo)</th><th>Desde</th></tr>
            </thead>
            <tbody>
              {datos.referidos.map((r) => (
                <tr key={r.id}>
                  <td>{r.referente}</td>
                  <td>{r.referido}</td>
                  <td>{ESTADOS_REFERIDO[r.estado] ?? r.estado}</td>
                  <td className="adm-num">{r.estado === "premiado" ? `${r.puntosReferente} / ${r.puntosReferido}` : "—"}</td>
                  <td>{fecha(r.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
