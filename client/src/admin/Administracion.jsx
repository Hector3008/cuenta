import { useMemo, useState } from "react";
import { capacidades, empresaActiva, seccionesVisibles } from "./permisos.js";
import Equipo from "./Equipo.jsx";
import Catalogo from "./Catalogo.jsx";
import Fidelizacion from "./Fidelizacion.jsx";
import Empresa from "./Empresa.jsx";
import "./admin.css";

// Vista de administración de la empresa: Equipo · Catálogo · Fidelización · Empresa.
// Props:
//   yo               lo que devuelve `api.yo()` (ya normalizado)
//   seccionInicial   "equipo" | "catalogo" | "fidelizacion" | "empresa" (viene del destino que abrió la pantalla)
//   alVolver         vuelve a Inicio
// Sin enrutador (como el resto de `cuenta`): la pestaña vive en el estado. Solo se ofrecen las
// secciones que la persona puede ver; los botones de CRUD salen de `capacidades`.
export default function Administracion({ yo, seccionInicial, alVolver }) {
  const permisos = yo?.permisos;
  const cap = useMemo(() => capacidades(permisos), [permisos]);
  const secciones = useMemo(() => seccionesVisibles(permisos), [permisos]);
  const [actual, setActual] = useState(
    secciones.some((s) => s.id === seccionInicial) ? seccionInicial : secciones[0]?.id,
  );
  const empresa = empresaActiva(yo);

  return (
    <main className="adm">
      <button type="button" className="enlace-volver" onClick={alVolver}>← Inicio</button>
      <h1 className="adm-titulo">Administración{empresa?.nombre ? ` · ${empresa.nombre}` : ""}</h1>

      <nav className="adm-tabs" role="tablist" aria-label="Secciones">
        {secciones.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={actual === s.id}
            className={actual === s.id ? "adm-tab adm-tab--activa" : "adm-tab"}
            onClick={() => setActual(s.id)}
          >
            {s.titulo}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {actual === "equipo" && <Equipo cap={cap.equipo} yoId={yo?.usuario?.id} />}
        {actual === "catalogo" && <Catalogo cap={cap.catalogo} moneda={null} />}
        {actual === "fidelizacion" && <Fidelizacion cap={cap.fidelizacion} />}
        {actual === "empresa" && <Empresa yo={yo} capRoles={cap.roles} capMarca={cap.marca} />}
      </div>
    </main>
  );
}
