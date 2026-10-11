import { destinosAccesibles } from "../destinos.js";

// Primera vista de la sesión iniciada (5.22): saludo, empresa y rol, y un acceso por cada destino
// que la persona puede ver (servicio contratado + permiso). Es un lanzador: cada servicio trae su
// propio front; aquí solo se enlaza a él.
export default function Inicio({ yo, alAbrir, alCambiarEmpresa, alSalir }) {
  const empresa = yo.empresas.find((e) => e.id === yo.empresaActivaId);
  const nombre = yo.usuario?.nombre;
  const destinos = destinosAccesibles(yo);
  // Perfil siempre está; si no hay nada más, se explica en vez de dejar la pantalla casi vacía.
  const soloPerfil = destinos.every((d) => d.id === "cuenta.perfil");

  return (
    <main className="centrado" style={{ alignItems: "start" }}>
      <div className="tarjeta" style={{ maxWidth: 640 }}>
        <h1>{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
        {empresa && (
          <p className="sub">
            {empresa.nombre}{empresa.rol ? ` · ${empresa.rol}` : ""}
          </p>
        )}

        <nav aria-label="Accesos">
          <ul className="rejilla-destinos">
            {destinos.map((d) => (
              <li key={d.id}>
                <button type="button" className="destino" onClick={() => alAbrir(d)}>
                  <strong>{d.titulo}</strong>
                  <small>{d.descripcion}</small>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {soloPerfil && (
          <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
            Los accesos a los servicios de tu empresa aparecerán aquí a medida que estén disponibles para tu rol.
          </p>
        )}

        <div className="acciones-inicio">
          {yo.empresas.length > 1 && (
            <button className="boton secundario" type="button" onClick={alCambiarEmpresa}>
              Cambiar de empresa
            </button>
          )}
          <button className="boton secundario" type="button" onClick={alSalir}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}
