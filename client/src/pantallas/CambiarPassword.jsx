import { useState } from "react";
import { api, mensajeDeError } from "../api.js";

const MINIMO = 10; // misma política que el backend (auth/politica-password.js)

export default function CambiarPassword({ alCambiar, alSalir }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    if (nueva.length < MINIMO) return setError(`La contraseña nueva debe tener al menos ${MINIMO} caracteres.`);
    if (nueva !== repetida) return setError("Las contraseñas nuevas no coinciden.");
    if (nueva === actual) return setError("La contraseña nueva debe ser distinta de la temporal.");
    setError(null);
    setEnviando(true);
    try {
      await api.cambiarPassword(actual, nueva);
      await alCambiar();
    } catch (err) {
      // Aquí un 401 significa "contraseña actual incorrecta", no "sesión caída".
      setError(err?.status === 401 ? "La contraseña temporal no es correcta." : mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="centrado">
      <form className="tarjeta" onSubmit={enviar}>
        <h1>Crea tu contraseña</h1>
        <p className="sub">Entraste con una contraseña temporal. Elige una propia para continuar.</p>

        {error && <p className="aviso-error" role="alert">{error}</p>}

        <label className="campo">
          <span>Contraseña temporal</span>
          <input type="password" autoComplete="current-password" required autoFocus
            value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
        <label className="campo">
          <span>Contraseña nueva</span>
          <input type="password" autoComplete="new-password" required
            value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <small>Mínimo {MINIMO} caracteres.</small>
        </label>
        <label className="campo">
          <span>Repite la contraseña nueva</span>
          <input type="password" autoComplete="new-password" required
            value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        </label>

        <button className="boton" type="submit" disabled={enviando || !actual || !nueva || !repetida}>
          {enviando ? "Guardando…" : "Guardar y continuar"}
        </button>
        <button className="boton secundario" type="button" onClick={alSalir}>
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
