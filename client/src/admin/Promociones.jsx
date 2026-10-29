import { useCallback, useEffect, useRef, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import PruebaPromociones from "./PruebaPromociones.jsx";
import {
  DIAS_SEMANA, EFECTOS_PROMOCION, TIPOS_PROMOCION,
  formularioDePromocion, parsearPromocion, textoCuando, textoQueHace, textoTopes,
} from "./promociones-logica.js";

// Sección Promociones (5.41): descuentos automáticos sobre lo que lleva un pedido (2x1, «si lleva A, B con descuento»,
// descuento directo), con vigencia, días y horario. Ver pide promocion:leer; crear, editar y pausar, promocion:gestionar.
// Esta pantalla solo define y prueba las reglas: aplicarlas a los pedidos es de tobt (5.42), así que por ahora no cambian ningún cobro.

export const MAX_ACTIVAS = 100;

export function normalizarPromocion(p) {
  return {
    id: String(p?.id ?? ""),
    nombre: p?.nombre ?? "",
    descripcion: p?.descripcion ?? null,
    activa: p?.activa !== false,
    prioridad: p?.prioridad ?? 100,
    acumulable: p?.acumulable === true,
    tipo: p?.tipo ?? "",
    objetivo: p?.objetivo ?? null,
    disparador: p?.disparador ?? null,
    n: p?.n ?? null,
    m: p?.m ?? null,
    efecto: p?.efecto ?? null,
    valor: p?.valor ?? null,
    vigencia: p?.vigencia ?? null,
    dias: Array.isArray(p?.dias) ? p.dias : null,
    horario: p?.horario ?? null,
    topes: p?.topes ?? null,
  };
}

// «Un producto» o «una categoría» + su valor, con las opciones del catálogo como sugerencia.
function Selector({ etiqueta, ayuda, tipo, valor, alTipo, alValor, listaId }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <span className="adm-fila-form">
        <select aria-label={`${etiqueta}: qué se elige`} value={tipo} onChange={(e) => alTipo(e.target.value)}>
          <option value="item">Un producto (código)</option>
          <option value="categoria">Una categoría</option>
        </select>
        <input aria-label={`${etiqueta}: valor`} required maxLength={tipo === "categoria" ? 60 : 40} list={listaId[tipo]} value={valor} onChange={(e) => alValor(e.target.value)} />
      </span>
    </Campo>
  );
}

