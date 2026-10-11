import { useState } from "react";
import { api, mensajeDeError } from "../api.js";
import { destinosAccesibles } from "../destinos.js";

const MINIMO = 10;

function Seccion({ titulo, children }) {
  return (
    <section style={{ borderTop: "1px solid var(--color-borde)", paddingTop: 20, marginTop: 20 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: "1.0625rem" }}>{titulo}</h2>
      {children}
    </section>
  );
}

function CambioPassword() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setListo(false);
    if (nueva.length < MINIMO) return setError(`La contraseña nueva debe tener al menos ${MINIMO} caracteres.`);
    if (nueva !== repetida) return setError("Las contraseñas nuevas no coinciden.");
    setError(null);
    setEnviando(true);
    try {
      await api.cambiarPassword(actual, nueva);
      setActual(""); setNueva(""); setRepetida("");
      setListo(true);
    } catch (err) {
      setError(err?.status === 401 ? "La contraseña actual no es correcta." : mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {error && <p className="aviso-error" role="alert">{error}</p>}
      {listo && <p className="aviso-ok" role="status">Contraseña actualizada. Se cerraron tus otras sesiones.</p>}
      <label className="campo"><span>Contraseña actual</span>
        <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
      </label>
      <label className="campo"><span>Contraseña nueva</span>
        <input type="password" autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <small>Mínimo {MINIMO} caracteres.</small>
      </label>
      <label className="campo"><span>Repite la contraseña nueva</span>
        <input type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
      </label>
      <button className="boton" type="submit" disabled={enviando || !actual || !nueva || !repetida}>
        {enviando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

function CambioPin({ tienePin }) {
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setListo(false);
    if (!/^\d{4,6}$/.test(pin)) return setError("El PIN debe tener entre 4 y 6 dígitos.");
    setError(null);
    setEnviando(true);
    try {
      await api.cambiarPin(pin, password);
      setPin(""); setPassword("");
      setListo(true);
    } catch (err) {
      // El backend explica por qué rechaza un PIN (repetidos, secuencias, largo de la empresa).
      setError(err?.status === 401 ? "La contraseña no es correcta." : mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {error && <p className="aviso-error" role="alert">{error}</p>}
      {listo && <p className="aviso-ok" role="status">PIN guardado.</p>}
      <label className="campo"><span>{tienePin ? "PIN nuevo" : "PIN"}</span>
        <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <small>Solo dígitos. Sin repetidos ni secuencias. Sirve únicamente en tablets emparejadas.</small>
      </label>
      <label className="campo"><span>Tu contraseña</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button className="boton" type="submit" disabled={enviando || !pin || !password}>
        {enviando ? "Guardando…" : tienePin ? "Cambiar PIN" : "Crear PIN"}
      </button>
    </form>
  );
}

// Qué se abre al entrar. Es una preferencia de la persona (global, no por empresa): solo se ofrecen los
// destinos que puede ver en la empresa activa. Si el guardado ya no aplica aquí, se avisa y se abre Inicio.
function PaginaPrincipal({ yo, alGuardado }) {
  const opciones = destinosAccesibles(yo);
  const guardada = yo.paginaPrincipal;
  const aplica = Boolean(guardada) && opciones.some((d) => d.id === guardada);
  const [valor, setValor] = useState(aplica ? guardada : "");
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function cambiar(e) {
    const nuevo = e.target.value;
    setValor(nuevo);
    setListo(false);
    setError(null);
    setEnviando(true);
    try {
      await api.guardarPaginaPrincipal(nuevo || null);
      await alGuardado();
      setListo(true);
    } catch (err) {
      setValor(aplica ? guardada : "");
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      {error && <p className="aviso-error" role="alert">{error}</p>}
      {listo && <p className="aviso-ok" role="status">Guardado.</p>}
      {guardada && !aplica && (
        <p className="sub" style={{ marginTop: 0 }}>
          Tu página principal guardada no está disponible en esta empresa; se abrirá Inicio.
        </p>
      )}
      <label className="campo"><span>Al entrar, abrir</span>
        <select value={valor} onChange={cambiar} disabled={enviando}>
          <option value="">Inicio</option>
          {opciones.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
        </select>
        <small>Vale para todas tus empresas; si no aplica en una, se abre Inicio.</small>
      </label>
    </div>
  );
}

export default function Perfil({ yo, alVolver, alActualizar, alCambiarEmpresa, alSalir }) {
  const empresa = yo.empresas.find((e) => e.id === yo.empresaActivaId);
  const nombre = yo.usuario?.nombre;
  return (
    <main className="centrado" style={{ alignItems: "start" }}>
      <div className="tarjeta" style={{ maxWidth: 480 }}>
        <button type="button" className="enlace-volver" onClick={alVolver}>← Inicio</button>
        <h1>{nombre || "Mi cuenta"}</h1>
        {yo.usuario?.correo && <p className="sub" style={{ marginBottom: 4 }}>{yo.usuario.correo}</p>}
        {empresa && (
          <p className="sub">
            {empresa.nombre}{empresa.rol ? ` · ${empresa.rol}` : ""}
          </p>
        )}

        {yo.empresas.length > 1 && (
          <button className="boton secundario" type="button" onClick={alCambiarEmpresa} style={{ marginTop: 0 }}>
            Cambiar de empresa
          </button>
        )}

        <Seccion titulo="Página principal"><PaginaPrincipal yo={yo} alGuardado={alActualizar} /></Seccion>
        <Seccion titulo="Contraseña"><CambioPassword /></Seccion>
        {yo.pinHabilitado && <Seccion titulo="PIN de tablet"><CambioPin tienePin={yo.tienePin} /></Seccion>}

        <Seccion titulo="Sesión">
          <button className="boton secundario" type="button" onClick={alSalir} style={{ marginTop: 0 }}>
            Cerrar sesión
          </button>
        </Seccion>
      </div>
    </main>
  );
}
