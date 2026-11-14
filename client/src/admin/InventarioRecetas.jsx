import { useCallback, useEffect, useMemo, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar } from "./piezas.jsx";
import {
  MAX_LINEAS_RECETA, costoDeReceta, formularioDeReceta, margenDePlato, normalizarPlato, normalizarReceta, parsearReceta,
  textoCantidad, textoDinero,
} from "./inventario-logica.js";

// Vista «Recetas» de Inventario (5.77): qué insumos gasta una porción de cada plato del catálogo. Al pedir el plato, tobt
// descuenta receta × cantidad del kardex. Con el costo promedio de hoy se ve cuánto cuesta una porción y cuánto queda de margen.
// Ver pide kardex:leer; escribir o quitar una receta, kardex:gestionar.
export default function InventarioRecetas({ cap, insumos }) {
  const [platos, setPlatos] = useState([]);
  const [recetas, setRecetas] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busca, setBusca] = useState("");
  const [soloSin, setSoloSin] = useState(false);
  const [edicion, setEdicion] = useState(null); // { plato, datos }
  const [enviando, setEnviando] = useState(false);

  const activos = useMemo(() => insumos.filter((i) => i.activo), [insumos]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, rs] = await Promise.all([api.get("catalogo/", { limite: 200 }), api.get("tobt/recetas")]);
      setPlatos(comoLista(lista).map(normalizarPlato).filter((p) => p.activo && p.codigo));
      setRecetas(new Map(comoLista(rs?.recetas ?? []).map(normalizarReceta).map((r) => [r.platoCodigo.toLowerCase(), r])));
      setError("");
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = platos.filter((p) => {
    const t = busca.trim().toLowerCase();
    const tiene = recetas.has(p.codigo.toLowerCase());
    return (!soloSin || !tiene) && (!t || p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t));
  });
  const conReceta = platos.filter((p) => recetas.has(p.codigo.toLowerCase())).length;

  const editar = (p) => {
    setOk("");
    setError("");
    const r = recetas.get(p.codigo.toLowerCase());
    setEdicion({ plato: p, datos: r ? formularioDeReceta(r) : { lineas: [{ insumoId: "", cantidad: "" }] } });
  };
  const linea = (n, k) => (e) =>
    setEdicion((x) => ({ ...x, datos: { lineas: x.datos.lineas.map((l, j) => (j === n ? { ...l, [k]: e.target.value } : l)) } }));

  async function guardar(ev) {
    ev.preventDefault();
    const r = parsearReceta(edicion.datos, insumos);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    try {
      await api.put(`tobt/recetas/${encodeURIComponent(edicion.plato.codigo)}`, r.cuerpo);
      setOk(`Receta de «${edicion.plato.nombre}» guardada. Desde el próximo pedido descuenta estos insumos.`);
      setEdicion(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(p) {
    setError("");
    setOk("");
    try {
      await api.del(`tobt/recetas/${encodeURIComponent(p.codigo)}`);
      setOk(`«${p.nombre}» ya no descuenta insumos. Lo ya consumido no cambia.`);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  const unidadDe = (id) => insumos.find((i) => i.id === id)?.unidad ?? "";
  const previa = edicion ? costoDeReceta(parsearReceta(edicion.datos, insumos).cuerpo?.lineas ?? [], insumos) : null;
  const margenPrevia = edicion && previa ? margenDePlato(edicion.plato.precio, previa.costo) : null;

  return (
    <div>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      <p className="adm-nota">
        Una receta dice cuánto gasta <strong>una porción</strong> de cada plato, en la unidad base del insumo (por ejemplo 15 g de café). Los platos sin receta se venden igual, pero no descuentan nada.
      </p>

      {edicion && (
        <form className="adm-form" onSubmit={guardar}>
          <h3>Receta de «{edicion.plato.nombre}»</h3>
          {edicion.datos.lineas.map((l, n) => (
            <span className="adm-fila-form adm-linea-receta" key={n}>
              <label className="campo">
                <span>Insumo</span>
                <select value={l.insumoId} onChange={linea(n, "insumoId")}>
                  <option value="">Elige…</option>
                  {activos.map((i) => (<option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>))}
                </select>
              </label>
              <label className="campo">
                <span>Cantidad{unidadDe(l.insumoId) ? ` (${unidadDe(l.insumoId)})` : ""}</span>
                <input inputMode="decimal" value={l.cantidad} onChange={linea(n, "cantidad")} />
              </label>
              <button type="button" className="adm-btn" onClick={() => setEdicion((x) => ({ ...x, datos: { lineas: x.datos.lineas.filter((_, j) => j !== n) } }))}>Quitar</button>
            </span>
          ))}
          {edicion.datos.lineas.length < MAX_LINEAS_RECETA && (
            <button type="button" className="adm-btn" onClick={() => setEdicion((x) => ({ ...x, datos: { lineas: [...x.datos.lineas, { insumoId: "", cantidad: "" }] } }))}>Agregar insumo</button>
          )}
          {previa && previa.costo > 0 && (
            <p className="adm-nota" role="status">
              Costo por porción: {textoDinero(previa.costo)}{previa.incompleto ? " (sin contar los insumos que aún no tienen costo)" : ""}
              {margenPrevia ? ` · precio ${textoDinero(edicion.plato.precio)} · margen ${textoDinero(margenPrevia.margen)} (${margenPrevia.porcentaje} %)` : ""}.
            </p>
          )}
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar receta"}</button>
            <button type="button" className="adm-btn" onClick={() => setEdicion(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : platos.length === 0 ? (
        <p className="adm-vacio">No hay platos activos en el catálogo.</p>
      ) : (
        <>
          <div className="adm-filtros">
            <input type="search" placeholder="Buscar plato" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar plato" />
            <label className="adm-check"><input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} /> Solo sin receta</label>
            <span className="adm-nota">{conReceta} de {platos.length} platos con receta.</span>
          </div>
          <div className="adm-tabla-caja">
            <table className="adm-tabla">
              <thead>
                <tr><th>Plato</th><th className="adm-num">Precio</th><th>Receta</th><th className="adm-num">Costo</th><th className="adm-num">Margen</th>{cap.gestionar && <th />}</tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const r = recetas.get(p.codigo.toLowerCase());
                  const c = r ? costoDeReceta(r.lineas, insumos) : null;
                  const m = c && !c.incompleto ? margenDePlato(p.precio, c.costo) : null;
                  return (
                    <tr key={p.codigo}>
                      <td><span className="adm-plato"><span>{p.nombre}<small>{p.codigo}</small></span></span></td>
                      <td className="adm-num">{p.precio === null ? "—" : textoDinero(p.precio)}</td>
                      <td>
                        {r ? (
                          <ul className="adm-lista-simple">
                            {r.lineas.map((l) => {
                              const i = insumos.find((x) => x.id === l.insumoId);
                              return <li key={l.insumoId}>{i ? i.nombre : "Insumo borrado"}: {textoCantidad(l.cantidad, i?.unidad)}</li>;
                            })}
                          </ul>
                        ) : (
                          <span className="adm-etiqueta">sin receta</span>
                        )}
                      </td>
                      <td className="adm-num">{c ? `${textoDinero(c.costo)}${c.incompleto ? " *" : ""}` : "—"}</td>
                      <td className="adm-num">{m ? `${textoDinero(m.margen)} (${m.porcentaje} %)` : "—"}</td>
                      {cap.gestionar && (
                        <td className="adm-celda-acciones">
                          <button type="button" className="adm-btn" onClick={() => editar(p)}>{r ? "Editar" : "Crear receta"}</button>
                          {r && <BotonConfirmar etiqueta="Quitar receta" confirmar="¿Quitar?" peligro onConfirmar={() => quitar(p)} />}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="adm-nota">* Falta el costo de algún insumo (todavía no se compró): el costo mostrado no lo incluye y no se calcula el margen.</p>
        </>
      )}
    </div>
  );
}
