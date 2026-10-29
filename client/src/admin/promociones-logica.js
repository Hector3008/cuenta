// Lógica pura de la pantalla de Promociones (5.41): formulario ↔ cuerpo de la API, y los textos que describen
// una promoción. Sin React ni navegador, para probarla con `node --test`. Las reglas de verdad viven en el núcleo
// (core/src/promociones/validacion.js): aquí solo se avisa pronto y con palabras claras; el servidor valida siempre.

// Las promociones las calcula el núcleo pero hoy solo las aplica tobt (a los pedidos, 5.42): sin ese servicio la
// pestaña no se ofrece, igual que Reportes.
export const SERVICIO_PROMOCIONES = "tobt";

export const TIPOS_PROMOCION = [
  ["nxm", "Lleva N, paga M (2x1, 3x2)"],
  ["combo", "Si lleva A, B con descuento"],
  ["directo", "Descuento directo"],
];
export const EFECTOS_PROMOCION = [
  ["porcentaje", "Porcentaje"],
  ["monto", "Monto fijo por unidad"],
  ["gratis", "Gratis"],
];
// De lunes a domingo (el núcleo cuenta 0 = domingo)
export const DIAS_SEMANA = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [0, "Dom"]];
export const MAX_LINEAS_PRUEBA = 20;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const CODIGO = /^[A-Za-z0-9._\-/]{1,40}$/;
const aNumero = (t) => (String(t ?? "").trim() === "" ? NaN : Number(String(t).trim().replace(",", ".")));
const dosDecimales = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const textoDe = (t) => String(t ?? "").trim();

// ---------- formulario ----------

const selectorAForm = (s) => (s?.categoria ? { tipo: "categoria", valor: s.categoria } : { tipo: "item", valor: s?.itemCodigo ?? "" });

/** El formulario (todo texto) de una promoción, o el de una nueva si `p` es null. */
export function formularioDePromocion(p) {
  const objetivo = selectorAForm(p?.objetivo);
  const disparador = selectorAForm(p?.disparador);
  return {
    tipo: p?.tipo ?? "nxm",
    nombre: p?.nombre ?? "",
    descripcion: p?.descripcion ?? "",
    objetivoTipo: objetivo.tipo,
    objetivoValor: objetivo.valor,
    disparadorTipo: disparador.tipo,
    disparadorValor: disparador.valor,
    n: String(p?.n ?? 2),
    m: String(p?.m ?? 1),
    efecto: p?.efecto ?? "porcentaje",
    valor: p?.valor === null || p?.valor === undefined ? "" : String(p.valor),
    desde: p?.vigencia?.desde ?? "",
    hasta: p?.vigencia?.hasta ?? "",
    dias: Array.isArray(p?.dias) ? [...p.dias] : [],
    horaDesde: p?.horario?.desde ?? "",
    horaHasta: p?.horario?.hasta ?? "",
    topeDiario: p?.topes?.diario ? String(p.topes.diario) : "",
    topePedido: p?.topes?.porPedido ? String(p.topes.porPedido) : "",
    topeCliente: p?.topes?.porCliente ? String(p.topes.porCliente) : "",
    prioridad: String(p?.prioridad ?? 100),
    acumulable: p?.acumulable === true,
    activa: p?.activa !== false,
  };
}

export const MAX_TOPE = 100000;

/** Un tope vacío es «sin tope» (null); si no, un entero de 1 a 100.000. */
function parsearTope(texto, nombre) {
  const t = textoDe(texto);
  if (!t) return { valor: null };
  const n = aNumero(t);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TOPE) return { error: `${nombre}: déjalo vacío o pon un entero de 1 a 100.000.` };
  return { valor: n };
}

function selector(tipo, valor, nombre) {
  const v = textoDe(valor);
  if (!v) return { error: `${nombre}: escribe ${tipo === "categoria" ? "la categoría" : "el código del ítem"}.` };
  if (tipo === "categoria") {
    if (v.length > 60) return { error: `${nombre}: la categoría puede tener hasta 60 caracteres.` };
    return { valor: { categoria: v } };
  }
  if (!CODIGO.test(v)) return { error: `${nombre}: el código solo lleva letras, números, punto, guion o barra (hasta 40).` };
  return { valor: { itemCodigo: v } };
}

