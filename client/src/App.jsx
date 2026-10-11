import { useCallback, useEffect, useState } from "react";
import { api, ErrorApi, urlDeServicio } from "./api.js";
import { claveDeSesion, marcarAbierta, olvidarMarcas, resolverPaginaPrincipal, yaSeAbrio } from "./destinos.js";
import Login from "./pantallas/Login.jsx";
import ElegirEmpresa from "./pantallas/ElegirEmpresa.jsx";
import CambiarPassword from "./pantallas/CambiarPassword.jsx";
import Inicio from "./pantallas/Inicio.jsx";
import Perfil from "./pantallas/Perfil.jsx";

// Sin enrutador: la pantalla sale del estado de la sesión (/auth/yo).
//   sin sesión → login · debe cambiar contraseña → cambio · sin empresa activa → elegir ·
//   si no → Inicio (o la página principal de la persona, una vez por entrada) · Perfil se abre desde Inicio
export default function App() {
  const [yo, setYo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorGrave, setErrorGrave] = useState(null);
  const [eligiendoOtra, setEligiendoOtra] = useState(false);
  const [pantalla, setPantalla] = useState("inicio"); // "inicio" | "perfil"
  const [claveAplicada, setClaveAplicada] = useState(null); // persona+empresa para la que ya se decidió la página principal

  const olvidarSesion = useCallback(() => {
    olvidarMarcas();
    setClaveAplicada(null);
    setPantalla("inicio");
    setEligiendoOtra(false);
    setYo(null);
  }, []);

  const refrescar = useCallback(async () => {
    try {
      setYo(await api.yo());
      setErrorGrave(null);
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) olvidarSesion();
      else if (e instanceof ErrorApi && e.status === 403 && e.codigo === "CAMBIO_PASSWORD_REQUERIDO") {
        setYo((previo) => ({ ...(previo ?? { usuario: null, empresas: [], permisos: [], servicios: [], empresaActivaId: null }), debeCambiarPassword: true }));
      } else setErrorGrave(e.message || "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, [olvidarSesion]);

  useEffect(() => { refrescar(); }, [refrescar]);

  // Abre un destino de Inicio: una pantalla de esta app o el front de un servicio (otra ruta del gateway).
  const abrir = useCallback((destino) => {
    if (destino.abre?.pantalla) setPantalla(destino.abre.pantalla);
    else if (destino.abre?.enlace) window.location.assign(urlDeServicio(destino.abre.enlace));
  }, []);

  // Página principal: se aplica una sola vez por persona y empresa en esta pestaña, nunca antes del cambio
  // obligatorio de contraseña, y se reevalúa al cambiar de empresa (el permiso depende de la empresa).
  const listoParaInicio = Boolean(yo && !yo.debeCambiarPassword && yo.empresaActivaId && !eligiendoOtra);
  const clave = listoParaInicio ? claveDeSesion(yo) : null;
  useEffect(() => {
    if (!clave || clave === claveAplicada) return;
    if (!yaSeAbrio(clave)) {
      marcarAbierta(clave);
      const destino = resolverPaginaPrincipal(yo);
      if (destino?.abre?.enlace) {
        abrir(destino); // sale de esta app: se deja "Cargando…" hasta que el navegador navegue
        return;
      }
      if (destino) abrir(destino);
    }
    setClaveAplicada(clave);
  }, [clave, claveAplicada, yo, abrir]);

  async function salir() {
    try { await api.logout(); } catch { /* la sesión ya no existe o no hay red: da igual */ }
    olvidarSesion();
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
        alElegir={async () => { setEligiendoOtra(false); setPantalla("inicio"); await refrescar(); }}
        alSalir={salir}
      />
    );
  // Mientras se decide si hay que abrir la página principal no se pinta Inicio (evita un parpadeo).
  if (clave !== claveAplicada) return <main className="centrado"><p className="cargando">Cargando…</p></main>;

  if (pantalla === "perfil")
    return (
      <Perfil
        yo={yo}
        alVolver={() => setPantalla("inicio")}
        alActualizar={refrescar}
        alCambiarEmpresa={() => setEligiendoOtra(true)}
        alSalir={salir}
      />
    );
  return <Inicio yo={yo} alAbrir={abrir} alCambiarEmpresa={() => setEligiendoOtra(true)} alSalir={salir} />;
}
