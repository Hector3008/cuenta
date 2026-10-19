import { useCallback, useEffect, useState } from "react";
import { api, mensajeAdmin } from "./http.js";
import { Aviso, Campo } from "./piezas.jsx";
import { CAMPOS_COLOR, MAX_ESLOGAN, esEnlaceDeDrive, estiloDeVista, formularioDeMarca, normalizarColorEntrada, parsearMarca } from "./formato.js";

// Marca de la empresa (5.33): logo, eslogan y colores de la carta pública. El núcleo valida y calcula la
// paleta; la vista previa se pinta con la paleta que devolvió al guardar (lo que se ve aquí es lo que sale en la carta).

const COLOR_MUESTRA = { colorPrincipal: "#1f5f4a", colorSecundario: "#c8873a", colorFondo: "#f4f1ea" };

function CampoColor({ campo, etiqueta, ayuda, valor, onCambio }) {
  const valido = normalizarColorEntrada(valor);
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <span className="adm-color">
        <input type="color" aria-label={`Elegir ${etiqueta.toLowerCase()}`} value={valido ?? COLOR_MUESTRA[campo]} onChange={(e) => onCambio(e.target.value)} />
        <input value={valor} placeholder="Por defecto" maxLength={7} spellCheck={false} onChange={(e) => onCambio(e.target.value)} aria-invalid={valor.trim() !== "" && !valido} />
        {valor.trim() !== "" && (
          <button type="button" className="adm-link" onClick={() => onCambio("")}>Quitar</button>
        )}
      </span>
    </Campo>
  );
}

function VistaPrevia({ vista, nombre }) {
  if (!vista) return <p className="adm-nota">Todavía no hay marca: la carta usa la apariencia por defecto y sigue el modo claro u oscuro del dispositivo.</p>;
  const estilo = estiloDeVista(vista);
  return (
    <div className="adm-marca-vista" style={{ ...estilo, ...(estilo["--color-fondo"] ? { background: estilo["--color-fondo"], color: estilo["--color-texto"] } : {}) }} aria-label="Vista previa de la carta">
      {vista.logo && <img className="adm-marca-logo" src={vista.logo} alt={`Logo de ${nombre ?? "la empresa"}`} referrerPolicy="no-referrer" />}
      <strong className="adm-marca-titulo">{nombre ?? "Tu empresa"}</strong>
      <span className="adm-marca-eslogan" style={estilo["--color-texto-suave"] ? { color: estilo["--color-texto-suave"] } : undefined}>{vista.eslogan ?? "Nuestra carta"}</span>
      <span className="adm-marca-tarjeta" style={estilo["--color-superficie"] ? { background: estilo["--color-superficie"], borderColor: estilo["--color-borde"] } : undefined}>
        <span>Café americano</span>
        <span>S/ 6.50</span>
      </span>
      <span className="adm-marca-fila">
        <span className="adm-marca-boton" style={estilo["--color-principal"] ? { background: estilo["--color-principal"], color: estilo["--color-principal-texto"] } : undefined}>Ver movimientos</span>
        <span className="adm-marca-puntos" style={estilo["--color-principal"] ? { color: estilo["--color-principal"] } : undefined}>95 puntos</span>
        <span className="adm-marca-estrellas" style={estilo["--color-secundario"] ? { color: estilo["--color-secundario"] } : undefined}>★★★★☆</span>
      </span>
    </div>
  );
}

export default function Marca({ nombre }) {
  const [vista, setVista] = useState(null);
  const [formulario, setFormulario] = useState(formularioDeMarca(null));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);

  const aplicar = useCallback((r) => {
    setFormulario(formularioDeMarca(r?.marca));
    setVista(r?.vista ?? null);
  }, []);

  useEffect(() => {
    let vigente = true;
    api.get("auth/marca").then(
      (r) => vigente && (aplicar(r), setCargando(false)),
      (e) => vigente && (setError(mensajeAdmin(e)), setCargando(false)),
    );
    return () => {
      vigente = false;
    };
  }, [aplicar]);

  const campo = (k) => (valor) => setFormulario((f) => ({ ...f, [k]: valor }));

  async function guardar(ev) {
    ev.preventDefault();
    setOk("");
    const p = parsearMarca(formulario);
    if (!p.ok) return setError(p.error);
    setError("");
    setGuardando(true);
    try {
      aplicar(await api.put("auth/marca", p.cuerpo));
      setOk("Marca guardada. Ya se ve en la carta pública.");
    } catch (err) {
      setError(mensajeAdmin(err)); // p. ej. un color que se confunde con el fondo: el mensaje del núcleo lo explica
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="cargando">Cargando la marca…</p>;
  return (
    <section aria-labelledby="t-marca">
      <header className="adm-cabecera"><h3 id="t-marca">Marca de la carta</h3></header>
      <p className="adm-nota">Logo, eslogan y colores que ven tus clientes en la carta pública. Todo es opcional: lo que dejes vacío usa la apariencia por defecto.</p>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      <div className="adm-marca">
        <form className="adm-form" onSubmit={guardar}>
          <Campo
            etiqueta="Logo"
            ayuda={esEnlaceDeDrive(formulario.logo) ? "Enlace de Google Drive: se guardará como dirección directa de la imagen. El archivo debe estar compartido con «Cualquier persona con el enlace»." : "Dirección completa de la imagen, que empiece con https://. No se suben archivos. Vacío = sin logo."}
          >
            <input value={formulario.logo} onChange={(e) => campo("logo")(e.target.value)} placeholder="https://…" maxLength={500} />
          </Campo>
          <Campo etiqueta="Eslogan" ayuda={`Reemplaza «Nuestra carta» bajo el nombre. Hasta ${MAX_ESLOGAN} caracteres.`}>
            <input value={formulario.eslogan} maxLength={MAX_ESLOGAN} onChange={(e) => campo("eslogan")(e.target.value)} placeholder="Nuestra carta" />
          </Campo>
          {CAMPOS_COLOR.map(([k, etiqueta, ayuda]) => (
            <CampoColor key={k} campo={k} etiqueta={etiqueta} ayuda={ayuda} valor={formulario[k]} onCambio={campo(k)} />
          ))}
          <p className="adm-nota">Con colores propios la carta no cambia con el modo oscuro del dispositivo: se ve siempre con los colores de tu marca.</p>
          <div className="adm-acciones">
            <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar marca"}</button>
          </div>
        </form>
        <div>
          <h4 className="adm-marca-sub">Así se ve</h4>
          <VistaPrevia vista={vista} nombre={nombre} />
          <p className="adm-nota">La vista previa muestra lo último que guardaste.</p>
        </div>
      </div>
    </section>
  );
}
