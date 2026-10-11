// Lógica pura de formato (sin JSX, para poder probarla con node --test).

// Precio para mostrar. La moneda de la empresa (5.16) todavía no llega al front (/auth/yo no la
// informa): sin moneda conocida se muestra el número con 2 decimales y no se inventa un símbolo.
// null = sin precio.
export function formatoPrecio(precio, moneda) {
  if (precio === null || precio === undefined) return "—";
  const n = Number(precio);
  if (!Number.isFinite(n)) return "—";
  if (!moneda) return n.toFixed(2);
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency: moneda }).format(n);
  } catch {
    return `${n.toFixed(2)} ${moneda}`;
  }
}

// El núcleo rechaza más de 2 decimales (5.16): se valida antes de enviar.
export function parsearPrecio(texto) {
  const t = String(texto ?? "").trim().replace(",", ".");
  if (t === "") return { ok: true, valor: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false };
  return { ok: true, valor: Number(t) };
}
