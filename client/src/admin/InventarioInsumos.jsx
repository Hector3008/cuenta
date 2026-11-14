import { useMemo, useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import {
  ACCIONES, MAX_PRESENTACIONES, alertaDeInsumo, formularioDeInsumo, formularioDeMovimiento, parsearInsumo, parsearMovimiento,
  resumenValorizacion, textoCantidad, textoCostoUnitario, textoDinero, vistaPrevia,
} from "./inventario-logica.js";

// Vista «Insumos» de Inventario (5.77): lista con existencia, costo promedio y valor; alta y edición de insumos con sus
// presentaciones; compra, merma, conteo y saldo inicial.
export default function InventarioInsumos({ cap, insumos, valorizacion, recargar }) {
  const [busca, setBusca] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [formulario, setFormulario] = useState(null); // { id?, datos }
  const [accion, setAccion] = useState(null); // { tipo, insumo, datos }
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const visibles = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return insumos.filter(
      (i) =>
        (verInactivos || i.activo) &&
        (!soloAlertas || alertaDeInsumo(i)) &&
        (!t || i.codigo.toLowerCase().includes(t) || i.nombre.toLowerCase().includes(t)),
    );
  }, [insumos, busca, verInactivos, soloAlertas]);

  const avisos = resumenValorizacion(valorizacion);
  const f = formulario?.datos;
  const campo = (k) => (e) => setFormulario((x) => ({ ...x, datos: { ...x.datos, [k]: e.target.value } }));
  const campoPresentacion = (n, k) => (e) =>
    setFormulario((x) => ({ ...x, datos: { ...x.datos, presentaciones: x.datos.presentaciones.map((p, j) => (j === n ? { ...p, [k]: e.target.value } : p)) } }));

  const nuevoInsumo = () => { setOk(""); setError(""); setAccion(null); setFormulario({ datos: formularioDeInsumo(null) }); };
  const editar = (i) => { setOk(""); setError(""); setAccion(null); setFormulario({ id: i.id, insumo: i, datos: formularioDeInsumo(i) }); };
  const abrirAccion = (tipo, insumo) => { setOk(""); setError(""); setFormulario(null); setAccion({ tipo, insumo, datos: formularioDeMovimiento() }); };

  async function guardarInsumo(ev) {
    ev.preventDefault();
    const r = parsearInsumo(formulario.id ? { ...f, unidad: formulario.insumo.unidad } : f, { edicion: Boolean(formulario.id) });
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    try {
      if (formulario.id) await api.put(`kardex/insumos/${formulario.id}`, r.cuerpo);
      else await api.post("kardex/insumos", r.cuerpo);
      setOk(formulario.id ? "Insumo actualizado." : "Insumo creado. Ahora carga su saldo inicial o registra una compra.");
      setFormulario(null);
      await recargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActivo(i, activo) {
    setError("");
    setOk("");
    try {
      await api.put(`kardex/insumos/${i.id}`, { activo });
      setOk(activo ? "Insumo reactivado." : "Insumo desactivado: ya no se puede comprar ni usar en recetas, pero se conserva su historial.");
      await recargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  async function guardarMovimiento(ev) {
    ev.preventDefault();
    const r = parsearMovimiento(accion.tipo, accion.datos, accion.insumo);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    try {
      const x = await api.post(`kardex/insumos/${accion.insumo.id}/${ACCIONES[accion.tipo].ruta}`, r.cuerpo);
      const u = accion.insumo.unidad;
      setOk(
        x?.sinDiferencia
          ? `El conteo coincide con el sistema: ${textoCantidad(x.existencia, u)}. No se registró nada.`
          : `Listo: ahora hay ${textoCantidad(x?.existencia, u)} de ${accion.insumo.nombre}.${x?.negativo ? " Queda en negativo: revisa compras o conteo." : ""}`,
      );
      setAccion(null);
      await recargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  const a = accion;
  const def = a ? ACCIONES[a.tipo] : null;
  const previa = a ? vistaPrevia(a.tipo, a.datos, a.insumo) : null;
  const campoAccion = (k) => (e) => setAccion((x) => ({ ...x, datos: { ...x.datos, [k]: e.target.value } }));
  const puede = (permiso) => cap[permiso];

  return (
    <div>
      <div className="adm-acciones">
        {cap.gestionar && (
          <button type="button" className="adm-btn adm-btn--primario" onClick={nuevoInsumo}>Nuevo insumo</button>
        )}
      </div>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

      {valorizacion && (
        <dl className="adm-resumen">
          <div><dt>Valor del inventario</dt><dd>{textoDinero(valorizacion.total)}</dd></div>
          <div><dt>Insumos con movimiento</dt><dd>{valorizacion.insumos?.length ?? 0}</dd></div>
        </dl>
      )}
      {avisos && <p className="adm-nota adm-nota--alerta" role="status">{avisos}</p>}
      <p className="adm-nota">
        El saldo y el costo promedio los lleva el kardex: sube con las compras y baja solo con cada pedido (según la receta del plato), las mermas y los conteos.
      </p>

      {formulario && (
        <form className="adm-form" onSubmit={guardarInsumo}>
          <h3>{formulario.id ? `Editar «${formulario.insumo.nombre}»` : "Nuevo insumo"}</h3>
          <Campo etiqueta="Código" ayuda={formulario.id ? "El código no se cambia." : "Por ejemplo CAFE o LECHE. No se puede cambiar después."}>
            <input required maxLength={40} value={f.codigo} onChange={campo("codigo")} disabled={Boolean(formulario.id)} />
          </Campo>
          <Campo etiqueta="Nombre">
            <input required maxLength={120} value={f.nombre} onChange={campo("nombre")} />
          </Campo>
          <Campo etiqueta="Unidad base" ayuda={formulario.id ? "La unidad no se cambia: los movimientos ya están guardados en ella." : "La más pequeña con la que cuentas: g, ml o unidad. Todo se guarda en ella y las recetas la usan."}>
            <input required maxLength={12} value={formulario.id ? formulario.insumo.unidad : f.unidad} onChange={campo("unidad")} disabled={Boolean(formulario.id)} />
          </Campo>
          <Campo etiqueta="Stock mínimo (opcional)" ayuda="Si la existencia llega a este número o menos, se avisa.">
            <input inputMode="decimal" value={f.stockMinimo} onChange={campo("stockMinimo")} />
          </Campo>

          <fieldset className="adm-cuando">
            <legend>Presentaciones (opcional)</legend>
            <small className="adm-nota">Cómo compras el insumo: «paquete» = 500 g, «caja» = 1000 ml. Así registras una compra en paquetes y el sistema lo pasa a la unidad base.</small>
            {f.presentaciones.map((p, n) => (
              <span className="adm-fila-form" key={n}>
                <Campo etiqueta="Nombre"><input maxLength={30} value={p.nombre} onChange={campoPresentacion(n, "nombre")} /></Campo>
                <Campo etiqueta={`Trae (en ${(formulario.id ? formulario.insumo.unidad : f.unidad) || "la unidad base"})`}><input inputMode="decimal" value={p.factor} onChange={campoPresentacion(n, "factor")} /></Campo>
                <button type="button" className="adm-btn" onClick={() => setFormulario((x) => ({ ...x, datos: { ...x.datos, presentaciones: x.datos.presentaciones.filter((_, j) => j !== n) } }))}>Quitar</button>
              </span>
            ))}
            {f.presentaciones.length < MAX_PRESENTACIONES && (
              <button type="button" className="adm-btn" onClick={() => setFormulario((x) => ({ ...x, datos: { ...x.datos, presentaciones: [...x.datos.presentaciones, { nombre: "", factor: "" }] } }))}>Agregar presentación</button>
            )}
          </fieldset>

          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
            <button type="button" className="adm-btn" onClick={() => setFormulario(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {a && (
        <form className="adm-form" onSubmit={guardarMovimiento}>
          <h3>{def.titulo}: {a.insumo.nombre}</h3>
          <p className="adm-nota">Ahora hay {textoCantidad(a.insumo.existencia, a.insumo.unidad)}{a.insumo.costoPromedio > 0 ? `, a ${textoCostoUnitario(a.insumo.costoPromedio)} por ${a.insumo.unidad}` : ""}.</p>
          <span className="adm-fila-form">
            <Campo etiqueta={a.tipo === "conteo" ? "Cuánto hay contado" : "Cantidad"}>
              <input required inputMode="decimal" value={a.datos.cantidad} onChange={campoAccion("cantidad")} />
            </Campo>
            <Campo etiqueta="En">
              <select value={a.datos.presentacion} onChange={campoAccion("presentacion")}>
                <option value="">{a.insumo.unidad}</option>
                {a.insumo.presentaciones.map((p) => (<option key={p.nombre} value={p.nombre}>{p.nombre} ({textoCantidad(p.factor, a.insumo.unidad)})</option>))}
              </select>
            </Campo>
          </span>
          {def.pideCosto && (
            <span className="adm-fila-form">
              <Campo etiqueta="El costo es">
                <select value={a.datos.modoCosto} onChange={campoAccion("modoCosto")}>
                  <option value="unitario">por {a.datos.presentacion || a.insumo.unidad}</option>
                  <option value="total">el total pagado</option>
                </select>
              </Campo>
              <Campo etiqueta="Costo"><input required inputMode="decimal" value={a.datos.costo} onChange={campoAccion("costo")} /></Campo>
            </span>
          )}
          <Campo etiqueta={def.pideDetalle ? "Motivo" : "Detalle (opcional)"} ayuda={a.tipo === "merma" ? "Por ejemplo «se venció» o «se cayó»." : a.tipo === "conteo" ? "Por ejemplo «conteo de la semana»." : a.tipo === "compra" ? "Por ejemplo el proveedor o el número de factura." : undefined}>
            <input required={def.pideDetalle} maxLength={200} value={a.datos.detalle} onChange={campoAccion("detalle")} />
          </Campo>
          {previa && (
            <p className="adm-nota" role="status">
              {a.tipo === "conteo"
                ? `Quedarán ${textoCantidad(previa.base, a.insumo.unidad)} (ahora hay ${textoCantidad(a.insumo.existencia, a.insumo.unidad)}).`
                : a.tipo === "merma"
                  ? `Salen ${textoCantidad(previa.base, a.insumo.unidad)}.`
                  : `Entran ${textoCantidad(previa.base, a.insumo.unidad)}${previa.costoUnitario !== null ? ` a ${textoCostoUnitario(previa.costoUnitario)} por ${a.insumo.unidad}` : ""}.`}
            </p>
          )}
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
            <button type="button" className="adm-btn" onClick={() => setAccion(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="adm-filtros">
        <input type="search" placeholder="Buscar por código o nombre" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar insumo" />
        <label className="adm-check"><input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} /> Solo con alerta</label>
        <label className="adm-check"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver desactivados</label>
      </div>

      {insumos.length === 0 ? (
        <p className="adm-vacio">Todavía no hay insumos. {cap.gestionar ? "Crea el primero, por ejemplo el café o la leche." : "Pídele a quien gestiona el inventario que cargue los insumos."}</p>
      ) : visibles.length === 0 ? (
        <p className="adm-vacio">Ningún insumo coincide.</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Insumo</th><th className="adm-num">Existencia</th><th className="adm-num">Costo promedio</th><th className="adm-num">Valor</th><th>Estado</th>{(cap.registrar || cap.gestionar) && <th />}</tr>
            </thead>
            <tbody>
              {visibles.map((i) => {
                const alerta = alertaDeInsumo(i);
                return (
                  <tr key={i.id} className={i.activo ? "" : "adm-fila--baja"}>
                    <td>
                      <span className="adm-plato"><span>{i.nombre}<small>{i.codigo}{i.presentaciones.length ? ` · ${i.presentaciones.map((p) => `${p.nombre} = ${textoCantidad(p.factor, i.unidad)}`).join(", ")}` : ""}</small></span></span>
                    </td>
                    <td className="adm-num">{textoCantidad(i.existencia, i.unidad)}</td>
                    <td className="adm-num">{i.costoPromedio > 0 ? `${textoCostoUnitario(i.costoPromedio)} / ${i.unidad}` : "—"}</td>
                    <td className="adm-num">{textoDinero(i.valor)}</td>
                    <td>{!i.activo ? "desactivado" : alerta ? <span className="adm-etiqueta adm-etiqueta--alerta">{alerta}</span> : "bien"}</td>
                    {(cap.registrar || cap.gestionar) && (
                      <td className="adm-celda-acciones">
                        {i.activo && puede("registrar") && <button type="button" className="adm-btn" onClick={() => abrirAccion("compra", i)}>Compra</button>}
                        {i.activo && puede("registrar") && <button type="button" className="adm-btn" onClick={() => abrirAccion("merma", i)}>Merma</button>}
                        {i.activo && puede("gestionar") && <button type="button" className="adm-btn" onClick={() => abrirAccion("conteo", i)}>Conteo</button>}
                        {i.activo && puede("gestionar") && i.existencia === 0 && i.costoPromedio === 0 && <button type="button" className="adm-btn" onClick={() => abrirAccion("inicial", i)}>Saldo inicial</button>}
                        {puede("gestionar") && <button type="button" className="adm-btn" onClick={() => editar(i)}>Editar</button>}
                        {puede("gestionar") && (i.activo ? <button type="button" className="adm-btn" onClick={() => cambiarActivo(i, false)}>Desactivar</button> : <button type="button" className="adm-btn" onClick={() => cambiarActivo(i, true)}>Reactivar</button>)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
