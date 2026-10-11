import { useCallback, useEffect, useMemo, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo } from "./piezas.jsx";

// Sección Equipo: lista + alta + edición + cambio de rol + baja/reactivación.
// Rutas de 5.14 (/empleados). El núcleo es quien decide (regla de alcance);
// aquí solo se ocultan los botones que la persona no puede usar.

export function normalizarEmpleado(e) {
  const rol = e?.rol;
  return {
    id: String(e?.usuarioId ?? e?.id ?? e?._id ?? ""),
    nombre: e?.nombre ?? "",
    correo: e?.correo ?? "",
    telefono: e?.telefono ?? "",
    rol: typeof rol === "string" ? rol : rol?.nombre ?? "",
    activa: e?.activa !== false && e?.estado !== "inactivo" && e?.estado !== "suspendido",
    tienePin: Boolean(e?.tienePin ?? e?.pin),
  };
}

export function normalizarRol(r) {
  return {
    id: String(r?.rolId ?? r?.id ?? r?._id ?? r?.nombre ?? ""),
    nombre: r?.nombre ?? "",
    permisos: Array.isArray(r?.permisos) ? r.permisos : [],
  };
}

const VACIO = { nombre: "", correo: "", telefono: "", rol: "", pin: "" };

export default function Equipo({ cap, yoId }) {
  const [lista, setLista] = useState([]);
  const [roles, setRoles] = useState([]);
  const [verInactivos, setVerInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [temporal, setTemporal] = useState(null); // { nombre, password } se muestra una vez
  const [formulario, setFormulario] = useState(null); // null | { modo: "crear" | "editar", id?, datos }
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [e, r] = await Promise.all([
        api.get("empleados/", { inactivos: verInactivos ? 1 : undefined }),
        api.get("empleados/roles").catch(() => []),
      ]);
      setLista(comoLista(e).map(normalizarEmpleado));
      setRoles(comoLista(r).map(normalizarRol));
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCargando(false);
    }
  }, [verInactivos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(
    () => (verInactivos ? lista : lista.filter((x) => x.activa)),
    [lista, verInactivos]
  );

  async function accion(fn, mensaje) {
    setError("");
    setOk("");
    try {
      const res = await fn();
      if (mensaje) setOk(mensaje);
      await cargar();
      return res;
    } catch (err) {
      setError(mensajeAdmin(err));
      return null;
    }
  }

  async function guardar(ev) {
    ev.preventDefault();
    if (!formulario) return;
    const { modo, id, datos } = formulario;
    setEnviando(true);
    setError("");
    try {
      if (modo === "crear") {
        const cuerpo = { nombre: datos.nombre.trim(), correo: datos.correo.trim(), rol: datos.rol };
        if (datos.telefono.trim()) cuerpo.telefono = datos.telefono.trim();
        if (datos.pin.trim()) cuerpo.pin = datos.pin.trim();
        else cuerpo.generarPassword = true; // contraseña temporal, se muestra una sola vez (5.14)
        const res = await api.post("empleados/", cuerpo);
        const pass = res?.passwordTemporal ?? res?.password ?? res?.contrasenaTemporal ?? null;
        if (pass) setTemporal({ nombre: cuerpo.nombre, password: pass });
        setOk("Empleado creado.");
      } else {
        const cuerpo = { nombre: datos.nombre.trim(), telefono: datos.telefono.trim() };
        await api.put(`empleados/${id}`, cuerpo);
        const original = lista.find((x) => x.id === id);
        if (original && datos.rol && datos.rol !== original.rol) {
          await api.put(`empleados/${id}/rol`, { rol: datos.rol });
        }
        setOk("Cambios guardados.");
      }
      setFormulario(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  const campo = (k) => (e) =>
    setFormulario((f) => ({ ...f, datos: { ...f.datos, [k]: e.target.value } }));

  return (
    <section aria-labelledby="t-equipo">
      <header className="adm-cabecera">
        <h2 id="t-equipo">Equipo</h2>
        <div className="adm-acciones">
          <label className="adm-check">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Ver dados de baja
          </label>
          {cap.crear && (
            <button
              type="button"
              className="adm-btn adm-btn--primario"
              onClick={() => setFormulario({ modo: "crear", datos: { ...VACIO, rol: roles[0]?.nombre ?? "" } })}
            >
              Nuevo empleado
            </button>
          )}
        </div>
      </header>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

      {temporal && (
        <Aviso tipo="info" onCerrar={() => setTemporal(null)}>
          Contraseña temporal de {temporal.nombre}: <code>{temporal.password}</code>. Se muestra solo ahora:
          entrégala por un medio seguro; la persona deberá cambiarla al entrar.
        </Aviso>
      )}

      {formulario && (
        <form className="adm-form" onSubmit={guardar}>
          <h3>{formulario.modo === "crear" ? "Nuevo empleado" : "Editar empleado"}</h3>
          <Campo etiqueta="Nombre">
            <input required value={formulario.datos.nombre} onChange={campo("nombre")} maxLength={120} />
          </Campo>
          <Campo etiqueta="Correo">
            <input
              required={formulario.modo === "crear"}
              type="email"
              value={formulario.datos.correo}
              onChange={campo("correo")}
              disabled={formulario.modo === "editar"}
            />
          </Campo>
          <Campo etiqueta="Teléfono (opcional)">
            <input value={formulario.datos.telefono} onChange={campo("telefono")} inputMode="tel" />
          </Campo>
          <Campo etiqueta="Rol">
            <select required value={formulario.datos.rol} onChange={campo("rol")}>
              <option value="" disabled>Elige un rol</option>
              {roles.map((r) => (
                <option key={r.id} value={r.nombre}>{r.nombre}</option>
              ))}
            </select>
          </Campo>
          {formulario.modo === "crear" && (
            <Campo
              etiqueta="PIN de tablet (opcional)"
              ayuda="Si lo dejas vacío se genera una contraseña temporal. Con PIN, la empresa debe tener el PIN habilitado."
            >
              <input value={formulario.datos.pin} onChange={campo("pin")} inputMode="numeric" pattern="[0-9]*" maxLength={6} />
            </Campo>
          )}
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="adm-btn" onClick={() => setFormulario(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="adm-vacio">No hay empleados para mostrar.</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>{(cap.editar || cap.baja) && <th />}</tr>
            </thead>
            <tbody>
              {visibles.map((e) => {
                const esYo = e.id === String(yoId ?? "");
                return (
                  <tr key={e.id} className={e.activa ? "" : "adm-fila--baja"}>
                    <td>{e.nombre}{esYo && <em> (tú)</em>}</td>
                    <td>{e.correo}</td>
                    <td>{e.rol}</td>
                    <td>{e.activa ? "Activo" : "De baja"}</td>
                    {(cap.editar || cap.baja) && (
                      <td className="adm-celda-acciones">
                        {cap.editar && e.activa && (
                          <button
                            type="button"
                            className="adm-btn"
                            onClick={() => setFormulario({ modo: "editar", id: e.id, datos: { nombre: e.nombre, correo: e.correo, telefono: e.telefono, rol: e.rol, pin: "" } })}
                          >
                            Editar
                          </button>
                        )}
                        {cap.baja && e.activa && !esYo && (
                          <BotonConfirmar
                            etiqueta="Dar de baja"
                            peligro
                            onConfirmar={() => accion(() => api.post(`empleados/${e.id}/desactivar`), "Empleado dado de baja.")}
                          />
                        )}
                        {cap.baja && !e.activa && (
                          <button type="button" className="adm-btn" onClick={() => accion(() => api.post(`empleados/${e.id}/reactivar`), "Empleado reactivado.")}>
                            Reactivar
                          </button>
                        )}
                        {cap.editar && e.activa && !esYo && (
                          <BotonConfirmar
                            etiqueta="Nueva contraseña"
                            confirmar="¿Cerrar sus sesiones y fijar otra temporal?"
                            onConfirmar={async () => {
                              const res = await accion(() => api.post(`empleados/${e.id}/password`, { generarPassword: true }));
                              const pass = res?.passwordTemporal ?? res?.password ?? res?.contrasenaTemporal;
                              if (pass) setTemporal({ nombre: e.nombre, password: pass });
                            }}
                          />
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
    </section>
  );
}