export default function Promociones({ cap }) {
  const [promos, setPromos] = useState([]);
  const [catalogo, setCatalogo] = useState(new Map()); // código en minúsculas → ítem
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [formulario, setFormulario] = useState(null); // { id?, datos }
  const [enviando, setEnviando] = useState(false);
  const [borrador, setBorrador] = useState(null); // la promoción sin guardar que se está probando
  const pruebaRef = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [r, items] = await Promise.all([
        api.get("promociones"),
        api.get("catalogo/", { limite: 200 }).catch(() => []),
      ]);
      setPromos(comoLista(r?.promociones ?? r).map(normalizarPromocion));
      setCatalogo(new Map(comoLista(items?.items ?? items).filter((i) => i?.codigo).map((i) => [String(i.codigo).toLowerCase(), i])));
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

  const categorias = [...new Set([...catalogo.values()].map((i) => i.categoria).filter(Boolean))];
  const activas = promos.filter((p) => p.activa).length;

  async function guardar(ev) {
    ev.preventDefault();
    const r = parsearPromocion(formulario.datos);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    setOk("");
    try {
      if (formulario.id) await api.put(`promociones/${formulario.id}`, r.cuerpo);
      else await api.post("promociones", r.cuerpo);
      setOk(formulario.id ? "Promoción actualizada." : "Promoción creada.");
      setFormulario(null);
      setBorrador(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActiva(p, activa) {
    setError("");
    setOk("");
    try {
      await api.put(`promociones/${p.id}`, { activa });
      setOk(activa ? "Promoción activada." : "Promoción pausada: ya no se aplica, pero se conserva.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  function probarBorrador() {
    const r = parsearPromocion(formulario.datos);
    if (!r.ok) return setError(r.error);
    setError("");
    setBorrador({ ...r.cuerpo, activa: true });
    pruebaRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const d = formulario?.datos;
  const campo = (k) => (e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, [k]: e.target.value } }));
  const poner = (k, v) => setFormulario((f) => ({ ...f, datos: { ...f.datos, [k]: v } }));
  const alternarDia = (dia) => setFormulario((f) => {
    const dias = f.datos.dias.includes(dia) ? f.datos.dias.filter((x) => x !== dia) : [...f.datos.dias, dia];
    return { ...f, datos: { ...f.datos, dias } };
  });
  const listaIds = { item: "adm-promo-codigos", categoria: "adm-promo-categorias" };

  return (
    <section aria-labelledby="t-promociones">
      <header className="adm-cabecera">
        <h2 id="t-promociones">Promociones</h2>
        {cap.gestionar && (
          <div className="adm-acciones">
            <button type="button" className="adm-btn adm-btn--primario" onClick={() => { setOk(""); setError(""); setFormulario({ datos: formularioDePromocion(null) }); }}>
              Nueva promoción
            </button>
          </div>
        )}
      </header>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      <p className="adm-nota">
        Descuentos automáticos sobre lo que lleva un pedido. Pedidos las aplica solo y las recalcula cada vez que cambia el pedido; aquí se definen y se prueban.
      </p>

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : (
        <>
          {formulario && (
            <form className="adm-form adm-form--ancho" onSubmit={guardar}>
              <h3>{formulario.id ? `Editar «${d.nombre}»` : "Nueva promoción"}</h3>
              <Campo etiqueta="Tipo">
                <select value={d.tipo} onChange={campo("tipo")}>
                  {TIPOS_PROMOCION.map(([id, titulo]) => (<option key={id} value={id}>{titulo}</option>))}
                </select>
              </Campo>
              <Campo etiqueta="Nombre" ayuda="Lo que ve el personal al aplicarse, por ejemplo «2x1 en lattes».">
                <input required maxLength={80} value={d.nombre} onChange={campo("nombre")} />
              </Campo>
              <Campo etiqueta="Descripción (opcional)"><input maxLength={200} value={d.descripcion} onChange={campo("descripcion")} /></Campo>

              {d.tipo === "combo" && (
                <Selector etiqueta="Si lleva" ayuda="Lo que dispara la promoción: por cada unidad, una del producto con descuento." tipo={d.disparadorTipo} valor={d.disparadorValor}
                  alTipo={(v) => poner("disparadorTipo", v)} alValor={(v) => poner("disparadorValor", v)} listaId={listaIds} />
              )}
              <Selector
                etiqueta={d.tipo === "combo" ? "Lo que recibe el descuento" : "Producto"}
                ayuda={d.tipo === "nxm" ? "Cuenta las unidades de este producto o de esta categoría. En cada grupo, las más baratas son las gratis." : undefined}
                tipo={d.objetivoTipo} valor={d.objetivoValor}
                alTipo={(v) => poner("objetivoTipo", v)} alValor={(v) => poner("objetivoValor", v)} listaId={listaIds} />

              {d.tipo === "nxm" ? (
                <span className="adm-fila-form">
                  <Campo etiqueta="Lleva" ayuda="2x1: lleva 2, paga 1."><input required inputMode="numeric" value={d.n} onChange={campo("n")} /></Campo>
                  <Campo etiqueta="Paga"><input required inputMode="numeric" value={d.m} onChange={campo("m")} /></Campo>
                </span>
              ) : (
                <span className="adm-fila-form">
                  <Campo etiqueta="Descuento">
                    <select value={d.efecto} onChange={campo("efecto")}>
                      {EFECTOS_PROMOCION.map(([id, titulo]) => (<option key={id} value={id}>{titulo}</option>))}
                    </select>
                  </Campo>
                  {d.efecto !== "gratis" && (
                    <Campo etiqueta={d.efecto === "porcentaje" ? "Porcentaje (1 a 100)" : "Monto por unidad"}>
                      <input required inputMode="decimal" value={d.valor} onChange={campo("valor")} />
                    </Campo>
                  )}
                </span>
              )}

              <fieldset className="adm-cuando">
                <legend>Cuándo rige (todo opcional)</legend>
                <span className="adm-fila-form">
                  <Campo etiqueta="Desde el día"><input type="date" value={d.desde} onChange={campo("desde")} /></Campo>
                  <Campo etiqueta="Hasta el día" ayuda="Incluido."><input type="date" value={d.hasta} onChange={campo("hasta")} /></Campo>
                </span>
                <div className="adm-dias" role="group" aria-label="Días de la semana">
                  {DIAS_SEMANA.map(([dia, nombre]) => (
                    <label key={dia} className="adm-check">
                      <input type="checkbox" checked={d.dias.includes(dia)} onChange={() => alternarDia(dia)} /> {nombre}
                    </label>
                  ))}
                </div>
                <small className="adm-nota">Sin marcar ningún día, rige todos.</small>
                <span className="adm-fila-form">
                  <Campo etiqueta="Desde las"><input type="time" value={d.horaDesde} onChange={campo("horaDesde")} /></Campo>
                  <Campo etiqueta="Hasta las" ayuda="Esa hora ya no cuenta. Puede cruzar la medianoche (22:00 a 02:00)."><input type="time" value={d.horaHasta} onChange={campo("horaHasta")} /></Campo>
                </span>
                <small className="adm-nota">Días y horas se leen con la hora de la empresa.</small>
              </fieldset>

              <fieldset className="adm-cuando">
                <legend>Límites de uso (opcional)</legend>
                <small className="adm-nota">Un uso es una unidad con descuento: un 2x1 aplicado a 4 cafés son 2 usos. Vacío = sin límite.</small>
                <span className="adm-fila-form">
                  <Campo etiqueta="Máximo por día" ayuda="En toda la empresa. Cuenta por día, a la hora de la empresa.">
                    <input inputMode="numeric" value={d.topeDiario} onChange={campo("topeDiario")} />
                  </Campo>
                  <Campo etiqueta="Máximo por pedido">
                    <input inputMode="numeric" value={d.topePedido} onChange={campo("topePedido")} />
                  </Campo>
                  <Campo etiqueta="Máximo por cliente y día" ayuda="Solo vale para pedidos con un cliente asociado.">
                    <input inputMode="numeric" value={d.topeCliente} onChange={campo("topeCliente")} />
                  </Campo>
                </span>
              </fieldset>

              <Campo etiqueta="Prioridad" ayuda="Si dos promociones coinciden en un producto, gana la de número menor. Un producto recibe una sola, salvo que ambas sean acumulables.">
                <input required inputMode="numeric" value={d.prioridad} onChange={campo("prioridad")} />
              </Campo>
              <label className="adm-check">
                <input type="checkbox" checked={d.acumulable} onChange={(e) => poner("acumulable", e.target.checked)} />
                Se puede sumar a otra promoción acumulable
              </label>
              <label className="adm-check">
                <input type="checkbox" checked={d.activa} onChange={(e) => poner("activa", e.target.checked)} />
                Activa
              </label>

              <div className="adm-acciones">
                <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
                <button type="button" className="adm-btn" onClick={probarBorrador}>Probar esta promoción</button>
                <button type="button" className="adm-btn" onClick={() => { setFormulario(null); setBorrador(null); }}>Cancelar</button>
              </div>
            </form>
          )}

          <datalist id="adm-promo-codigos">
            {[...catalogo.values()].map((i) => (<option key={i.codigo} value={i.codigo} label={i.nombre} />))}
          </datalist>
          <datalist id="adm-promo-categorias">
            {categorias.map((c) => (<option key={c} value={c} />))}
          </datalist>

          {promos.length === 0 ? (
            <p className="adm-vacio">Todavía no hay promociones. Crea una, por ejemplo un 2x1 en un producto.</p>
          ) : (
            <>
              <p className="adm-nota">{activas} de {MAX_ACTIVAS} activas.</p>
              <div className="adm-tabla-caja">
                <table className="adm-tabla">
                  <thead>
                    <tr><th>Promoción</th><th>Qué hace</th><th>Cuándo</th><th className="adm-num">Prioridad</th>{cap.gestionar && <th />}</tr>
                  </thead>
                  <tbody>
                    {promos.map((p) => (
                      <tr key={p.id} className={p.activa ? "" : "adm-fila--baja"}>
                        <td>
                          {p.nombre}{!p.activa && <em> (pausada)</em>}{p.acumulable && <small className="adm-falta" style={{ display: "block" }}>Acumulable</small>}
                          {p.descripcion && <small className="adm-falta" style={{ display: "block" }}>{p.descripcion}</small>}
                          {textoTopes(p) && <small className="adm-falta" style={{ display: "block" }}>{textoTopes(p)}</small>}
                        </td>
                        <td>{textoQueHace(p)}</td>
                        <td>{textoCuando(p)}</td>
                        <td className="adm-num">{p.prioridad}</td>
                        {cap.gestionar && (
                          <td className="adm-celda-acciones">
                            <button type="button" className="adm-btn" onClick={() => { setOk(""); setError(""); setBorrador(null); setFormulario({ id: p.id, datos: formularioDePromocion(p) }); }}>Editar</button>
                            {p.activa ? (
                              <button type="button" className="adm-btn" onClick={() => cambiarActiva(p, false)}>Pausar</button>
                            ) : (
                              <button type="button" className="adm-btn" onClick={() => cambiarActiva(p, true)}>Activar</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div ref={pruebaRef}>
            <PruebaPromociones catalogo={catalogo} borrador={borrador} alQuitarBorrador={() => setBorrador(null)} />
          </div>
        </>
      )}
    </section>
  );
}
