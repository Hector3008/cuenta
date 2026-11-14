import { useCallback, useEffect, useState } from "react";
import { api, comoLista, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import { normalizarInsumo } from "./inventario-logica.js";
import InventarioInsumos from "./InventarioInsumos.jsx";
import InventarioRecetas from "./InventarioRecetas.jsx";
import InventarioMovimientos from "./InventarioMovimientos.jsx";

const VISTAS = [
  ["insumos", "Insumos"],
  ["recetas", "Recetas"],
  ["movimientos", "Movimientos"],
];

// Sección Inventario (5.77): insumos con su existencia y costo promedio (kardex del núcleo, 5.75), recetas de los platos
// (tobt, 5.76) y el libro de movimientos. Ver pide kardex:leer; compras y mermas, kardex:registrar; insumos, saldo inicial,
// conteo y recetas, kardex:gestionar. Los insumos y la valorización se cargan aquí una vez y se comparten con las tres vistas.
export default function Inventario({ cap }) {
  const [vista, setVista] = useState("insumos");
  const [insumos, setInsumos] = useState([]);
  const [valorizacion, setValorizacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [preparar, setPreparar] = useState(null); // { tipo, insumoId, datos }: una compra o merma por volver a registrar

  const cargar = useCallback(async () => {
    setError("");
    try {
      // La lista llega de a 200 como máximo: se pide hasta tener todos (el tope por empresa son 2000).
      const todos = [];
      let total = Infinity;
      while (todos.length < total && todos.length < 2000) {
        const r = await api.get("kardex/insumos", { inactivos: 1, limite: 200, saltar: todos.length });
        const pagina = comoLista(r?.insumos ?? []);
        total = Number(r?.total) || 0;
        if (pagina.length === 0) break;
        todos.push(...pagina);
      }
      setInsumos(todos.map(normalizarInsumo));
      setValorizacion(await api.get("kardex/valorizacion"));
    } catch (err) {
      setError(mensajeAdmin(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // «Corregir» un movimiento: ya anulado, se abre el formulario de la compra o merma con los datos para cambiar lo que estaba mal.
  const corregir = (p) => { setPreparar(p); setVista("insumos"); };

  return (
    <section aria-labelledby="t-inventario">
      <header className="adm-cabecera">
        <h2 id="t-inventario">Inventario</h2>
      </header>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>

      <nav className="adm-subtabs" aria-label="Vistas del inventario">
        {VISTAS.map(([id, titulo]) => (
          <button key={id} type="button" aria-pressed={vista === id} className={vista === id ? "adm-btn adm-btn--primario" : "adm-btn"} onClick={() => setVista(id)}>
            {titulo}
          </button>
        ))}
      </nav>

      {cargando ? (
        <p className="adm-vacio">Cargando…</p>
      ) : (
        <>
          {vista === "insumos" && <InventarioInsumos cap={cap} insumos={insumos} valorizacion={valorizacion} recargar={cargar} preparar={preparar} alPreparar={() => setPreparar(null)} />}
          {vista === "recetas" && <InventarioRecetas cap={cap} insumos={insumos} />}
          {vista === "movimientos" && <InventarioMovimientos cap={cap} insumos={insumos} recargar={cargar} alCorregir={corregir} />}
        </>
      )}
    </section>
  );
}
