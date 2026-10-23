import { useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo } from "./piezas.jsx";
import { MAX_MOTIVO_AJUSTE, parsearAjustePuntos } from "./formato.js";

// Agregar puntos a mano a un cliente (5.39), por ejemplo el saldo que traía de otro sistema. Entra al libro como
// `ajuste`: suma al saldo pero NO cuenta como consumo (no sube el nivel, no da insignias ni avanza retos).
// Pide fidelizacion:gestionar y cliente:leer (la sección solo se ofrece con ambos; la seguridad real está en el servidor).

const TIPOS = { acumulo: "Consumo", canje: "Canje", ajuste: "Ajuste", vencimiento: "Vencimiento" };
const fecha = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
};

export default function AjustarPuntos() {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState(null); // null = aún no se ha buscado
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [resumen, setResumen] = useState(null); // { saldo, movimientos }
  const [form, setForm] = useState({ puntos: "", detalle: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function buscar(ev) {
    ev.preventDefault();
    const q = texto.trim();
    if (q.length < 2) return setError("Escribe al menos 2 caracteres: nombre, teléfono o correo.");
    setBuscando(true);
    setError("");
    setOk("");
    try {
      const r = await api.get("clientes", { q, limite: 10 });
      setResultados(comoLista(r?.clientes ?? r));
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setBuscando(false);
    }
  }

  async function cargarResumen(c) {
    const r = await api.get(`clientes/${c.id}/puntos`, { limite: 5 });
    setResumen({ saldo: r.saldo ?? 0, movimientos: comoLista(r.movimientos) });
  }

  async function elegir(c) {
    setCliente(c);
    setResumen(null);
    setForm({ puntos: "", detalle: "" });
    setError("");
    setOk("");
    try {
      await cargarResumen(c);
    } catch (err) {
      setError(mensajeAdmin(err));
    }
  }

  async function agregar() {
    if (enviando || !cliente) return;
    const r = parsearAjustePuntos(form);
    if (!r.ok) return setError(r.error);
    setEnviando(true);
    setError("");
    setOk("");
    try {
      const resp = await api.post(`clientes/${cliente.id}/puntos/ajustar`, r.cuerpo);
      setOk(`Se agregaron ${r.cuerpo.puntos} puntos a ${cliente.nombre}. Saldo: ${resp.saldo}.`);
      setForm({ puntos: "", detalle: "" });
      await cargarResumen(cliente).catch(() => setResumen((x) => (x ? { ...x, saldo: resp.saldo } : x)));
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setEnviando(false);
    }
  }

  const campo = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sinConsentimiento = cliente && cliente.consentimientos && !cliente.consentimientos.programaPuntos?.otorgado;

  return (
    <section className="adm-form" aria-labelledby="t-ajustar-puntos">
      <h3 id="t-ajustar-puntos">Agregar puntos a un cliente</h3>
      <p className="adm-nota">
        Para cargar un saldo que el cliente ya traía o corregir un error. Se suma a su saldo y queda en su historial con el motivo,
        pero <strong>no cuenta como consumo</strong>: no sube su nivel, no da insignias ni avanza sus retos.
      </p>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>

      <form onSubmit={buscar}>
        <Campo etiqueta="Buscar cliente" ayuda="Por nombre, teléfono, correo o @usuario de una red.">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={80} />
        </Campo>
        <div className="adm-acciones">
          <button type="submit" className="adm-btn" disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button>
        </div>
      </form>

      {resultados && !cliente && (
        resultados.length === 0 ? (
          <p className="adm-vacio">No se encontró ningún cliente con ese dato.</p>
        ) : (
          <ul className="adm-lista-clientes">
            {resultados.map((c) => (
              <li key={c.id}>
                <button type="button" className="adm-btn" onClick={() => elegir(c)}>
                  {c.nombre}{c.telefono ? ` · ${c.telefono}` : c.correo ? ` · ${c.correo}` : ""}{c.activo === false ? " (de baja)" : ""}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {cliente && (
        <div>
          <h4>
            {cliente.nombre}{" "}
            <button type="button" className="adm-link" onClick={() => { setCliente(null); setResumen(null); setOk(""); setError(""); }}>
              Cambiar cliente
            </button>
          </h4>
          <p>Saldo actual: <strong>{resumen ? resumen.saldo : "…"}</strong> puntos</p>
          {sinConsentimiento && (
            <p className="adm-nota">Este cliente aún no aceptó el programa de puntos: podrás agregarle puntos, pero no acumulará los de sus consumos hasta que lo acepte.</p>
          )}
          {cliente.activo === false ? (
            <p className="adm-nota">El cliente está de baja: reactívalo antes de agregarle puntos.</p>
          ) : (
            <div>
              <Campo etiqueta="Puntos a agregar">
                <input inputMode="numeric" value={form.puntos} onChange={campo("puntos")} />
              </Campo>
              <Campo etiqueta="Motivo" ayuda="Obligatorio. Por ejemplo «Saldo migrado del sistema anterior».">
                <input maxLength={MAX_MOTIVO_AJUSTE} value={form.detalle} onChange={campo("detalle")} />
              </Campo>
              <div className="adm-acciones">
                <BotonConfirmar etiqueta={enviando ? "Agregando…" : "Agregar puntos"} confirmar="¿Agregar? No se puede deshacer." disabled={enviando} onConfirmar={agregar} />
              </div>
            </div>
          )}
          {resumen && resumen.movimientos.length > 0 && (
            <div className="adm-tabla-caja">
              <table className="adm-tabla">
                <caption className="adm-nota">Últimos movimientos</caption>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th className="adm-num">Puntos</th></tr></thead>
                <tbody>
                  {resumen.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td>{fecha(m.ts)}</td>
                      <td>{TIPOS[m.tipo] ?? m.tipo}</td>
                      <td>{m.detalle ?? ""}</td>
                      <td className="adm-num">{m.puntos > 0 ? `+${m.puntos}` : m.puntos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
