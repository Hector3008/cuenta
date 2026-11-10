import { useCallback, useEffect, useMemo, useState } from "react";
import { urlDeServicio } from "../api.js";
import { api, mensajeAdmin } from "./http.js";
import { Aviso, BotonConfirmar, Campo } from "./piezas.jsx";
import QrJuego from "./QrJuego.jsx";
import { empresaActiva } from "./permisos.js";
import {
  CAMPOS_REGLAS, LIMITES, avisosDeCambio, cambiosParaGuardar, enlaceJuego, enlaceMesero, normalizarRespuesta, nuevoColor, nuevoPremio,
  problemas, quitarColor, renombrarColor, resumenPreguntas, sinPregunta,
} from "./juego-logica.js";

// Pestaña «Juego» (5.82): configura el juego de agatas de la empresa (servicio `agatas`) y muestra el QR del local.
// Pide juego:configurar. El servidor valida todo otra vez; aquí se avisa antes de guardar.

const urlApp = () => new URL(urlDeServicio("agatas/app/"), window.location.origin).toString();

export default function Juego({ yo }) {
  const [original, setOriginal] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [avisosServidor, setAvisosServidor] = useState([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const r = normalizarRespuesta(await api.get("agatas/config"));
      setOriginal(r.config);
      setBorrador(r.config);
      setAvisosServidor(r.advertencias);
      setGuardada(r.guardada);
      setError("");
    } catch (e) {
      setError(mensajeAdmin(e));
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambios = useMemo(() => (original && borrador ? cambiosParaGuardar(original, borrador) : {}), [original, borrador]);
  const sucio = Object.keys(cambios).length > 0;
  const fallas = useMemo(() => (borrador ? problemas(borrador) : []), [borrador]);
  const avisos = useMemo(() => (original && borrador ? avisosDeCambio(original, borrador) : []), [original, borrador]);

  // Avisa si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return undefined;
    const f = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sucio]);

  if (!borrador) return error ? <Aviso>{error}</Aviso> : <p className="cargando">Cargando el juego…</p>;

  const set = (fn) => setBorrador((b) => fn(structuredClone(b)));
  const idsGuardados = original.colores.map((c) => c.id);
  const singular = borrador.personaje.singular || "agata";
  const plural = borrador.personaje.plural || "agatas";

  async function guardar() {
    setOk("");
    if (fallas.length) return setError(fallas[0].mensaje);
    setError("");
    setGuardando(true);
    try {
      const r = normalizarRespuesta(await api.put("agatas/config", cambios));
      setOriginal(r.config);
      setBorrador(r.config);
      setAvisosServidor(r.advertencias);
      setGuardada(true);
      setOk("Juego guardado. Los cambios ya se ven al jugar.");
    } catch (e) {
      setError(mensajeAdmin(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby="t-juego" className="adm-juego">
      <header className="adm-cabecera">
        <h2 id="t-juego">Juego de {plural}</h2>
      </header>
      {!guardada && <Aviso tipo="ok">Todavía no guardaste nada: se muestran los valores de ejemplo. Escribe las preguntas y guarda para empezar.</Aviso>}
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setOk("")}>{ok}</Aviso>
      {avisosServidor.map((m) => (
        <Aviso key={m}>{m}</Aviso>
      ))}

      <details className="adm-juego-bloque" open>
        <summary>QR del local y enlaces</summary>
        <EnlaceQr yo={yo} />
      </details>

      <details className="adm-juego-bloque" open>
        <summary>Piezas y colores</summary>
        <div className="adm-juego-grid">
          <Campo etiqueta="Nombre de cada pieza (singular)">
            <input value={borrador.personaje.singular} maxLength={LIMITES.nombreMax} onChange={(e) => set((b) => ((b.personaje.singular = e.target.value), b))} />
          </Campo>
          <Campo etiqueta="Nombre de las piezas (plural)">
            <input value={borrador.personaje.plural} maxLength={LIMITES.nombreMax} onChange={(e) => set((b) => ((b.personaje.plural = e.target.value), b))} />
          </Campo>
          <Campo etiqueta={`${capital(plural)} por color`} ayuda={`De 1 a ${LIMITES.agatasPorColorMax}. Cada una lleva su pregunta.`}>
            <input type="number" min={1} max={LIMITES.agatasPorColorMax} value={borrador.agatasPorColor} onChange={(e) => set((b) => ((b.agatasPorColor = Number(e.target.value)), b))} />
          </Campo>
          <Campo etiqueta="Tamaño de la mano" ayuda={`Cuántas ${plural} recibe cada jugador. No puede ser mayor que las de cada color.`}>
            <input type="number" min={1} max={LIMITES.manoMax} value={borrador.manoPorJugador} onChange={(e) => set((b) => ((b.manoPorJugador = Number(e.target.value)), b))} />
          </Campo>
        </div>
        <h3 className="adm-juego-sub">Colores</h3>
        <ul className="adm-juego-lista">
          {borrador.colores.map((c, i) => (
            <li key={i} className="adm-juego-fila">
              <input type="color" aria-label={`Color de ${c.nombre || "este color"}`} value={/^#[0-9a-f]{6}$/.test(c.hex) ? c.hex : "#999999"} onChange={(e) => set((b) => ((b.colores[i].hex = e.target.value), b))} />
              <input aria-label={`Nombre del color ${i + 1}`} value={c.nombre} maxLength={LIMITES.nombreMax} placeholder="Nombre" onChange={(e) => setBorrador((b) => renombrarColor(b, i, e.target.value, idsGuardados))} />
              <code className="adm-juego-id" title="Identificador interno: no cambia">{c.id}</code>
              <BotonConfirmar etiqueta="Quitar" confirmar="¿Quitar?" peligro disabled={borrador.colores.length <= LIMITES.coloresMin} onConfirmar={() => setBorrador((b) => quitarColor(b, i))} />
            </li>
          ))}
        </ul>
        <button type="button" className="adm-btn" disabled={borrador.colores.length >= LIMITES.coloresMax} onClick={() => setBorrador((b) => nuevoColor(b))}>+ Agregar color</button>
        <label className="adm-juego-check">
          <input type="checkbox" checked={borrador.requiereCuenta} onChange={(e) => set((b) => ((b.requiereCuenta = e.target.checked), b))} />
          <span>Pedir cuenta para jugar <small>(todavía no está disponible en la pantalla de juego: déjalo apagado)</small></span>
        </label>
      </details>

      <details className="adm-juego-bloque" open>
        <summary>Premios</summary>
        <p className="adm-nota">Cada premio se gana al juntar cierta cantidad de colores distintos en la mano (tu propio color también cuenta). El jugador muestra un código y el mesero lo valida.</p>
        <ul className="adm-juego-lista">
          {borrador.premios.map((p, i) => (
            <li key={p.id} className="adm-juego-premio">
              <Campo etiqueta="Colores distintos">
                <input type="number" min={1} max={borrador.colores.length} value={p.umbral} onChange={(e) => set((b) => ((b.premios[i].umbral = Number(e.target.value)), b))} />
              </Campo>
              <Campo etiqueta="Premio">
                <input value={p.nombre} maxLength={80} placeholder="Ej.: 3 stickers" onChange={(e) => set((b) => ((b.premios[i].nombre = e.target.value), b))} />
              </Campo>
              <Campo etiqueta="Detalle (opcional)">
                <input value={p.descripcion} maxLength={300} onChange={(e) => set((b) => ((b.premios[i].descripcion = e.target.value), b))} />
              </Campo>
              <BotonConfirmar etiqueta="Quitar" confirmar="¿Quitar?" peligro onConfirmar={() => set((b) => (b.premios.splice(i, 1), b))} />
            </li>
          ))}
        </ul>
        <button type="button" className="adm-btn" disabled={borrador.premios.length >= LIMITES.premiosMax} onClick={() => setBorrador((b) => nuevoPremio(b))}>+ Agregar premio</button>
      </details>

      <details className="adm-juego-bloque" open>
        <summary>
          Preguntas ({sinPregunta(borrador).length === 0 ? "completas" : `faltan ${sinPregunta(borrador).length}`})
        </summary>
        <p className="adm-nota">Cada {singular} trae su pregunta. Al aceptar un intercambio, las dos personas ven la pregunta de la {singular} que reciben y la de la que entregan.</p>
        {resumenPreguntas(borrador).map(({ color, faltan, total }) => (
          <fieldset key={color.id} className="adm-juego-preguntas">
            <legend>
              <span className="adm-juego-punto" style={{ background: color.hex }} aria-hidden="true" /> {color.nombre || color.id} <small>{faltan === 0 ? `${total} de ${total}` : `faltan ${faltan} de ${total}`}</small>
            </legend>
            {Array.from({ length: borrador.agatasPorColor }, (_, n) => {
              const codigo = `${color.id}-${n + 1}`;
              return (
                <label key={codigo} className="adm-juego-pregunta">
                  <span>{n + 1}</span>
                  <input value={borrador.preguntas[codigo] ?? ""} maxLength={LIMITES.preguntaMax} placeholder="Escribe la pregunta" aria-label={`Pregunta ${n + 1} de ${color.nombre || color.id}`} onChange={(e) => set((b) => ((b.preguntas[codigo] = e.target.value), b))} />
                </label>
              );
            })}
          </fieldset>
        ))}
      </details>

      <details className="adm-juego-bloque">
        <summary>Textos</summary>
        <Campo etiqueta="Instrucciones" ayuda="Se muestran a quien entra al juego.">
          <textarea rows={4} maxLength={LIMITES.textoMax} value={borrador.textos.instrucciones} onChange={(e) => set((b) => ((b.textos.instrucciones = e.target.value), b))} />
        </Campo>
        <Campo etiqueta="Reglas" ayuda="Las bases del juego y de los premios.">
          <textarea rows={4} maxLength={LIMITES.textoMax} value={borrador.textos.reglas} onChange={(e) => set((b) => ((b.textos.reglas = e.target.value), b))} />
        </Campo>
      </details>

      <details className="adm-juego-bloque">
        <summary>Reglas y topes</summary>
        <p className="adm-nota">Los valores por defecto sirven para casi todos los locales. Cambia un tope solo si lo necesitas.</p>
        <div className="adm-juego-grid">
          {CAMPOS_REGLAS.map(([k, titulo, ayuda, min, max, unidad]) => (
            <Campo key={k} etiqueta={`${titulo}${unidad ? ` (${unidad})` : ""}`} ayuda={ayuda}>
              <input type="number" min={min} max={max} value={borrador.reglas[k]} onChange={(e) => set((b) => ((b.reglas[k] = Number(e.target.value)), b))} />
            </Campo>
          ))}
        </div>
      </details>

      <div className="adm-juego-barra" role="region" aria-label="Guardar">
        <div className="adm-juego-estado" aria-live="polite">
          {fallas.length > 0 ? <span className="adm-juego-falla">{fallas[0].mensaje}{fallas.length > 1 ? ` (y ${fallas.length - 1} más)` : ""}</span> : sucio ? <span>Tienes cambios sin guardar.</span> : <span className="adm-nota">Todo guardado.</span>}
          {avisos.map((m) => (
            <small key={m} className="adm-juego-aviso">{m}</small>
          ))}
        </div>
        <div className="adm-acciones">
          <button type="button" className="adm-btn" disabled={!sucio || guardando} onClick={() => setBorrador(original)}>Descartar</button>
          <button type="button" className="adm-btn adm-btn--primario" disabled={!sucio || guardando || fallas.length > 0} onClick={guardar}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </div>
    </section>
  );
}

const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");

function EnlaceQr({ yo }) {
  const activa = empresaActiva(yo);
  const [slug, setSlug] = useState(activa?.slug ?? "");
  const app = urlApp();
  const enlace = enlaceJuego(app, slug);
  const [copiado, setCopiado] = useState(false);

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles: el enlace se puede seleccionar a mano */
    }
  }

  return (
    <div className="adm-juego-qr">
      {!activa?.slug && (
        <Campo etiqueta="Identificador de la empresa" ayuda="Es la parte de la dirección que identifica a tu empresa (por ejemplo «mi-cafe»).">
          <input value={slug} spellCheck={false} onChange={(e) => setSlug(e.target.value)} placeholder="mi-cafe" />
        </Campo>
      )}
      {enlace ? (
        <div className="qr-imprimible">
          <QrJuego texto={enlace} titulo="Código QR para entrar al juego" />
          <p className="qr-texto">Escanea para jugar</p>
          <p className="qr-enlace"><code>{enlace}</code></p>
        </div>
      ) : (
        <p className="adm-nota">Escribe el identificador de la empresa para generar el QR.</p>
      )}
      <div className="adm-acciones adm-juego-acciones-qr">
        <button type="button" className="adm-btn adm-btn--primario" disabled={!enlace} onClick={() => window.print()}>Imprimir QR</button>
        <button type="button" className="adm-btn" disabled={!enlace} onClick={() => copiar(enlace)}>{copiado ? "Copiado ✓" : "Copiar enlace"}</button>
        <a className="adm-btn" href={enlaceMesero(app)}>Pantalla del mesero</a>
      </div>
      <p className="adm-nota">El mismo QR sirve para todas las personas: cada una recibe un color al azar al entrar. El mesero abre su pantalla con su usuario de la empresa y el rol del juego.</p>
    </div>
  );
}

// Re-exportado para las pruebas manuales; el resto de pantallas importa solo el componente.
export { enlaceJuego, enlaceMesero };
