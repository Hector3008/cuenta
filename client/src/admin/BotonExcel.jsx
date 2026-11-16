import { useState } from "react";
import { mensajeAdmin } from "./http.js";
import { nombreArchivo, xlsxDeReporte } from "./reportes-excel.js";

// «Exportar a Excel» (5.87): arma el .xlsx en el navegador con lo que ya se ve en pantalla y lo descarga. `tipo`: ventas | inventario.
// `obtener` (5.89, opcional): pide al servidor los datos completos (sin el «top») antes de armar el archivo; si no, usa `datos`.
export default function BotonExcel({ tipo, datos, obtener }) {
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const exportar = async () => {
    setError("");
    setTrabajando(true);
    try {
      const fuente = obtener ? await obtener() : datos;
      const bytes = xlsxDeReporte(tipo, fuente);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo(tipo, fuente);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(obtener && e?.status !== undefined ? mensajeAdmin(e) : "No se pudo armar el Excel. Vuelve a intentarlo.");
    } finally {
      setTrabajando(false);
    }
  };
  return (
    <span className="adm-excel">
      <button type="button" className="adm-btn" onClick={exportar} disabled={!datos || trabajando}>{trabajando ? "Preparando…" : "Exportar a Excel"}</button>
      {error && <small role="alert" className="adm-nota adm-nota--alerta"> {error}</small>}
    </span>
  );
}
