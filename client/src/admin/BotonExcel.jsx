import { useState } from "react";
import { nombreArchivo, xlsxDeReporte } from "./reportes-excel.js";

// «Exportar a Excel» (5.87): arma el .xlsx en el navegador con lo que ya se ve en pantalla y lo descarga. `tipo`: ventas | inventario.
export default function BotonExcel({ tipo, datos }) {
  const [error, setError] = useState("");
  const exportar = () => {
    setError("");
    try {
      const bytes = xlsxDeReporte(tipo, datos);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo(tipo, datos);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError("No se pudo armar el Excel. Vuelve a intentarlo.");
    }
  };
  return (
    <span className="adm-excel">
      <button type="button" className="adm-btn" onClick={exportar} disabled={!datos}>Exportar a Excel</button>
      {error && <small role="alert" className="adm-nota adm-nota--alerta"> {error}</small>}
    </span>
  );
}
