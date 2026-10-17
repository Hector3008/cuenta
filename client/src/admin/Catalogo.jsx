import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo, FotoPlato, MAX_DESCRIPCION, MAX_IMAGEN, esEnlaceDeDrive, formatoPrecio, parsearDescripcion, parsearImagen, parsearPrecio } from "./piezas.jsx";

// Sección Catálogo (5.16): búsqueda por código o nombre, filtro por categoría,
// alta, edición (el código no cambia) y baja/reactivación. Desde 5.29 también la descripción y la foto
// del plato (atributos DESCRIPCION e IMAGEN, los que lee la carta pública, 5.25): la foto es una URL
// https absoluta, no se suben archivos.

export function normalizarItem(i) {
  return {
    id: String(i?.itemId ?? i?.id ?? i?._id ?? ""),
    codigo: i?.codigo ?? "",
    nombre: i?.nombre ?? "",
    categoria: i?.categoria ?? "",
    precio: i?.precio ?? null,
    descripcion: typeof i?.atributos?.DESCRIPCION === "string" ? i.atributos.DESCRIPCION : "",
    imagen: typeof i?.atributos?.IMAGEN === "string" ? i.atributos.IMAGEN : "",
    activo: i?.activo !== false,
  };
}

const VACIO = { codigo: "", nombre: "", categoria: "", precio: "", descripcion: "", imagen: "" };

// Cómo se verá el plato en la carta pública. Solo muestra la foto si pasa la misma validación que la carta.
function VistaPrevia({ datos, moneda }) {
  const imagen = parsearImagen(datos.imagen);
  const precio = parsearPrecio(datos.precio);
  const descripcion = datos.descripcion.trim();
  return (
    <figure className="adm-previa" aria-label="Vista previa en la carta">
      <figcaption>Vista previa en la carta</figcaption>
      <FotoPlato url={imagen.ok ? imagen.valor : ""} alt="" className="adm-foto adm-foto--previa" />
      {!imagen.ok && <p className="adm-previa-aviso">La foto no es válida: la carta no la mostraría.</p>}
      <strong>{datos.nombre.trim() || "Nombre del plato"}</strong>
      {precio.ok && precio.valor !== null && <span className="adm-previa-precio">{formatoPrecio(precio.valor, moneda)}</span>}
      <p className={descripcion ? "" : "adm-nota"}>{descripcion || "Sin descripción."}</p>
    </figure>
  );
}

