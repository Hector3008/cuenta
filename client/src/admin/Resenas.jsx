import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import {
  FILTROS_RESENA, FILTRO_RESENA_INICIAL, estadoResena, estrellasTexto, fechaResena, normalizarResena, textoVacioResenas,
} from "./resenas-logica.js";

// Sección Reseñas (5.62): las opiniones que los clientes dejan en la carta. Ver pide resena:leer; ocultar y volver a mostrar,
// resena:gestionar. Una reseña oculta no sale en la carta pero se conserva; al volver a mostrarla se limpian sus reportes.
export default function Resenas({ cap }) {
  const [filtro, setFiltro] = useState(FILTRO_RESENA_INICIAL);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [moviendo, setMoviendo] = useState(() => new Set());

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLista(comoLista((await api.get("resenas", { filtro }))?.resenas ?? []).map(normalizarResena));
      setError("");
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiar(r, oculta) {
    if (moviendo.has(r.id)) return;
    setMoviendo((s) => new Set(s).add(r.id));
    setError("");
    setOk("");
    try {
      await api.put(`resenas/${r.id}/visibilidad`, { oculta });
      setOk(oculta ? "Reseña oculta: ya no sale en la carta." : "Reseña visible otra vez en la carta.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setMoviendo((s) => {
        const n = new Set(s);
        n.delete(r.id);
        return n;
      });
    }
  }

  return (
    <section aria-labelledby="t-resenas">
      <header className="adm-cabecera">
        <h2 id="t-resenas">Reseñas</h2>
        <div className="adm-acciones">
          {FILTROS_RESENA.map(([id, titulo]) => (
            <button key={id} type="button" className={filtro === id ? "adm-btn adm-btn--primario" : "adm-btn"} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
              {titulo}
            </button>
          ))}
        </div>
      </header>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      <p className="adm-nota">
        Solo opina quien ya pagó el plato, y la reseña se publica al instante con su nombre y la inicial del apellido. Los clientes pueden reportar
        las que les parezcan ofensivas: aquí las ves primero. Ocultar no borra; se puede mostrar de nuevo.
      </p>

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="adm-vacio">{textoVacioResenas(filtro)}</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Plato</th><th>Reseña</th><th>Estado</th>{cap.gestionar && <th />}</tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className={r.oculta ? "adm-fila--baja" : ""}>
                  <td>{r.itemNombre}<small className="adm-sub">{r.itemCodigo}</small></td>
                  <td>
                    <span className="adm-estrellas" role="img" aria-label={`${r.estrellas} de 5 estrellas`}>{estrellasTexto(r.estrellas)}</span>
                    {r.texto && <span className="adm-resena-texto">{r.texto}</span>}
                    <small className="adm-sub">{r.autor}{r.ts ? ` · ${fechaResena(r.ts)}` : ""}</small>
                  </td>
                  <td>{estadoResena(r)}</td>
                  {cap.gestionar && (
                    <td className="adm-celda-acciones">
                      {r.oculta ? (
                        <button type="button" className="adm-btn" disabled={moviendo.has(r.id)} onClick={() => cambiar(r, false)}>Mostrar</button>
                      ) : (
                        <button type="button" className="adm-btn adm-btn--peligro" disabled={moviendo.has(r.id)} onClick={() => cambiar(r, true)}>Ocultar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
