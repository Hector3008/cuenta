import { useCallback, useEffect, useRef, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo } from "./piezas.jsx";
import {
  FILTROS_CLIENTES, FILTRO_CLIENTES_INICIAL, FINALIDADES, MEDIOS, MEDIO_INICIAL, REDES, TAMANO_PAGINA, TIPOS_IDENTIFICACION,
  contactoDe, cuerpoDeFormulario, estadoCliente, etiquetaFinalidad, etiquetaMedio, fechaCliente, formularioDe, hayMas, nombreMostrado,
  normalizarCliente, textoConsentimiento, textoDuplicado, textoVacioClientes,
} from "./clientes-logica.js";

// Sección Clientes (5.68): las fichas de la empresa. Ver pide cliente:leer; crear, cliente:crear; editar, cliente:editar; dar de baja,
// reactivar, registrar consentimientos y anonimizar, cliente:gestionar. Nunca se borra a nadie: la baja los oculta de la lista
// de «Activos» y de los selectores, y conserva sus pedidos. Anonimizar (pedido de supresión de datos) sí borra los datos y no se deshace.
export default function Clientes({ cap }) {
  const [filtro, setFiltro] = useState(FILTRO_CLIENTES_INICIAL);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState(""); // lo que se envió con «Buscar»
  const [lista, setLista] = useState([]);
  const [hayMasPaginas, setHayMasPaginas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [abierto, setAbierto] = useState(null); // null | "nuevo" | id del cliente
  const pedido = useRef(0); // descarta respuestas viejas si se busca rápido

  const cargar = useCallback(
    async ({ mas = false } = {}) => {
      const mio = ++pedido.current;
      setCargando(true);
      try {
        const saltar = mas ? lista.length : 0;
        const r = comoLista((await api.get("clientes", { q: busqueda, inactivos: filtro === "todos" ? "1" : "", limite: TAMANO_PAGINA, saltar: saltar || "" }))?.clientes ?? []).map(normalizarCliente);
        if (mio !== pedido.current) return;
        setLista((prev) => (mas ? [...prev, ...r] : r));
        setHayMasPaginas(hayMas(r.length));
        setError("");
      } catch (err) {
        if (mio === pedido.current) setError(mensajeAdmin(err));
      } finally {
        if (mio === pedido.current) setCargando(false);
      }
    },
    // `lista.length` solo se usa al pedir más; no debe disparar una recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busqueda, filtro],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  function buscar(e) {
    e.preventDefault();
    setBusqueda(texto.trim());
  }

  async function despuesDeGuardar(mensaje) {
    setOk(mensaje);
    setAbierto(null);
    await cargar();
  }

  return (
    <section aria-labelledby="t-clientes">
      <header className="adm-cabecera">
        <h2 id="t-clientes">Clientes</h2>
        <div className="adm-acciones">
          {FILTROS_CLIENTES.map(([id, titulo]) => (
            <button key={id} type="button" className={filtro === id ? "adm-btn adm-btn--primario" : "adm-btn"} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
              {titulo}
            </button>
          ))}
          {cap.crear && (
            <button type="button" className="adm-btn adm-btn--primario" onClick={() => { setOk(""); setAbierto("nuevo"); }}>
              Nuevo cliente
            </button>
          )}
        </div>
      </header>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

      <form className="adm-fila-form adm-busqueda" role="search" onSubmit={buscar}>
        <Campo etiqueta="Buscar" ayuda="Por nombre, teléfono (o sus últimos dígitos), correo o @usuario de una red.">
          <input type="search" value={texto} maxLength={100} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <button type="submit" className="adm-btn">Buscar</button>
        {busqueda && (
          <button type="button" className="adm-btn" onClick={() => { setTexto(""); setBusqueda(""); }}>Quitar búsqueda</button>
        )}
      </form>

      {abierto === "nuevo" && cap.crear && <FormularioCliente original={null} alCancelar={() => setAbierto(null)} alGuardar={() => despuesDeGuardar("Cliente creado.")} />}

      {cargando && lista.length === 0 ? (
        <p className="adm-vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="adm-vacio">{textoVacioClientes(busqueda, filtro)}</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Cliente</th><th>Contacto</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <FilaCliente key={c.id} c={c} abierta={abierto === c.id} cap={cap} alAbrir={() => { setOk(""); setAbierto(abierto === c.id ? null : c.id); }} alCambiar={despuesDeGuardar} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hayMasPaginas && (
        <p><button type="button" className="adm-btn" disabled={cargando} onClick={() => cargar({ mas: true })}>Ver más clientes</button></p>
      )}
    </section>
  );
}

function FilaCliente({ c, abierta, cap, alAbrir, alCambiar }) {
  return (
    <>
      <tr className={c.activo ? "" : "adm-fila--baja"}>
        <td>
          <strong>{nombreMostrado(c)}</strong>
          {c.tieneCuenta && <small className="adm-sub">Tiene cuenta en la carta</small>}
        </td>
        <td>{contactoDe(c) || "—"}</td>
        <td>{estadoCliente(c)}</td>
        <td className="adm-celda-acciones">
          <button type="button" className="adm-btn" aria-expanded={abierta} onClick={alAbrir}>{abierta ? "Cerrar" : "Ver ficha"}</button>
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={4}><Ficha id={c.id} cap={cap} alCambiar={alCambiar} /></td>
        </tr>
      )}
    </>
  );
}

