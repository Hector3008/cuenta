import { useCallback, useEffect, useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import { CAMPOS_DATOS, LIMITES_DATOS, formularioDeDatos, lineasDeEncabezado, parsearDatos } from "./formato.js";

// Datos de la empresa para sus comprobantes (5.34): salen en el encabezado y el pie del recibo de pago y de la cuenta
// (junto al logo de la marca). El recibo es un documento NO fiscal: estos datos se imprimen tal cual se escriben.

function VistaEncabezado({ vista }) {
  if (!vista) return null;
  const lineas = lineasDeEncabezado(vista);
  return (
    <div className="adm-recibo-vista" aria-label="Encabezado del recibo">
      {vista.logo && <img className="adm-marca-logo" src={vista.logo} alt={`Logo de ${vista.nombre}`} referrerPolicy="no-referrer" />}
      <strong>{vista.nombre}</strong>
      {lineas.map((l, i) => (<span key={i}>{l}</span>))}
      <span className="adm-recibo-vista__linea">— — — — — — — —</span>
      <span>1 × Café americano · S/ 6.50</span>
      <strong>Total S/ 6.50</strong>
      {vista.pie && <span className="adm-recibo-vista__pie">{vista.pie}</span>}
      <small>Documento no fiscal</small>
    </div>
  );
}

export default function DatosEmpresa() {
  const [vista, setVista] = useState(null);
  const [formulario, setFormulario] = useState(formularioDeDatos(null));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);

  const aplicar = useCallback((r) => {
    setFormulario(formularioDeDatos(r?.datos));
    setVista(r?.vista ?? null);
  }, []);

  useEffect(() => {
    let vigente = true;
    api.get("auth/datos-empresa").then(
      (r) => vigente && (aplicar(r), setCargando(false)),
      (e) => vigente && (setError(mensajeAdmin(e)), setCargando(false)),
    );
    return () => {
      vigente = false;
    };
  }, [aplicar]);

  async function guardar(ev) {
    ev.preventDefault();
    setOk("");
    const p = parsearDatos(formulario);
    if (!p.ok) return setError(p.error);
    setError("");
    setGuardando(true);
    try {
      aplicar(await api.put("auth/datos-empresa", p.cuerpo));
      setOk("Datos guardados. Saldrán en los recibos que se emitan desde ahora.");
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="cargando">Cargando los datos del comprobante…</p>;
  return (
    <section aria-labelledby="t-datos">
      <header className="adm-cabecera"><h3 id="t-datos">Datos para los recibos</h3></header>
      <p className="adm-nota">
        Salen en el encabezado y el pie del recibo de pago y de la cuenta, junto al logo de la marca. Los recibos ya emitidos conservan los datos que tenían.
        Son recibos no fiscales: no reemplazan una factura o boleta electrónica.
      </p>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      <div className="adm-marca">
        <form className="adm-form" onSubmit={guardar}>
          {CAMPOS_DATOS.map(([k, etiqueta, ayuda]) => (
            <Campo key={k} etiqueta={etiqueta} ayuda={ayuda}>
              <input value={formulario[k]} maxLength={LIMITES_DATOS[k]} onChange={(e) => setFormulario((f) => ({ ...f, [k]: e.target.value }))} inputMode={k === "telefono" ? "tel" : undefined} />
            </Campo>
          ))}
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar datos"}</button>
          </div>
        </form>
        <div>
          <h4 className="adm-marca-sub">Así sale en el recibo</h4>
          <VistaEncabezado vista={vista} />
          <p className="adm-nota">Muestra lo último que guardaste. El logo se edita en «Marca de la carta».</p>
        </div>
      </div>
    </section>
  );
}