export default function Catalogo({ cap, moneda }) {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [lista, cats] = await Promise.all([
        api.get("catalogo/", { q: busca, categoria, inactivos: verInactivos ? 1 : undefined, limite: 200 }),
        api.get("catalogo/categorias").catch(() => []),
      ]);
      setItems(comoLista(lista).map(normalizarItem));
      setCategorias(comoLista(cats).map((c) => (typeof c === "string" ? c : c?.categoria ?? c?.nombre ?? "")).filter(Boolean));
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCargando(false);
    }
  }, [busca, categoria, verInactivos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(fn, mensaje) {
    setError("");
    setOk("");
    try {
      await fn();
      setOk(mensaje);
      await cargar();
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  async function guardar(ev) {
    ev.preventDefault();
    const { modo, id, datos } = formulario;
    const precio = parsearPrecio(datos.precio);
    if (!precio.ok) {
      setError("El precio debe ser un número de 0 en adelante con 2 decimales como máximo.");
      return;
    }
    const descripcion = parsearDescripcion(datos.descripcion);
    if (!descripcion.ok) {
      setError(`La descripción puede tener hasta ${MAX_DESCRIPCION} caracteres.`);
      return;
    }
    const imagen = parsearImagen(datos.imagen);
    if (!imagen.ok) {
      setError(`La foto debe ser una dirección completa que empiece con https:// (sin espacios ni usuario, hasta ${MAX_IMAGEN} caracteres).`);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      if (modo === "crear") {
        const cuerpo = { codigo: datos.codigo.trim(), nombre: datos.nombre.trim() };
        if (datos.categoria.trim()) cuerpo.categoria = datos.categoria.trim();
        if (precio.valor !== null) cuerpo.precio = precio.valor;
        const atributos = {};
        if (descripcion.valor !== null) atributos.DESCRIPCION = descripcion.valor;
        if (imagen.valor !== null) atributos.IMAGEN = imagen.valor;
        if (Object.keys(atributos).length) cuerpo.atributos = atributos;
        await api.post("catalogo/", cuerpo);
        setOk("Ítem creado.");
      } else {
        // null quita categoría y precio; el nombre no se puede quitar (5.16). Los atributos se combinan
        // clave por clave: un null quita solo esa clave y no toca los demás atributos del ítem.
        await api.put(`catalogo/${id}`, {
          nombre: datos.nombre.trim(),
          categoria: datos.categoria.trim() || null,
          precio: precio.valor,
          atributos: { DESCRIPCION: descripcion.valor, IMAGEN: imagen.valor },
        });
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

  const campo = (k) => (e) => setFormulario((f) => ({ ...f, datos: { ...f.datos, [k]: e.target.value } }));
  const conAcciones = cap.editar || cap.baja;

  return (
    <section aria-labelledby="t-catalogo">
      <header className="adm-cabecera">
        <h2 id="t-catalogo">Catálogo</h2>
        {cap.crear && (
          <button type="button" className="adm-btn adm-btn--primario" onClick={() => setFormulario({ modo: "crear", datos: VACIO })}>
            Nuevo ítem
          </button>
        )}
      </header>

      <form
        className="adm-filtros"
        onSubmit={(e) => {
          e.preventDefault();
          setBusca(q.trim());
        }}
      >
        <input type="search" placeholder="Buscar por código o nombre" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <button type="submit" className="adm-btn">Buscar</button>
        {cap.baja && (
          <label className="adm-check">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Ver dados de baja
          </label>
        )}
      </form>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

      {formulario && (
        <form className="adm-form" onSubmit={guardar}>
          <h3>{formulario.modo === "crear" ? "Nuevo ítem" : `Editar ${formulario.datos.codigo}`}</h3>
          <Campo etiqueta="Código" ayuda="Letras, números, . - _ /. No se puede cambiar después; no distingue mayúsculas.">
            <input required maxLength={40} value={formulario.datos.codigo} onChange={campo("codigo")} disabled={formulario.modo === "editar"} />
          </Campo>
          <Campo etiqueta="Nombre">
            <input required maxLength={200} value={formulario.datos.nombre} onChange={campo("nombre")} />
          </Campo>
          <Campo etiqueta="Categoría (opcional)">
            <input maxLength={60} list="adm-categorias" value={formulario.datos.categoria} onChange={campo("categoria")} />
            <datalist id="adm-categorias">{categorias.map((c) => (<option key={c} value={c} />))}</datalist>
          </Campo>
          <Campo etiqueta={moneda ? `Precio (${moneda}, opcional)` : "Precio (opcional)"} ayuda="Hasta 2 decimales. Vacío = sin precio.">
            <input inputMode="decimal" value={formulario.datos.precio} onChange={campo("precio")} />
          </Campo>
          <Campo etiqueta="Descripción del plato (opcional)" ayuda={`Lo que ve el cliente en la carta. ${formulario.datos.descripcion.length}/${MAX_DESCRIPCION}`}>
            <textarea rows={3} maxLength={MAX_DESCRIPCION} value={formulario.datos.descripcion} onChange={campo("descripcion")} />
          </Campo>
          <Campo etiqueta="Foto (opcional)" ayuda={esEnlaceDeDrive(formulario.datos.imagen) ? "Enlace de Google Drive: se guardará como dirección directa de la imagen. El archivo debe estar compartido con «Cualquier persona con el enlace»." : "Dirección completa de la imagen, que empiece con https://. No se suben archivos. Vacío = sin foto."}>
            <input type="url" inputMode="url" maxLength={MAX_IMAGEN} placeholder="https://…" value={formulario.datos.imagen} onChange={campo("imagen")} />
          </Campo>
          <VistaPrevia datos={formulario.datos} moneda={moneda} />
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
            <button type="button" className="adm-btn" onClick={() => setFormulario(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="adm-vacio">No hay ítems para mostrar.</p>
      ) : (
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th className="adm-num">Precio</th>{conAcciones && <th />}</tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={i.activo ? "" : "adm-fila--baja"}>
                  <td><code>{i.codigo}</code></td>
                  <td>
                    <div className="adm-plato">
                      <FotoPlato url={i.imagen} alt={i.nombre} className="adm-foto adm-foto--mini" />
                      <div>
                        {i.nombre}{!i.activo && <em> (de baja)</em>}
                        {i.activo && (!i.descripcion || !i.imagen) && (
                          <small className="adm-falta">{[!i.descripcion && "sin descripción", !i.imagen && "sin foto"].filter(Boolean).join(" · ")}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{i.categoria || "—"}</td>
                  <td className="adm-num">{formatoPrecio(i.precio, moneda)}</td>
                  {conAcciones && (
                    <td className="adm-celda-acciones">
                      {cap.editar && i.activo && (
                        <button
                          type="button"
                          className="adm-btn"
                          onClick={() => setFormulario({ modo: "editar", id: i.id, datos: { codigo: i.codigo, nombre: i.nombre, categoria: i.categoria, precio: i.precio === null ? "" : String(i.precio), descripcion: i.descripcion, imagen: i.imagen } })}
                        >
                          Editar
                        </button>
                      )}
                      {cap.baja && i.activo && (
                        <BotonConfirmar etiqueta="Dar de baja" peligro onConfirmar={() => accion(() => api.post(`catalogo/${i.id}/desactivar`), "Ítem dado de baja.")} />
                      )}
                      {cap.baja && !i.activo && (
                        <button type="button" className="adm-btn" onClick={() => accion(() => api.post(`catalogo/${i.id}/reactivar`), "Ítem reactivado.")}>Reactivar</button>
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
