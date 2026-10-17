import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo } from "./piezas.jsx";
import { TIPOS_BENEFICIO, formularioDeBeneficio, formularioDeReto, parsearBeneficio, parsearNiveles, parsearPuntosPorUnidad, parsearReto, textoNiveles } from "./formato.js";

// Sección Fidelización (5.30): las reglas de los puntos y los niveles de la empresa, y los beneficios que el
// cliente puede canjear por un vale. Retos (5.31): «prueba toda una categoría de la carta y gana un vale». Ver pide fidelizacion:canjear o gestionar; cambiar, fidelizacion:gestionar.

export function normalizarBeneficio(b) {
  return {
    id: String(b?.id ?? ""),
    nombre: b?.nombre ?? "",
    descripcion: b?.descripcion ?? null,
    puntos: b?.puntos ?? 0,
    tipo: b?.tipo ?? "",
    valor: b?.valor ?? null,
    itemCodigo: b?.itemCodigo ?? null,
    vigenciaDias: b?.vigenciaDias ?? 30,
    activo: b?.activo !== false,
    texto: b?.texto ?? "",
  };
}

export function normalizarReto(r) {
  return {
    id: String(r?.id ?? ""),
    nombre: r?.nombre ?? "",
    descripcion: r?.descripcion ?? null,
    categoria: r?.categoria ?? "",
    tipo: r?.tipo ?? "",
    valor: r?.valor ?? null,
    itemCodigo: r?.itemCodigo ?? null,
    vigenciaDias: r?.vigenciaDias ?? 30,
    activo: r?.activo !== false,
    texto: r?.texto ?? "",
  };
}

