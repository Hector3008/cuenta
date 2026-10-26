import { useMemo, useState } from "react";
import { permite } from "../destinos.js";
import { COMODINES, ROLES_DE_EJEMPLO, filtrarGuia, incluidoEn } from "./permisos-guia.js";

// Guía de permisos (5.56): lista y explica cada permiso. Si hay un formulario de rol abierto (`texto` no es null),
// cada permiso se puede agregar o quitar del texto con un botón; solo se ofrecen los que quien edita tiene.
export default function GuiaPermisos({ misPermisos = [], texto = null, onAgregar, onQuitar }) {
  const [filtro, setFiltro] = useState("");
  const grupos = useMemo(() => filtrarGuia(filtro), [filtro]);
  const editando = texto !== null && typeof onAgregar === "function";

  return (
    <section className="adm-guia" aria-label="Guía de permisos">
      <p className="adm-nota">
        Un rol es una lista de permisos. Cada permiso se escribe <code>recurso:acción</code>. Esta guía explica qué permite cada uno; los
        marcados con «tobt» solo aplican si la empresa usa ese servicio.
      </p>
      <ul className="adm-guia-comodines">
        {COMODINES.map((c) => (<li key={c.id}><code>{c.id}</code> {c.texto}</li>))}
      </ul>
      <input type="search" className="adm-guia-filtro" placeholder="Buscar un permiso (ej. cobrar, precio, puntos)" aria-label="Buscar un permiso" value={filtro} onChange={(e) => setFiltro(e.target.value)} />

      {grupos.length === 0 && <p className="adm-vacio">Ningún permiso coincide con «{filtro}».</p>}
      {grupos.map((g) => (
        <div key={g.id} className="adm-guia-grupo">
          <h4>{g.titulo}</h4>
          {g.intro && <p className="adm-nota">{g.intro}</p>}
          <ul className="adm-guia-lista">
            {g.permisos.map((p) => {
              const tengo = permite(misPermisos, p.id);
              const puesto = editando && incluidoEn(texto, p.id);
              return (
                <li key={p.id} className={p.reservado ? "adm-guia-item adm-guia-item--reservado" : "adm-guia-item"}>
                  <div>
                    <code>{p.id}</code> <strong>{p.titulo}</strong>
                    {p.servicio && <span className="adm-guia-etiqueta">{p.servicio}</span>}
                    {p.reservado && <span className="adm-guia-etiqueta">reservado</span>}
                    <p>{p.descripcion}</p>
                  </div>
                  {editando && (
                    puesto ? (
                      <button type="button" className="adm-btn" onClick={() => onQuitar?.(p.id)} aria-label={`Quitar ${p.id}`}>✓ Quitar</button>
                    ) : tengo ? (
                      <button type="button" className="adm-btn" onClick={() => onAgregar(p.id)} aria-label={`Agregar ${p.id}`}>Agregar</button>
                    ) : (
                      <span className="adm-guia-etiqueta" title="Solo puedes dar permisos que tú tienes">no lo tienes</span>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="adm-guia-grupo">
        <h4>Roles de ejemplo</h4>
        <p className="adm-nota">Los que trae el servicio tobt al crear la empresa; sirven de punto de partida.</p>
        <ul className="adm-guia-lista">
          {ROLES_DE_EJEMPLO.map((r) => (
            <li key={r.nombre} className="adm-guia-item"><div><strong>{r.nombre}</strong><p className="adm-permisos">{r.permisos.map((p) => (<code key={p}>{p}</code>))}</p></div></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