/**
 * El formulario → el cuerpo que se envía, o { ok: false, error }. El cuerpo lleva solo los campos del tipo elegido
 * (el núcleo rechaza los que no le corresponden) y `null` en vigencia, días y horario cuando están vacíos, para
 * que al editar se quiten de verdad.
 */
export function parsearPromocion(f) {
  const nombre = textoDe(f.nombre);
  if (!nombre) return { ok: false, error: "Ponle un nombre a la promoción." };
  if (nombre.length > 80) return { ok: false, error: "El nombre puede tener hasta 80 caracteres." };
  const descripcion = textoDe(f.descripcion);
  if (descripcion.length > 200) return { ok: false, error: "La descripción puede tener hasta 200 caracteres." };
  const prioridad = aNumero(f.prioridad);
  if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 1000) return { ok: false, error: "La prioridad es un número entero de 0 a 1000 (menor se evalúa antes)." };

  const cuerpo = { nombre, descripcion: descripcion || null, tipo: f.tipo, prioridad, acumulable: f.acumulable === true, activa: f.activa !== false };

  const objetivo = selector(f.objetivoTipo, f.objetivoValor, f.tipo === "combo" ? "Lo que recibe el descuento" : "Producto");
  if (objetivo.error) return { ok: false, error: objetivo.error };
  cuerpo.objetivo = objetivo.valor;

  if (f.tipo === "nxm") {
    const n = aNumero(f.n);
    const m = aNumero(f.m);
    if (!Number.isInteger(n) || n < 2 || n > 10) return { ok: false, error: "«Lleva» es un entero de 2 a 10." };
    if (!Number.isInteger(m) || m < 1) return { ok: false, error: "«Paga» es un entero desde 1." };
    if (m >= n) return { ok: false, error: "«Paga» tiene que ser menor que «lleva» (2x1: lleva 2, paga 1)." };
    cuerpo.n = n;
    cuerpo.m = m;
  } else if (f.tipo === "combo" || f.tipo === "directo") {
    if (f.tipo === "combo") {
      const d = selector(f.disparadorTipo, f.disparadorValor, "Si lleva");
      if (d.error) return { ok: false, error: d.error };
      cuerpo.disparador = d.valor;
    }
    cuerpo.efecto = f.efecto;
    if (f.efecto === "gratis") cuerpo.valor = null;
    else {
      const v = aNumero(f.valor);
      if (!Number.isFinite(v) || v <= 0 || !dosDecimales(v)) return { ok: false, error: "El valor del descuento es un número mayor que 0, con hasta 2 decimales." };
      if (f.efecto === "porcentaje" && v > 100) return { ok: false, error: "Un porcentaje no puede pasar de 100." };
      if (f.efecto === "monto" && v > 1_000_000) return { ok: false, error: "El monto no puede pasar de 1.000.000." };
      cuerpo.valor = v;
    }
  } else {
    return { ok: false, error: "Elige el tipo de promoción." };
  }

  const desde = textoDe(f.desde);
  const hasta = textoDe(f.hasta);
  if (desde && hasta && hasta < desde) return { ok: false, error: "La fecha «hasta» no puede ser antes que «desde»." };
  cuerpo.vigencia = desde || hasta ? { desde: desde || null, hasta: hasta || null } : null;

  const dias = [...new Set((f.dias ?? []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
  cuerpo.dias = dias.length ? dias : null;

  const hd = textoDe(f.horaDesde);
  const hh = textoDe(f.horaHasta);
  if (!!hd !== !!hh) return { ok: false, error: "El horario necesita las dos horas, «desde» y «hasta» (o ninguna)." };
  if (hd && hd === hh) return { ok: false, error: "Las horas «desde» y «hasta» no pueden ser iguales." };
  cuerpo.horario = hd ? { desde: hd, hasta: hh } : null;

  const diario = parsearTope(f.topeDiario, "Máximo por día");
  if (diario.error) return { ok: false, error: diario.error };
  const porPedido = parsearTope(f.topePedido, "Máximo por pedido");
  if (porPedido.error) return { ok: false, error: porPedido.error };
  const porCliente = parsearTope(f.topeCliente, "Máximo por cliente y día");
  if (porCliente.error) return { ok: false, error: porCliente.error };
  // `null` cuando no hay ninguno: al editar, así se quitan de verdad.
  cuerpo.topes = diario.valor || porPedido.valor || porCliente.valor ? { diario: diario.valor, porPedido: porPedido.valor, porCliente: porCliente.valor } : null;

  return { ok: true, cuerpo };
}

// ---------- textos ----------

const lugar = (s) => (s?.categoria ? `la categoría «${s.categoria}»` : `«${s?.itemCodigo ?? "?"}»`);
const numeroEs = (n) => String(n).replace(".", ",");

function textoEfecto(p) {
  if (p.efecto === "gratis") return "gratis";
  if (p.efecto === "porcentaje") return `${numeroEs(p.valor)} % de descuento`;
  return `${numeroEs(Number(p.valor).toFixed(2))} de descuento por unidad`;
}

/** Qué hace, en una frase. */
export function textoQueHace(p) {
  if (p.tipo === "nxm") return `Lleva ${p.n}, paga ${p.m}: ${lugar(p.objetivo)}`;
  if (p.tipo === "combo") return `Si lleva ${lugar(p.disparador)}, ${lugar(p.objetivo)} con ${textoEfecto(p)}`;
  return `${textoEfecto(p).replace(/^./, (c) => c.toUpperCase())} en ${lugar(p.objetivo)}`;
}

/** «2026-11-01» → «1 nov 2026» (sin pasar por Date: no hay zona que lo cambie de día). */
export function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : String(iso ?? "");
}

/** Cuándo rige, en una frase. Sin condiciones: «Siempre». */
export function textoCuando(p) {
  const partes = [];
  if (Array.isArray(p.dias) && p.dias.length) {
    const etiqueta = Object.fromEntries(DIAS_SEMANA);
    partes.push(p.dias.length === 7 ? "Todos los días" : [...p.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => etiqueta[d]).join(", "));
  }
  if (p.horario?.desde) partes.push(`${p.horario.desde} a ${p.horario.hasta}`);
  const v = p.vigencia;
  if (v?.desde && v?.hasta) partes.push(`del ${fechaCorta(v.desde)} al ${fechaCorta(v.hasta)}`);
  else if (v?.desde) partes.push(`desde el ${fechaCorta(v.desde)}`);
  else if (v?.hasta) partes.push(`hasta el ${fechaCorta(v.hasta)}`);
  return partes.length ? partes.join(" · ") : "Siempre";
}

/** Los límites de uso, en una frase («Máx. 50 al día · 2 por pedido · 1 por cliente al día»); vacío si no hay. */
export function textoTopes(p) {
  const t = p?.topes;
  if (!t) return "";
  const partes = [];
  if (t.diario) partes.push(`Máx. ${t.diario} al día`);
  if (t.porPedido) partes.push(`${t.porPedido} por pedido`);
  if (t.porCliente) partes.push(`${t.porCliente} por cliente al día`);
  return partes.join(" · ");
}

// ---------- probar con un pedido de ejemplo ----------

export const lineaDePrueba = () => ({ codigo: "", categoria: "", cantidad: "1", precio: "" });

/**
 * Las filas del formulario de prueba → `items` de POST /promociones/simular, o { ok: false, error }. Una fila
 * completamente vacía se ignora; el `id` es la posición entre las filas usadas, para ubicar el resultado.
 */
export function parsearItemsPrueba(filas) {
  const items = [];
  for (const [i, f] of (filas ?? []).entries()) {
    const codigo = textoDe(f.codigo);
    const vacia = !codigo && !textoDe(f.categoria) && !textoDe(f.precio);
    if (vacia) continue;
    const fila = `Fila ${i + 1}`;
    if (!codigo || codigo.length > 40) return { ok: false, error: `${fila}: escribe el código del producto (hasta 40 caracteres).` };
    const cantidad = aNumero(f.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) return { ok: false, error: `${fila}: la cantidad es un entero de 1 a 99.` };
    const precio = aNumero(f.precio);
    if (!Number.isFinite(precio) || precio < 0 || precio > 1_000_000) return { ok: false, error: `${fila}: el precio de una unidad es un número desde 0.` };
    const categoria = textoDe(f.categoria);
    items.push({ id: String(items.length), codigo, categoria: categoria || null, cantidad, precio });
  }
  if (!items.length) return { ok: false, error: "Agrega al menos un producto con su precio." };
  return { ok: true, items };
}

/**
 * «2026-10-22T20:00» (el valor de un campo datetime-local) → ISO, con la hora de ESTE navegador; null si no es válida.
 * El núcleo la lee en la zona de la empresa: si el navegador está en otra zona, la hora puede correrse.
 */
export function ahoraDeNavegador(valor) {
  const t = textoDe(valor);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