export default function Fidelizacion({ cap }) {
  const [config, setConfig] = useState(null);
  const [beneficios, setBeneficios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [reglas, setReglas] = useState({ habilitada: true, puntosPorUnidad: "1", niveles: "" });
  const [formulario, setFormulario] = useState(null); // { id?, datos }
  const [retos, setRetos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [formularioReto, setFormularioReto] = useState(null); // { id?, datos }
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, b, r, cats] = await Promise.all([
        api.get("clientes/fidelizacion/config"),
        api.get("clientes/beneficios"),
        api.get("clientes/retos").catch(() => []),
        api.get("catalogo/categorias").catch(() => []),
      ]);
      setConfig(c);
      setRetos(comoLista(r?.retos ?? r).map(normalizarReto));
      setCategorias(comoLista(cats).map((x) => (typeof x === "string" ? x : x?.categoria ?? x?.nombre ?? "")).filter(Boolean));
      setReglas({ habilitada: c.habilitada !== false, puntosPorUnidad: String(c.puntosPorUnidad ?? 1), niveles: textoNiveles(c.niveles) });
      setBeneficios(comoLista(b).map(normalizarBeneficio));
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

  async function guardarReglas(ev) {
    ev.preventDefault();
    const p = parsearPuntosPorUnidad(reglas.puntosPorUnidad);
    if (!p.ok) return setError("Los puntos por unidad deben ser un número mayor que 0 y de hasta 1000.");
    const n = parsearNiveles(reglas.niveles);
    if (!n.ok) return setError(n.error);
    setEnviando(true);
    setError("");
    setOk("");
    try {
      await api.put("clientes/fidelizacion/config", { habilitada: reglas.habilitada, puntosPorUnidad: p.valor, niveles: n.niveles });
      setOk("Reglas guardadas.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function guardarBeneficio(ev) {
    ev.preventDefault();
    const r = parsearBeneficio(formulario.datos);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    setOk("");
    try {
      if (formulario.id) await api.put(`clientes/beneficios/${formulario.id}`, r.cuerpo);
      else await api.post("clientes/beneficios", r.cuerpo);
      setOk(formulario.id ? "Beneficio actualizado." : "Beneficio creado.");
      setFormulario(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActivo(b, activo) {
    setError("");
    setOk("");
    try {
      await api.put(`clientes/beneficios/${b.id}`, { activo });
      setOk(activo ? "Beneficio activado." : "Beneficio retirado: los vales ya emitidos siguen sirviendo.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  async function guardarReto(ev) {
    ev.preventDefault();
    const r = parsearReto(formularioReto.datos);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    setOk("");
    try {
      if (formularioReto.id) await api.put(`clientes/retos/${formularioReto.id}`, r.cuerpo);
      else await api.post("clientes/retos", r.cuerpo);
      setOk(formularioReto.id ? "Reto actualizado." : "Reto creado.");
      setFormularioReto(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActivoReto(r, activo) {
    setError("");
    setOk("");
    try {
      await api.put(`clientes/retos/${r.id}`, { activo });
      setOk(activo ? "Reto activado." : "Reto retirado: los vales ya ganados siguen sirviendo.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  const campoReto = (k) => (e) => setFormularioReto((f) => ({ ...f, datos: { ...f.datos, [k]: e.target.value } }));
  const dr = formularioReto?.datos;
  const campo = (k) => (e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, [k]: e.target.value } }));
  const d = formulario?.datos;

  return (
    <section aria-labelledby="t-fidelizacion">
      <header className="adm-cabecera">
        <h2 id="t-fidelizacion">Fidelización</h2>
        {cap.gestionar && (
          <div className="adm-acciones">
            <button type="button" className="adm-btn adm-btn--primario" onClick={() => { setFormularioReto(null); setFormulario({ datos: formularioDeBeneficio(null) }); }}>
              Nuevo beneficio
            </button>
            <button type="button" className="adm-btn" onClick={() => { setFormulario(null); setFormularioReto({ datos: formularioDeReto(null) }); }}>
              Nuevo reto
            </button>
          </div>
        )}
      </header>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : (
        <>
          <form className="adm-form" onSubmit={guardarReglas}>
            <h3>Reglas de puntos</h3>
            <label className="adm-check">
              <input type="checkbox" disabled={!cap.gestionar} checked={reglas.habilitada} onChange={(e) => setReglas({ ...reglas, habilitada: e.target.checked })} />
              El programa de puntos está activo
            </label>
            <Campo etiqueta="Puntos por cada unidad de moneda" ayuda="Por ejemplo 1: S/ 10 de consumo dan 10 puntos. Los puntos solo se ganan con el consentimiento del cliente.">
              <input inputMode="decimal" disabled={!cap.gestionar} value={reglas.puntosPorUnidad} onChange={(e) => setReglas({ ...reglas, puntosPorUnidad: e.target.value })} />
            </Campo>
            <Campo etiqueta="Niveles (opcional)" ayuda="Uno por línea, «Nombre: puntos acumulados para entrar», de menos a más. Cuentan lo ganado consumiendo, no lo canjeado. Vacío = sin niveles.">
              <textarea rows={4} disabled={!cap.gestionar} placeholder={"Bronce: 0\nPlata: 500\nOro: 2000"} value={reglas.niveles} onChange={(e) => setReglas({ ...reglas, niveles: e.target.value })} />
            </Campo>
            {cap.gestionar && (
              <div className="adm-acciones">
                <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar reglas"}</button>
              </div>
            )}
          </form>

          {formulario && (
            <form className="adm-form" onSubmit={guardarBeneficio}>
              <h3>{formulario.id ? `Editar «${d.nombre}»` : "Nuevo beneficio"}</h3>
              <Campo etiqueta="Nombre"><input required maxLength={80} value={d.nombre} onChange={campo("nombre")} /></Campo>
              <Campo etiqueta="Descripción (opcional)" ayuda="Lo que lee el cliente al canjear."><input maxLength={200} value={d.descripcion} onChange={campo("descripcion")} /></Campo>
              <Campo etiqueta="Costo en puntos"><input required inputMode="numeric" value={d.puntos} onChange={campo("puntos")} /></Campo>
              <Campo etiqueta="¿Qué da?">
                <select value={d.tipo} onChange={campo("tipo")}>
                  {TIPOS_BENEFICIO.map(([id, titulo]) => (<option key={id} value={id}>{titulo}</option>))}
                </select>
              </Campo>
              {d.tipo === "item_gratis" ? (
                <Campo etiqueta="Código del plato gratis" ayuda="El código del catálogo. El mesero solo puede aplicar este vale a ese plato y se descuenta una unidad.">
                  <input required maxLength={60} value={d.itemCodigo} onChange={campo("itemCodigo")} />
                </Campo>
              ) : (
                <Campo etiqueta={d.tipo === "descuento_porcentaje" ? "Porcentaje de descuento (1 a 100)" : "Monto de descuento"} ayuda="El mesero lo aplica a un ítem del pedido; nunca descuenta más de lo que cuesta ese ítem.">
                  <input required inputMode="decimal" value={d.valor} onChange={campo("valor")} />
                </Campo>
              )}
              <Campo etiqueta="Días de vigencia del vale" ayuda="Desde que el cliente lo canjea. Pasado ese plazo ya no sirve.">
                <input required inputMode="numeric" value={d.vigenciaDias} onChange={campo("vigenciaDias")} />
              </Campo>
              <div className="adm-acciones">
                <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
                <button type="button" className="adm-btn" onClick={() => setFormulario(null)}>Cancelar</button>
              </div>
            </form>
          )}

          {formularioReto && (
            <form className="adm-form" onSubmit={guardarReto}>
              <h3>{formularioReto.id ? `Editar reto «${dr.nombre}»` : "Nuevo reto"}</h3>
              <Campo etiqueta="Nombre"><input required maxLength={80} value={dr.nombre} onChange={campoReto("nombre")} /></Campo>
              <Campo etiqueta="Descripción (opcional)" ayuda="Lo que lee el cliente, por ejemplo «Prueba todos nuestros cafés»."><input maxLength={200} value={dr.descripcion} onChange={campoReto("descripcion")} /></Campo>
              <Campo etiqueta="Categoría de la carta que hay que probar" ayuda="El cliente gana el premio cuando ha pagado cada plato activo de esta categoría. Si agregas un plato a la categoría, también cuenta para los que aún no lo ganaron.">
                <input required maxLength={60} list="adm-categorias-reto" value={dr.categoria} onChange={campoReto("categoria")} />
                <datalist id="adm-categorias-reto">{categorias.map((c) => (<option key={c} value={c} />))}</datalist>
              </Campo>
              <Campo etiqueta="Premio: ¿qué da?">
                <select value={dr.tipo} onChange={campoReto("tipo")}>
                  {TIPOS_BENEFICIO.map(([id, titulo]) => (<option key={id} value={id}>{titulo}</option>))}
                </select>
              </Campo>
              {dr.tipo === "item_gratis" ? (
                <Campo etiqueta="Código del plato gratis" ayuda="El código del catálogo. Se descuenta una unidad.">
                  <input required maxLength={60} value={dr.itemCodigo} onChange={campoReto("itemCodigo")} />
                </Campo>
              ) : (
                <Campo etiqueta={dr.tipo === "descuento_porcentaje" ? "Porcentaje de descuento (1 a 100)" : "Monto de descuento"}>
                  <input required inputMode="decimal" value={dr.valor} onChange={campoReto("valor")} />
                </Campo>
              )}
              <Campo etiqueta="Días de vigencia del vale" ayuda="Desde que el cliente lo gana.">
                <input required inputMode="numeric" value={dr.vigenciaDias} onChange={campoReto("vigenciaDias")} />
              </Campo>
              <div className="adm-acciones">
                <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
                <button type="button" className="adm-btn" onClick={() => setFormularioReto(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <h3>Beneficios</h3>
          {beneficios.length === 0 ? (
            <p className="adm-vacio">Todavía no hay beneficios. Crea uno para que los clientes puedan canjear sus puntos.</p>
          ) : (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <thead>
                  <tr><th>Beneficio</th><th>Qué da</th><th className="adm-num">Puntos</th><th className="adm-num">Vigencia</th>{cap.gestionar && <th />}</tr>
                </thead>
                <tbody>
                  {beneficios.map((b) => (
                    <tr key={b.id} className={b.activo ? "" : "adm-fila--baja"}>
                      <td>{b.nombre}{!b.activo && <em> (retirado)</em>}{b.descripcion && <small className="adm-falta" style={{ display: "block" }}>{b.descripcion}</small>}</td>
                      <td>{b.texto}</td>
                      <td className="adm-num">{b.puntos}</td>
                      <td className="adm-num">{b.vigenciaDias} d</td>
                      {cap.gestionar && (
                        <td className="adm-celda-acciones">
                          <button type="button" className="adm-btn" onClick={() => { setFormularioReto(null); setFormulario({ id: b.id, datos: formularioDeBeneficio(b) }); }}>Editar</button>
                          {b.activo ? (
                            <BotonConfirmar etiqueta="Retirar" peligro confirmar="¿Retirar?" onConfirmar={() => cambiarActivo(b, false)} />
                          ) : (
                            <button type="button" className="adm-btn" onClick={() => cambiarActivo(b, true)}>Activar</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3>Retos</h3>
          {retos.length === 0 ? (
            <p className="adm-vacio">Todavía no hay retos. Un reto regala un vale a quien prueba todo lo de una categoría, por ejemplo cada café de la carta.</p>
          ) : (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <thead>
                  <tr><th>Reto</th><th>Categoría</th><th>Premio</th><th className="adm-num">Vigencia</th>{cap.gestionar && <th />}</tr>
                </thead>
                <tbody>
                  {retos.map((r) => (
                    <tr key={r.id} className={r.activo ? "" : "adm-fila--baja"}>
                      <td>{r.nombre}{!r.activo && <em> (retirado)</em>}{r.descripcion && <small className="adm-falta" style={{ display: "block" }}>{r.descripcion}</small>}</td>
                      <td>{r.categoria}</td>
                      <td>{r.texto}</td>
                      <td className="adm-num">{r.vigenciaDias} d</td>
                      {cap.gestionar && (
                        <td className="adm-celda-acciones">
                          <button type="button" className="adm-btn" onClick={() => { setFormulario(null); setFormularioReto({ id: r.id, datos: formularioDeReto(r) }); }}>Editar</button>
                          {r.activo ? (
                            <BotonConfirmar etiqueta="Retirar" peligro confirmar="¿Retirar?" onConfirmar={() => cambiarActivoReto(r, false)} />
                          ) : (
                            <button type="button" className="adm-btn" onClick={() => cambiarActivoReto(r, true)}>Activar</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {config && !config.habilitada && <p className="adm-nota">El programa está desactivado: no se acumulan puntos ni se emiten vales.</p>}
        </>
      )}
    </section>
  );
}
