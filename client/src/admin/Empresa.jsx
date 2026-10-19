import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo } from "./piezas.jsx";
import { normalizarRol } from "./Equipo.jsx";
import { empresaActiva } from "./permisos.js";
import Marca from "./Marca.jsx";
import DatosEmpresa from "./DatosEmpresa.jsx";

// Sección Empresa: datos básicos (solo lectura: aún no hay ruta para editar la
// empresa, 5.20/5.10) y roles de la empresa con CRUD si hay `rol:gestionar` (5.14).

const NOMBRE_ROL = /^[\p{L}\p{N} _.-]{2,40}$/u;
const PERMISO = /^[a-z][a-z0-9_]*:([a-z0-9_]+|\*)$|^\*$/;

export function parsearPermisos(texto) {
  const lista = String(texto ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const unicos = [...new Set(lista)];
  const malos = unicos.filter((p) => !PERMISO.test(p));
  return { permisos: unicos, malos };
}

const VACIO = { nombre: "", permisos: "" };

export default function Empresa({ yo, capRoles, capMarca = {}, capDatos = {} }) {
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [formulario, setFormulario] = useState(null);

  const cargar = useCallback(async () => {
    if (!capRoles.ver) return;
    setCargando(true);
    try {
      setRoles(comoLista(await api.get("empleados/roles")).map(normalizarRol));
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCargando(false);
    }
  }, [capRoles.ver]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(ev) {
    ev.preventDefault();
    const { modo, id, datos } = formulario;
    const nombre = datos.nombre.trim();
    const { permisos, malos } = parsearPermisos(datos.permisos);
    if (!NOMBRE_ROL.test(nombre)) return setError("El nombre del rol debe tener entre 2 y 40 caracteres.");
    if (malos.length) return setError(`Permisos con formato inválido: ${malos.join(", ")}. Usa recurso:accion.`);
    if (permisos.length === 0) return setError("Indica al menos un permiso.");
    setError("");
    try {
      if (modo === "crear") await api.post("empleados/roles", { nombre, permisos });
      else await api.put(`empleados/roles/${id}`, { nombre, permisos });
      setOk(modo === "crear" ? "Rol creado." : "Rol actualizado.");
      setFormulario(null);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  async function eliminar(id) {
    setError("");
    try {
      await api.del(`empleados/roles/${id}`);
      setOk("Rol eliminado.");
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err)); // p. ej. ROL_EN_USO: el mensaje del núcleo lo explica
    }
  }

  const empresa = empresaActiva(yo) ?? {};
  const servicios = Array.isArray(yo?.servicios) ? yo.servicios : [];
  const esAdminRol = (r) => r.permisos.includes("*"); // los roles con * no se editan ni se borran (5.14)

  return (
    <section aria-labelledby="t-empresa">
      <header className="adm-cabecera"><h2 id="t-empresa">Empresa</h2></header>

      <dl className="adm-datos">
        <dt>Nombre</dt><dd>{empresa.nombre ?? "—"}</dd>
        <dt>Tu rol</dt><dd>{empresa.rol ?? "—"}</dd>
        <dt>Servicios activos</dt><dd>{servicios.length ? servicios.join(", ") : "Ninguno"}</dd>
        <dt>PIN de tablet</dt><dd>{yo?.pinHabilitado ? "Habilitado" : "No habilitado"}</dd>
      </dl>
      <p className="adm-nota">
        El nombre, el país y la moneda de la empresa todavía no se pueden editar desde aquí: se cambian por código.
        La marca de la carta (logo, eslogan y colores) y los datos de los recibos sí se editan abajo, si tu rol lo permite.
      </p>

      {capMarca.gestionar && <Marca nombre={empresa.nombre} />}
      {capDatos.gestionar && <DatosEmpresa />}

      {capRoles.ver && (
        <>
          <header className="adm-cabecera">
            <h3>Roles</h3>
            {capRoles.gestionar && (
              <button type="button" className="adm-btn adm-btn--primario" onClick={() => setFormulario({ modo: "crear", datos: VACIO })}>Nuevo rol</button>
            )}
          </header>
          <Aviso onCerrar={() => setError("")}>{error}</Aviso>
          <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

          {formulario && (
            <form className="adm-form" onSubmit={guardar}>
              <h3>{formulario.modo === "crear" ? "Nuevo rol" : "Editar rol"}</h3>
              <Campo etiqueta="Nombre">
                <input required value={formulario.datos.nombre} onChange={(e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, nombre: e.target.value } }))} />
              </Campo>
              <Campo etiqueta="Permisos" ayuda="Separados por coma o espacio, formato recurso:accion (ej. catalogo:leer, documento:*). Solo puedes dar permisos que tú tienes.">
                <textarea rows={3} value={formulario.datos.permisos} onChange={(e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, permisos: e.target.value } }))} />
              </Campo>
              <div className="adm-acciones">
                <button type="submit" className="adm-btn adm-btn--primario">Guardar</button>
                <button type="button" className="adm-btn" onClick={() => setFormulario(null)}>Cancelar</button>
              </div>
            </form>
          )}

          {cargando ? (
            <p className="adm-vacio">Cargando…</p>
          ) : (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <thead><tr><th>Rol</th><th>Permisos</th>{capRoles.gestionar && <th />}</tr></thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td className="adm-permisos">{r.permisos.map((p) => (<code key={p}>{p}</code>))}</td>
                      {capRoles.gestionar && (
                        <td className="adm-celda-acciones">
                          {!esAdminRol(r) && (
                            <>
                              <button type="button" className="adm-btn" onClick={() => setFormulario({ modo: "editar", id: r.id, datos: { nombre: r.nombre, permisos: r.permisos.join(", ") } })}>Editar</button>
                              <BotonConfirmar etiqueta="Eliminar" peligro onConfirmar={() => eliminar(r.id)} />
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