// La ficha completa (con el historial de consentimientos) se pide al abrirla: la lista no lo trae.
function Ficha({ id, cap, alCambiar }) {
  const [c, setC] = useState(null);
  const [editando, setEditando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [medio, setMedio] = useState(MEDIO_INICIAL);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    try {
      setC(normalizarCliente(await api.get(`clientes/${encodeURIComponent(id)}`)));
      setAviso("");
    } catch (err) {
      setAviso(mensajeAdmin(err));
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(fn, mensajeFinal) {
    if (trabajando) return;
    setTrabajando(true);
    setAviso("");
    try {
      await fn();
      if (mensajeFinal) alCambiar(mensajeFinal);
      else await cargar();
    } catch (err) {
      const m = err?.codigo === "CLIENTE_DUPLICADO" ? textoDuplicado(err) : mensajeAdmin(err);
      setAviso(m);
    } finally {
      setTrabajando(false);
    }
  }

  if (!c) return <p className="adm-vacio">{aviso || "Cargando…"}</p>;
  if (editando && cap.editar)
    return <FormularioCliente original={c} alCancelar={() => setEditando(false)} alGuardar={() => alCambiar("Cambios guardados.")} />;

  const editable = !c.anonimizado && cap.editar;
  const gestionable = !c.anonimizado && cap.gestionar;
  return (
    <div className="adm-ficha">
      <Aviso onCerrar={() => setAviso("")}>{aviso}</Aviso>
      <dl className="adm-datos">
        <div><dt>Teléfono</dt><dd>{c.telefono ?? "—"}</dd></div>
        <div><dt>Correo</dt><dd>{c.correo ?? "—"}</dd></div>
        {REDES.map(([r, etiqueta]) => c.redes[r] && <div key={r}><dt>{etiqueta}</dt><dd>@{c.redes[r]}</dd></div>)}
        <div><dt>Documento</dt><dd>{c.identificacion ? `${c.identificacion.tipo} ${c.identificacion.numero}` : "—"}</dd></div>
        <div><dt>Dirección</dt><dd>{c.direccion ?? "—"}</dd></div>
        <div><dt>Registrado</dt><dd>{fechaCliente(c.creadoTs)}</dd></div>
      </dl>

      <h3>Consentimientos</h3>
      <ul className="adm-consentimientos">
        {FINALIDADES.map(([f, titulo, ayuda]) => {
          const k = c.consentimientos[f];
          return (
            <li key={f}>
              <div><strong>{titulo}</strong><small className="adm-sub">{ayuda}</small><small className="adm-sub">{textoConsentimiento(k)}</small></div>
              {gestionable && (
                <button
                  type="button"
                  className={k.otorgado ? "adm-btn adm-btn--peligro" : "adm-btn"}
                  disabled={trabajando || (!k.otorgado && !c.activo)}
                  onClick={() => accion(() => api.put(`clientes/${encodeURIComponent(c.id)}/consentimientos/${f}`, { otorgado: !k.otorgado, medio }))}
                >
                  {k.otorgado ? "Retirar" : "Registrar que acepta"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {gestionable && (
        <Campo etiqueta="Cómo lo dio" ayuda="Se anota junto al consentimiento que registres. Retirarlo siempre se puede.">
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            {MEDIOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </Campo>
      )}
      {c.historial && c.historial.length > 0 && (
        <details className="adm-historial">
          <summary>Historial de consentimientos ({c.historial.length})</summary>
          <ul>
            {[...c.historial].reverse().map((h, i) => (
              <li key={i}>{fechaCliente(h.ts)} · {etiquetaFinalidad(h.finalidad)}: {h.otorgado ? "aceptó" : "retiró"} ({etiquetaMedio(h.medio)})</li>
            ))}
          </ul>
        </details>
      )}

      <div className="adm-acciones adm-acciones--ficha">
        {editable && <button type="button" className="adm-btn adm-btn--primario" onClick={() => setEditando(true)}>Editar datos</button>}
        {gestionable && c.activo && (
          <BotonConfirmar etiqueta="Dar de baja" confirmar="Ya no saldrá en las listas; sus pedidos se conservan." disabled={trabajando} onConfirmar={() => accion(() => api.post(`clientes/${encodeURIComponent(c.id)}/desactivar`), "Cliente dado de baja.")} />
        )}
        {gestionable && !c.activo && (
          <button type="button" className="adm-btn" disabled={trabajando} onClick={() => accion(() => api.post(`clientes/${encodeURIComponent(c.id)}/reactivar`), "Cliente reactivado.")}>Reactivar</button>
        )}
        {gestionable && (
          <BotonConfirmar peligro etiqueta="Anonimizar" confirmar="Borra sus datos para siempre (pedido de supresión). No se puede deshacer. ¿Seguro?" disabled={trabajando} onConfirmar={() => accion(() => api.post(`clientes/${encodeURIComponent(c.id)}/anonimizar`), "Cliente anonimizado: sus datos se borraron.")} />
        )}
      </div>
      {c.anonimizado && <p className="adm-nota">Este cliente fue anonimizado: sus datos ya no existen y no se puede editar.</p>}
    </div>
  );
}

function FormularioCliente({ original, alCancelar, alGuardar }) {
  const [f, setF] = useState(() => formularioDe(original));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const poner = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    if (guardando) return;
    const r = cuerpoDeFormulario(f, original);
    if (r.error) return setError(r.error);
    setGuardando(true);
    setError("");
    try {
      if (original) await api.put(`clientes/${encodeURIComponent(original.id)}`, r.cuerpo);
      else await api.post("clientes", r.cuerpo);
      await alGuardar();
    } catch (err) {
      setError(err?.codigo === "CLIENTE_DUPLICADO" ? textoDuplicado(err) : mensajeAdmin(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="adm-form adm-form--ancho" onSubmit={enviar} noValidate>
      <h3>{original ? "Editar cliente" : "Nuevo cliente"}</h3>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Campo etiqueta="Nombre">
        <input type="text" value={f.nombre} maxLength={80} required autoFocus onChange={poner("nombre")} />
      </Campo>
      <div className="adm-fila-form">
        <Campo etiqueta="Teléfono" ayuda="Si es de otro país, empieza con + y el código (+54…).">
          <input type="tel" value={f.telefono} maxLength={30} autoComplete="off" onChange={poner("telefono")} />
        </Campo>
        <Campo etiqueta="Correo">
          <input type="email" value={f.correo} maxLength={254} autoComplete="off" onChange={poner("correo")} />
        </Campo>
      </div>
      <div className="adm-fila-form">
        {REDES.map(([r, etiqueta]) => (
          <Campo key={r} etiqueta={etiqueta} ayuda="Solo el usuario, o pega el enlace.">
            <input type="text" value={f[r]} maxLength={120} autoCapitalize="none" autoComplete="off" onChange={poner(r)} />
          </Campo>
        ))}
      </div>
      <div className="adm-fila-form">
        <Campo etiqueta="Tipo de documento">
          <select value={f.idTipo} onChange={poner("idTipo")}>
            <option value="">Ninguno</option>
            {f.idTipo && !TIPOS_IDENTIFICACION.includes(f.idTipo) && <option value={f.idTipo}>{f.idTipo}</option>}
            {TIPOS_IDENTIFICACION.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Número">
          <input type="text" value={f.idNumero} maxLength={30} autoComplete="off" onChange={poner("idNumero")} />
        </Campo>
      </div>
      <Campo etiqueta="Dirección">
        <input type="text" value={f.direccion} maxLength={200} autoComplete="off" onChange={poner("direccion")} />
      </Campo>
      {!original && <p className="adm-nota">Los consentimientos (puntos, redes) se registran desde la ficha, una vez creado el cliente.</p>}
      <div className="adm-acciones">
        <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        <button type="button" className="adm-btn" onClick={alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
