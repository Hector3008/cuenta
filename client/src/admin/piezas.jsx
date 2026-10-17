import { useState } from "react";

// Piezas pequeñas compartidas por las tres pantallas.

export function Aviso({ tipo = "error", children, onCerrar }) {
  if (!children) return null;
  return (
    <div className={`adm-aviso ${tipo === "error" ? "aviso-error" : "aviso-ok"}`} role={tipo === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onCerrar && (
        <button type="button" className="adm-link" onClick={onCerrar} aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}

// Botón que pide confirmación en el mismo sitio (sin window.confirm).
export function BotonConfirmar({ etiqueta, confirmar = "¿Seguro?", onConfirmar, peligro = false, disabled }) {
  const [armado, setArmado] = useState(false);
  if (!armado) {
    return (
      <button type="button" className={peligro ? "adm-btn adm-btn--peligro" : "adm-btn"} disabled={disabled} onClick={() => setArmado(true)}>
        {etiqueta}
      </button>
    );
  }
  return (
    <span className="adm-confirmar">
      <span>{confirmar}</span>
      <button
        type="button"
        className="adm-btn adm-btn--peligro"
        onClick={() => {
          setArmado(false);
          onConfirmar();
        }}
      >
        Sí
      </button>
      <button type="button" className="adm-btn" onClick={() => setArmado(false)}>
        No
      </button>
    </span>
  );
}

export function Campo({ etiqueta, children, ayuda }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}

// Foto de un plato por URL absoluta. Si no carga, muestra un recuadro con el motivo en vez de un ícono roto.
export function FotoPlato({ url, alt = "", className = "adm-foto" }) {
  const [fallo, setFallo] = useState(false);
  const [previa, setPrevia] = useState(url);
  if (previa !== url) {
    setPrevia(url);
    setFallo(false);
  }
  if (!url) return <div className={`${className} adm-foto--vacia`}>Sin foto</div>;
  if (fallo) return <div className={`${className} adm-foto--vacia`} role="img" aria-label="No se pudo cargar la foto">No carga</div>;
  return <img className={className} src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFallo(true)} />;
}

export { formatoPrecio, parsearPrecio, parsearDescripcion, parsearImagen, MAX_DESCRIPCION, MAX_IMAGEN } from "./formato.js";
