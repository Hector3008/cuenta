// Lógica pura de la pantalla de Reseñas (5.62): filtros, estado y textos. Sin React ni navegador, para probarla con `node --test`.
// Las reseñas las guarda y modera el núcleo (core/src/resenas); aquí solo se muestran y se ocultan o se vuelven a mostrar.
import { fechaCorta } from "./promociones-logica.js";

// Las reseñas las escriben los clientes en la carta pública de tobt: sin ese servicio la pestaña no se ofrece.
export const SERVICIO_RESENAS = "tobt";

export const FILTROS_RESENA = [
  ["reportadas", "Reportadas"],
  ["todas", "Todas"],
  ["ocultas", "Ocultas"],
];
export const FILTRO_RESENA_INICIAL = "reportadas";

/** Una reseña tal como llega de la API, con valores seguros. */
export function normalizarResena(r) {
  return {
    id: String(r?.id ?? ""),
    itemCodigo: String(r?.itemCodigo ?? ""),
    itemNombre: String(r?.itemNombre ?? r?.itemCodigo ?? ""),
    autor: String(r?.autor ?? "Anónimo"),
    estrellas: Number.isInteger(r?.estrellas) ? r.estrellas : 0,
    texto: typeof r?.texto === "string" && r.texto ? r.texto : null,
    oculta: r?.oculta === true,
    reportes: Number.isInteger(r?.reportes) && r.reportes > 0 ? r.reportes : 0,
    ts: r?.ts ?? null,
  };
}

/** «Visible», «Oculta» o «Visible · 2 reportes». */
export function estadoResena(r) {
  if (r.oculta) return "Oculta";
  if (r.reportes > 0) return `Visible · ${r.reportes} ${r.reportes === 1 ? "reporte" : "reportes"}`;
  return "Visible";
}

/** «★★★★☆» para mostrar la nota en la tabla. */
export const estrellasTexto = (n) => {
  const k = Math.min(5, Math.max(0, Number(n) || 0));
  return "★".repeat(k) + "☆".repeat(5 - k);
};

/** La fecha de una reseña como «20 oct 2026», o vacío. */
export const fechaResena = (ts) => (ts ? fechaCorta(String(ts).slice(0, 10)) : "");

/** Lo que se dice cuando no hay filas, según el filtro. */
export const textoVacioResenas = (filtro) =>
  ({
    reportadas: "No hay reseñas reportadas. Los clientes pueden reportar una desde la carta.",
    ocultas: "No hay reseñas ocultas.",
    todas: "Todavía no hay reseñas. Aparecen cuando un cliente que ya pagó un plato deja su opinión en la carta.",
  })[filtro] ?? "No hay reseñas.";
