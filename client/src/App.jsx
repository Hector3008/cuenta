import { useCallback, useEffect, useState } from "react";
import { api, ErrorApi } from "./api.js";
import Login from "./pantallas/Login.jsx";
import ElegirEmpresa from "./pantallas/ElegirEmpresa.jsx";
import CambiarPassword from "./pantallas/CambiarPassword.jsx";
import Perfil from "./pantallas/Perfil.jsx";

// Sin enrutador: la pantalla sale del estado de la sesión (/auth/yo).
//   sin sesión → login · debe cambiar contraseña → cambio · sin empresa activa → elegir · si no → perfil
export default function App() {
  const [yo, setYo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorGrave, setErrorGrave] = useState(null);
  const [eligiendoOtra, setEligiendoOtra] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      setYo(await api.yo());
      setErrorGrave(null);
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) setYo(null);
      else if (e instanceof ErrorApi && e.status === 403 && e.codigo === "CAMBIO_PASSWORD_REQUERIDO") {
        setYo((previo) => ({ ...(previo ?? { usuario: null, empresas: [], permisos: [], empresaActivaId: null }), debeCambiarPassword: true }));
      } else setErrorGrave(e.message || "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { refrescar(); }, [refrescar]);

  async function salir() {
    try { await api.logout(); } catch { /* la sesión ya no existe o no hay red: da igual */ }
    setEligiendoOtra(false);
    setYo(null);
  }

  if (cargando) return <main className="centrado"><p className="cargando">Cargando…</p></main>;
  if (errorGrave)
    return (
      <main className="centrado">
        <section className="tarjeta">
          <p className="aviso-error">{errorGrave}</p>
          <button className="boton" onClick={() => { setCargando(true); refrescar(); }}>Reintentar</button>
        </section>
      </main>
    );

  if (!yo) return <Login alEntrar={refrescar} />;
  if (yo.debeCambiarPassword) return <CambiarPassword alCambiar={refrescar} alSalir={salir} />;
  if (!yo.empresaActivaId || eligiendoOtra)
    return (
      <ElegirEmpresa
        empresas={yo.empresas}
        alElegir={async () => { setEligiendoOtra(false); await refrescar(); }}
        alSalir={salir}
      />
    );
  return <Perfil yo={yo} alCambiarEmpresa={() => setEligiendoOtra(true)} alSalir={salir} />;
}
