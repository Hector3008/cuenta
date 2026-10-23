import { useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import { formatoPrecio } from "./formato.js";
import { MAX_LINEAS_PRUEBA, ahoraDeNavegador, lineaDePrueba, parsearItemsPrueba } from "./promociones-logica.js";

// «Probar con un pedido de ejemplo» (5.41): arma un pedido a mano y pide al núcleo que calcule las promociones
// (POST /promociones/simular). No guarda nada ni toca ningún pedido. Con un `borrador` (la promoción que se está
// editando, aún sin guardar) se suma a las activas, o se prueba ella sola.

const dinero = (n) => formatoPrecio(n, null);

export default function PruebaPromociones({ catalogo, borrador, alQuitarBorrador }) {
  const [filas, setFilas] = useState([lineaDePrueba(), lineaDePrueba()]);
  const [cuando, setCuando] = useState("");
  const [solo, setSolo] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState(null); // { items, datos, borradorNombre }
  const [error, setError] = useState("");

  const cambiar = (i, campo, valor) =>
    setFilas((fs) =>
      fs.map((f, j) => {
        if (j !== i) return f;
        const nueva = { ...f, [campo]: valor };
        // Al escribir un código que está en el catálogo se completan la categoría y el precio, si estaban vacíos.
        if (campo === "codigo") {
          const it = catalogo.get(String(valor).trim().toLowerCase());
          if (it) {
            if (!f.categoria) nueva.categoria = it.categoria ?? "";
            if (!f.precio && it.precio !== null && it.precio !== undefined) nueva.precio = String(it.precio);
          }
        }
        return nueva;
      }),
    );

  async function calcular(ev) {
    ev.preventDefault();
    const r = parsearItemsPrueba(filas);
    if (!r.ok) return setError(r.error);
    const ahora = ahoraDeNavegador(cuando);
    if (cuando && !ahora) return setError("La fecha y hora no son válidas.");
    setCalculando(true);
    setError("");
    try {
      const cuerpo = { items: r.items };
      if (ahora) cuerpo.ahora = ahora;
      if (borrador) {
        cuerpo.borrador = borrador;
        if (solo) cuerpo.soloBorrador = true;
      }
      const datos = await api.post("promociones/simular", cuerpo);
      setResultado({ items: r.items, datos, borradorNombre: borrador?.nombre ?? null });
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCalculando(false);
    }
  }

  const d = resultado?.datos;
  return (
    <section className="adm-form adm-prueba" aria-labelledby="t-prueba-promos" id="prueba-promociones">
      <h3 id="t-prueba-promos">Probar con un pedido de ejemplo</h3>
      <p className="adm-nota">Arma un pedido y mira qué descuentos se aplicarían ahora, o a otra fecha y hora. No guarda nada ni toca ningún pedido.</p>

      {borrador && (
        <div className="adm-aviso aviso-ok" role="status">
          <span>
            Probando también «{borrador.nombre}», que aún no está guardada.{" "}
            <label className="adm-check">
              <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} /> Solo esta promoción
            </label>
          </span>
          <button type="button" className="adm-link" onClick={alQuitarBorrador} aria-label="Dejar de probar la promoción sin guardar">×</button>
        </div>
      )}
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>

      <form onSubmit={calcular}>
        <div className="adm-tabla-caja">
          <table className="adm-tabla">
            <thead>
              <tr><th>Producto (código)</th><th>Categoría</th><th className="adm-num">Cantidad</th><th className="adm-num">Precio de una unidad</th><th /></tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td><input aria-label={`Fila ${i + 1}: código`} list="adm-prueba-codigos" maxLength={40} value={f.codigo} onChange={(e) => cambiar(i, "codigo", e.target.value)} /></td>
                  <td><input aria-label={`Fila ${i + 1}: categoría`} list="adm-prueba-categorias" maxLength={60} value={f.categoria} onChange={(e) => cambiar(i, "categoria", e.target.value)} /></td>
                  <td className="adm-num"><input aria-label={`Fila ${i + 1}: cantidad`} inputMode="numeric" size={3} value={f.cantidad} onChange={(e) => cambiar(i, "cantidad", e.target.value)} /></td>
                  <td className="adm-num"><input aria-label={`Fila ${i + 1}: precio`} inputMode="decimal" size={7} value={f.precio} onChange={(e) => cambiar(i, "precio", e.target.value)} /></td>
                  <td>
                    {filas.length > 1 && (
                      <button type="button" className="adm-link" aria-label={`Quitar la fila ${i + 1}`} onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="adm-prueba-codigos">
          {[...catalogo.values()].slice(0, 200).map((it) => (<option key={it.codigo} value={it.codigo} label={it.nombre} />))}
        </datalist>
        <datalist id="adm-prueba-categorias">
          {[...new Set([...catalogo.values()].map((it) => it.categoria).filter(Boolean))].map((c) => (<option key={c} value={c} />))}
        </datalist>
        <div className="adm-acciones">
          <button type="button" className="adm-btn" disabled={filas.length >= MAX_LINEAS_PRUEBA} onClick={() => setFilas((fs) => [...fs, lineaDePrueba()])}>+ Agregar producto</button>
        </div>
        <Campo etiqueta="Fecha y hora (opcional)" ayuda="Para probar un horario o un día de la semana. Se toma con la hora de tu navegador; sin ella, se usa el momento actual.">
          <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
        </Campo>
        <div className="adm-acciones">
          <button type="submit" className="adm-btn adm-btn--primario" disabled={calculando}>{calculando ? "Calculando…" : "Calcular"}</button>
        </div>
      </form>

      {d && (
        <div className="adm-resultado" aria-live="polite">
          <h4>Resultado</h4>
          <div className="adm-tabla-caja">
            <table className="adm-tabla">
              <thead>
                <tr><th>Producto</th><th className="adm-num">Cant.</th><th className="adm-num">Sin promoción</th><th className="adm-num">Descuento</th><th className="adm-num">A pagar</th><th>Promoción</th></tr>
              </thead>
              <tbody>
                {d.lineas.map((l, i) => (
                  <tr key={l.id ?? i}>
                    <td>{resultado.items[i]?.codigo}</td>
                    <td className="adm-num">{resultado.items[i]?.cantidad}</td>
                    <td className="adm-num">{dinero(l.subtotalBase)}</td>
                    <td className="adm-num">{l.descuento > 0 ? `−${dinero(l.descuento)}` : "—"}</td>
                    <td className="adm-num">{dinero(l.subtotal)}</td>
                    <td>{l.promociones.length ? l.promociones.map((p) => p.nombre).join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="adm-datos">
            <dt>Sin promociones</dt><dd>{dinero(d.totalBase)}</dd>
            <dt>Descuento</dt><dd>{d.descuentoTotal > 0 ? `−${dinero(d.descuentoTotal)}` : dinero(0)}</dd>
            <dt>Total</dt><dd><strong>{dinero(d.total)}</strong></dd>
          </dl>
          {d.aplicadas.length === 0 ? (
            <p className="adm-vacio">Ninguna promoción se aplica a este pedido en ese momento{d.vigentes.length === 0 ? " (no hay promociones vigentes)" : ""}.</p>
          ) : (
            <ul className="adm-aplicadas">
              {d.aplicadas.map((a) => (
                <li key={a.id}>{a.nombre}: {a.veces} {a.veces === 1 ? "unidad" : "unidades"}, −{dinero(a.monto)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
