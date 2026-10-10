import { useState } from "react";
import { api, mensajeDeError } from "../api.js";

export default function ElegirEmpresa({ empresas, alElegir, alSalir }) {
  const [error, setError] = useState(null);
  const [eligiendo, setEligiendo] = useState(null);

  async function elegir(id) {
    if (eligiendo) return;
    setError(null);
    setEligiendo(id);
    try {
      await api.elegirEmpresa(id);
      await alElegir();
    } catch (err) {
      setError(mensajeDeError(err));
      setEligiendo(null);
    }
  }

  return (
    <main className="centrado">
      <section className="tarjeta">
        <h1>¿Con qué empresa?</h1>
        <p className="sub">Tu cuenta pertenece a más de una. Puedes cambiar después.</p>

        {error && <p className="aviso-error" role="alert">{error}</p>}

        {empresas.length === 0 ? (
          <p className="aviso-error">Tu cuenta no tiene empresas activas. Habla con un administrador.</p>
        ) : (
          <ul className="lista-empresas">
            {empresas.map((e) => (
              <li key={e.id}>
                <button type="button" disabled={Boolean(eligiendo)} onClick={() => elegir(e.id)}>
                  {e.nombre}
                  {e.rol && <small>{e.rol}</small>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="boton secundario" type="button" onClick={alSalir}>
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}
