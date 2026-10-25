import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, Campo, FotoPlato } from "./piezas.jsx";
import {
  MAX_ANUNCIOS_ACTIVOS, MAX_DESCRIPCION_ANUNCIO, MAX_LUGAR, MAX_TITULO, TIPOS_ANUNCIO,
  estadoAnuncio, formularioDeAnuncio, hoyDeNavegador, normalizarAnuncio, parsearAnuncio, textoCuandoAnuncio,
} from "./anuncios-logica.js";

// Sección Anuncios (5.49): eventos (un concierto) y publicidad (un aviso) que salen en la carta pública del restaurante.
// Ver pide anuncio:leer; crear, editar y pausar, anuncio:gestionar. Nunca se borran: se pausan.
export default function Anuncios({ cap }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [formulario, setFormulario] = useState(null); // { id?, datos }
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLista(comoLista((await api.get("anuncios"))?.anuncios ?? []).map(normalizarAnuncio));
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

  const hoy = hoyDeNavegador();
  const activos = lista.filter((a) => a.activo).length;
  const d = formulario?.datos;
  const campo = (k) => (e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, [k]: e.target.value } }));

  async function guardar(ev) {
    ev.preventDefault();
    const r = parsearAnuncio(formulario.datos);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    setOk("");
    try {
      if (formulario.id) await api.put(`anuncios/${formulario.id}`, r.cuerpo);
      else await api.post("anuncios", r.cuerpo);
      setOk(formulario.id ? "Anuncio actualizado." : "Anuncio creado.");
      setFormulario(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarActivo(a, activo) {
    setError("");
    setOk("");
    try {
      await api.put(`anuncios/${a.id}`, { activo });
      setOk(activo ? "Anuncio activado: ya sale en la carta." : "Anuncio pausado: ya no sale en la carta, pero se conserva.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  return (
    <section aria-labelledby="t-anuncios">
      <header className="adm-cabecera">
        <h2 id="t-anuncios">Anuncios</h2>
        {cap.gestionar && (
          <div className="adm-acciones">
            <button type="button" className="adm-btn adm-btn--primario" onClick={() => { setOk(""); setError(""); setFormulario({ datos: formularioDeAnuncio(null) }); }}>
              Nuevo anuncio
            </button>
          </div>
        )}
      </header>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      <p className="adm-nota">
        Lo que anuncias sale en la carta que ven tus clientes: los eventos (un concierto, una noche de karaoke) hasta que pasa su día, y la publicidad mientras esté vigente.
      </p>

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : (
        <>
          {formulario && (
            <form className="adm-form" onSubmit={guardar}>
              <h3>{formulario.id ? `Editar «${d.titulo}»` : "Nuevo anuncio"}</h3>
              <Campo etiqueta="Tipo" ayuda={formulario.id ? "El tipo no se cambia: si te equivocaste, pausa este y crea otro." : undefined}>
                <select value={d.tipo} onChange={campo("tipo")} disabled={Boolean(formulario.id)}>
                  {TIPOS_ANUNCIO.map(([id, titulo]) => (<option key={id} value={id}>{titulo}</option>))}
                </select>
              </Campo>
              <Campo etiqueta="Título" ayuda={d.tipo === "evento" ? "Por ejemplo «Jazz en vivo con Trío Lima»." : "Por ejemplo «Happy hour doble de lunes a jueves»."}>
                <input required maxLength={MAX_TITULO} value={d.titulo} onChange={campo("titulo")} />
              </Campo>
              <Campo etiqueta="Descripción (opcional)">
                <textarea rows={3} maxLength={MAX_DESCRIPCION_ANUNCIO} value={d.descripcion} onChange={campo("descripcion")} />
              </Campo>

              {d.tipo === "evento" ? (
                <>
                  <span className="adm-fila-form">
                    <Campo etiqueta="Día"><input required type="date" value={d.fecha} onChange={campo("fecha")} /></Campo>
                    <Campo etiqueta="Hora"><input required type="time" value={d.hora} onChange={campo("hora")} /></Campo>
                  </span>
                  <Campo etiqueta="Lugar (opcional)" ayuda="Si lo dejas vacío, se entiende que es en el local.">
                    <input maxLength={MAX_LUGAR} value={d.lugar} onChange={campo("lugar")} />
                  </Campo>
                </>
              ) : (
                <fieldset className="adm-cuando">
                  <legend>Cuándo se muestra (opcional)</legend>
                  <span className="adm-fila-form">
                    <Campo etiqueta="Desde el día"><input type="date" value={d.desde} onChange={campo("desde")} /></Campo>
                    <Campo etiqueta="Hasta el día" ayuda="Incluido."><input type="date" value={d.hasta} onChange={campo("hasta")} /></Campo>
                  </span>
                  <small className="adm-nota">Sin fechas, se muestra siempre.</small>
                </fieldset>
              )}

              <Campo etiqueta="Foto (opcional)" ayuda="La dirección de una imagen que empiece con https://. No se suben archivos.">
                <input inputMode="url" value={d.imagen} onChange={campo("imagen")} />
              </Campo>
              <FotoPlato url={d.imagen.trim().startsWith("https://") ? d.imagen.trim() : ""} alt="" className="adm-foto adm-foto--previa" />

              <label className="adm-check">
                <input type="checkbox" checked={d.activo} onChange={(e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, activo: e.target.checked } }))} />
                Activo (sale en la carta)
              </label>

              <div className="adm-acciones">
                <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
                <button type="button" className="adm-btn" onClick={() => setFormulario(null)}>Cancelar</button>
              </div>
            </form>
          )}

          {lista.length === 0 ? (
            <p className="adm-vacio">Todavía no hay anuncios. Crea uno, por ejemplo el próximo concierto.</p>
          ) : (
            <>
              <p className="adm-nota">{activos} de {MAX_ANUNCIOS_ACTIVOS} activos.</p>
              <div className="adm-tabla-caja">
                <table className="adm-tabla">
                  <thead>
                    <tr><th>Anuncio</th><th>Tipo</th><th>Cuándo</th><th>Estado</th>{cap.gestionar && <th />}</tr>
                  </thead>
                  <tbody>
                    {lista.map((a) => {
                      const estado = estadoAnuncio(a, hoy);
                      return (
                        <tr key={a.id} className={estado === "en la carta" || estado === "próximamente" ? "" : "adm-fila--baja"}>
                          <td>
                            <span className="adm-plato">
                              <FotoPlato url={a.imagen} alt="" className="adm-foto adm-foto--mini" />
                              <span>
                                {a.titulo}
                                {a.descripcion && <small>{a.descripcion}</small>}
                              </span>
                            </span>
                          </td>
                          <td>{a.tipo === "evento" ? "Evento" : "Publicidad"}</td>
                          <td>{textoCuandoAnuncio(a)}</td>
                          <td>{estado}</td>
                          {cap.gestionar && (
                            <td className="adm-celda-acciones">
                              <button type="button" className="adm-btn" onClick={() => { setOk(""); setError(""); setFormulario({ id: a.id, datos: formularioDeAnuncio(a) }); }}>Editar</button>
                              {a.activo ? (
                                <button type="button" className="adm-btn" onClick={() => cambiarActivo(a, false)}>Pausar</button>
                              ) : (
                                <button type="button" className="adm-btn" onClick={() => cambiarActivo(a, true)}>Activar</button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
