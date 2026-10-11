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

export { formatoPrecio, parsearPrecio } from "./formato.js";
