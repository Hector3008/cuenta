import { useState } from "react";
import { api, mensajeDeError } from "../api.js";

export default function Login({ alEntrar }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

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
      </form>
    </main>
  );
}
