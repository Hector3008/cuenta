import { useEffect, useState } from "react";
import { api, mensajeDeError } from "../api.js";
import { clientIdGoogle, mensajeDeErrorGoogle } from "../google-logica.js";
import BotonGoogle from "./BotonGoogle.jsx";

export default function Login({ alEntrar }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // Entrar con Google (5.69): el botón solo sale si el servidor lo tiene activado (si falla la consulta, simplemente no sale).
  const [googleId, setGoogleId] = useState(null);

  useEffect(() => {
    let vivo = true;
    api.googleConfig().then(
      (r) => vivo && setGoogleId(clientIdGoogle(r)),
      () => {},
    );
    return () => {
      vivo = false;
    };
  }, []);

  async function conGoogle(credencial) {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await api.loginGoogle(credencial);
      setPassword("");
      await alEntrar();
    } catch (err) {
      setError(mensajeDeErrorGoogle(err));
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await api.login(correo.trim(), password);
      setPassword("");
      await alEntrar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="centrado">
      <form className="tarjeta" onSubmit={enviar}>
        <h1>Iniciar sesión</h1>
        <p className="sub">Ingresa con tu correo y contraseña.</p>

        {error && <p className="aviso-error" role="alert">{error}</p>}

        <label className="campo">
          <span>Correo</span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <div className="fila-clave">
            <input
              type={verClave ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setVerClave((v) => !v)}>
              {verClave ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>

        <button className="boton" type="submit" disabled={enviando || !correo || !password}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>

        {googleId && (
          <>
            <div className="separador-o" role="separator"><span>o</span></div>
            <BotonGoogle clientId={googleId} alCredencial={conGoogle} deshabilitado={enviando} />
          </>
        )}

        {/* Página del gateway (fuera de esta app): desde /cuenta/ sube un nivel hasta /recuperar, con o sin prefijo. */}
        <p className="sub">
          <a href="../recuperar">¿Olvidaste tu contraseña?</a>
        </p>
      </form>
    </main>
  );
}
