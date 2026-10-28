import { useMemo, useRef, useState } from "react";
import { ErrorApi } from "../api.js";
import { api, mensajeAdmin } from "./http.js";
import { Aviso } from "./piezas.jsx";
import { ErrorXlsx, MAX_BYTES_ARCHIVO, crearXlsx, leerXlsx } from "./xlsx.js";
import {
  MAX_ERRORES_MOSTRADOS, MAX_FILAS_IMPORTACION, TIPOS, construirFilas, erroresDelServidor, hojasPlantilla, resumenTexto, tiposDisponibles, ubicarColumnas,
} from "./importar-logica.js";

// Sección Importar (5.64): carga el catálogo o los clientes desde un archivo de Excel (.xlsx).
// El archivo se lee AQUÍ, en el navegador (no se sube a ningún servidor): se convierten las celdas en filas y se mandan a la API
// que ya existe (`catalogo/importar` y `clientes/importar`). Primero se simula (no escribe nada) y solo si todo está bien se
// habilita «Importar». Todo o nada: con una fila mala no se carga ninguna.

function descargarPlantilla(tipo) {
  const bytes = crearXlsx(hojasPlantilla(tipo));
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TIPOS[tipo].archivoPlantilla;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TablaErrores({ errores }) {
  if (!errores.length) return null;
  const mostrados = errores.slice(0, MAX_ERRORES_MOSTRADOS);
  return (
    <div className="adm-tabla-caja">
      <table className="adm-tabla">
        <thead>
          <tr>
            <th>Fila del archivo</th>
            <th>Qué corregir</th>
          </tr>
        </thead>
        <tbody>
          {mostrados.map((e, i) => (
            <tr key={i}>
              <td className="adm-num">{e.fila ?? "—"}</td>
              <td>{e.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {errores.length > mostrados.length && <p className="adm-nota">Y {errores.length - mostrados.length} más. Corrige estas y vuelve a subir el archivo.</p>}
    </div>
  );
}

export default function Importar({ cap }) {
  const tipos = useMemo(() => tiposDisponibles(cap), [cap]);
  const [tipo, setTipo] = useState(tipos[0]?.id ?? "catalogo");
  const [lectura, setLectura] = useState(null); // lo leído del archivo y lo que respondió la simulación
  const [estado, setEstado] = useState("vacio"); // vacio | leyendo | listo | importando | hecho
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [clave, setClave] = useState(0); // reinicia el selector de archivo
  const peticion = useRef(0);
  const def = TIPOS[tipo];

  function reiniciar(nuevoTipo) {
    peticion.current++;
    if (nuevoTipo) setTipo(nuevoTipo);
    setLectura(null);
    setEstado("vacio");
    setError("");
    setResultado(null);
    setClave((c) => c + 1);
  }

  async function alElegir(ev) {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    const mia = ++peticion.current;
    setError("");
    setResultado(null);
    setLectura(null);
    setEstado("leyendo");
    try {
      if (!/\.xlsx$/i.test(archivo.name)) throw new ErrorXlsx("El archivo debe ser un Excel moderno (.xlsx). En Excel: Guardar como → «Libro de Excel (.xlsx)».");
      if (archivo.size > MAX_BYTES_ARCHIVO) throw new ErrorXlsx("El archivo pesa más de 5 MB.");
      const { filas: hoja, truncado } = leerXlsx(new Uint8Array(await archivo.arrayBuffer()));
      if (hoja.length < 2) throw new ErrorXlsx("La hoja no tiene datos: la primera fila son los encabezados y los datos van debajo.");
      const { columnas, ignoradas, errores: erroresColumnas } = ubicarColumnas(tipo, hoja);
      const base = { archivo: archivo.name, ignoradas, columnas, truncado, filas: [], numeros: [], errores: [], resumen: null, vacias: 0 };
      if (erroresColumnas.length) {
        setLectura({ ...base, erroresColumnas });
        setEstado("listo");
        return;
      }
      const { filas, numeros, errores, vacias } = construirFilas(tipo, hoja, columnas);
      Object.assign(base, { filas, numeros, errores, vacias });
      if (!filas.length && !errores.length) throw new ErrorXlsx("No hay filas con datos debajo de los encabezados.");
      if (filas.length + errores.length > MAX_FILAS_IMPORTACION)
        throw new ErrorXlsx(`El archivo tiene ${filas.length + errores.length} filas con datos y el máximo por carga es ${MAX_FILAS_IMPORTACION}. Divídelo en varios archivos.`);
      if (truncado) throw new ErrorXlsx("El archivo tiene demasiadas filas. Divídelo en varios archivos de hasta 500 filas.");
      // Con problemas evidentes en la hoja no se envía nada: se corrigen primero.
      if (errores.length) {
        setLectura(base);
        setEstado("listo");
        return;
      }
      try {
        const resumen = await api.post(def.ruta, { filas, simular: true });
        if (mia !== peticion.current) return;
        setLectura({ ...base, resumen });
      } catch (e) {
        if (mia !== peticion.current) return;
        if (e instanceof ErrorApi && e.codigo === "IMPORTACION_INVALIDA") setLectura({ ...base, errores: erroresDelServidor(e.datos, numeros) });
        else throw e;
      }
      setEstado("listo");
    } catch (e) {
      if (mia !== peticion.current) return;
      setError(e instanceof ErrorXlsx ? e.message : mensajeAdmin(e));
      setLectura(null);
      setEstado("vacio");
      setClave((c) => c + 1);
    }
  }

  async function importar() {
    if (estado !== "listo" || !lectura?.resumen) return;
    const mia = ++peticion.current;
    setEstado("importando");
    setError("");
    try {
      const r = await api.post(def.ruta, { filas: lectura.filas });
      if (mia !== peticion.current) return;
      setResultado(r);
      setEstado("hecho");
    } catch (e) {
      if (mia !== peticion.current) return;
      if (e instanceof ErrorApi && e.codigo === "IMPORTACION_INVALIDA") {
        setLectura({ ...lectura, resumen: null, errores: erroresDelServidor(e.datos, lectura.numeros) });
        setError("Mientras tanto cambió algo y ahora hay filas con problemas. No se cargó nada.");
      } else setError(mensajeAdmin(e));
      setEstado("listo");
    }
  }

  const campos = def.columnas.filter((c) => lectura && c.campo in lectura.columnas);
  const hayProblemas = !!lectura && (lectura.erroresColumnas?.length > 0 || lectura.errores.length > 0);
  const previa = lectura && !hayProblemas ? lectura.filas.slice(0, 5) : [];

  return (
    <section className="adm-importar" aria-labelledby="imp-titulo">
      <header className="adm-cabecera">
        <h2 id="imp-titulo">Importar desde Excel</h2>
      </header>

      {tipos.length > 1 && (
        <div className="adm-tabs adm-tabs--sub" role="tablist" aria-label="Qué importar">
          {tipos.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tipo === t.id} className={tipo === t.id ? "adm-tab adm-tab--activa" : "adm-tab"} onClick={() => tipo !== t.id && reiniciar(t.id)}>
              {t.titulo}
            </button>
          ))}
        </div>
      )}

      <ol className="adm-pasos">
        <li>
          <strong>Baja la plantilla</strong> y copia tus {tipo === "catalogo" ? "productos" : "clientes"} ahí (o usa tu propio archivo con los mismos encabezados).{" "}
          <button type="button" className="adm-btn" onClick={() => descargarPlantilla(tipo)}>
            Descargar plantilla (.xlsx)
          </button>
        </li>
        <li>
          <strong>Sube el archivo.</strong> Se revisa en tu navegador y con el servidor, pero todavía no se guarda nada.
          <div>
            <input key={clave} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={alElegir} disabled={estado === "leyendo" || estado === "importando"} aria-label={`Archivo de Excel de ${def.titulo.toLowerCase()}`} />
          </div>
        </li>
        <li>
          <strong>Revisa y confirma.</strong> Si hay una fila con problemas no se carga ninguna: corrige el archivo y vuelve a subirlo.
        </li>
      </ol>
      <p className="adm-nota">
        {tipo === "catalogo"
          ? "El Código identifica al producto: si ya existe se actualiza, si no se crea. Una celda vacía no borra datos."
          : "Se reconoce al cliente por su teléfono o su correo: si ya existe se actualiza, si no se crea. Una celda vacía no borra datos. Importar no da consentimientos."}{" "}
        Hasta {MAX_FILAS_IMPORTACION} filas por archivo.
      </p>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {estado === "leyendo" && <p role="status">Leyendo el archivo…</p>}

      {lectura && estado !== "hecho" && (
        <div className="adm-importar-lectura">
          <p>
            <strong>{lectura.archivo}</strong>
            {lectura.filas.length + lectura.errores.length > 0 && <> · {lectura.filas.length + lectura.errores.length} filas con datos</>}
            {lectura.vacias > 0 && <> ({lectura.vacias} vacías, se saltan)</>}
          </p>
          {lectura.ignoradas.length > 0 && <p className="adm-nota">Columnas que no se usan: {lectura.ignoradas.join(", ")}.</p>}
          {lectura.erroresColumnas?.length > 0 && (
            <Aviso>
              {lectura.erroresColumnas.join(" ")} Revisa los encabezados de la primera fila (o descarga la plantilla).
            </Aviso>
          )}
          {lectura.errores.length > 0 && (
            <>
              <Aviso>{`${lectura.errores.length} fila(s) con problemas: no se cargó nada. Corrígelas en el archivo y vuelve a subirlo.`}</Aviso>
              <TablaErrores errores={lectura.errores} />
            </>
          )}
          {lectura.resumen && !hayProblemas && (
            <>
              <Aviso tipo="ok">{resumenTexto(lectura.resumen, tipo)}</Aviso>
              {lectura.resumen.inactivos?.length > 0 && (
                <p className="adm-nota">Filas {lectura.resumen.inactivos.join(", ")}: están desactivados; se actualizan pero siguen desactivados.</p>
              )}
              <div className="adm-tabla-caja">
                <table className="adm-tabla">
                  <caption>Primeras {previa.length} filas, tal como se enviarán</caption>
                  <thead>
                    <tr>
                      {campos.map((c) => (
                        <th key={c.campo}>{c.titulo}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map((f, i) => (
                      <tr key={i}>
                        {campos.map((c) => (
                          <td key={c.campo}>{valorPrevia(f, c.campo)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="adm-acciones">
                <button type="button" className="adm-btn adm-btn--primario" onClick={importar} disabled={estado === "importando"}>
                  {estado === "importando" ? "Importando…" : `Importar ${lectura.filas.length} ${tipo === "catalogo" ? "productos" : "clientes"}`}
                </button>
                <button type="button" className="adm-btn" onClick={() => reiniciar()} disabled={estado === "importando"}>
                  Cancelar
                </button>
              </div>
            </>
          )}
          {hayProblemas && (
            <div className="adm-acciones">
              <button type="button" className="adm-btn" onClick={() => reiniciar()}>
                Subir otro archivo
              </button>
            </div>
          )}
        </div>
      )}

      {estado === "hecho" && resultado && (
        <div className="adm-importar-lectura">
          <Aviso tipo="ok">{resumenTexto({ ...resultado, simulado: false }, tipo)}</Aviso>
          {resultado.omitidos?.length > 0 && (
            <Aviso>{`Las filas ${lectura.numeros.filter((_, i) => resultado.omitidos.includes(i + 1)).join(", ")} no se cargaron porque otra persona cambió esos datos a la vez. Súbelo de nuevo para completarlas.`}</Aviso>
          )}
          {resultado.inactivos?.length > 0 && <p className="adm-nota">Había desactivados entre los actualizados; siguen desactivados.</p>}
          <div className="adm-acciones">
            <button type="button" className="adm-btn" onClick={() => reiniciar()}>
              Importar otro archivo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function valorPrevia(f, campo) {
  if (campo === "imagen") return f.atributos?.IMAGEN ? "✓ enlace" : "";
  if (campo === "descripcion") return f.atributos?.DESCRIPCION ?? "";
  if (campo === "documentoTipo") return f.identificacion?.tipo ?? "";
  if (campo === "documentoNumero") return f.identificacion?.numero ?? "";
  if (["instagram", "tiktok", "facebook", "x"].includes(campo)) return f.redes?.[campo] ?? "";
  return f[campo] === undefined || f[campo] === null ? "" : String(f[campo]);
}
