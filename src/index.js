import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const DIST_POR_DEFECTO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "client",
  "dist"
);

/**
 * Sirve la aplicación compilada (client/dist). No abre conexiones ni usa el núcleo:
 * el navegador habla con /auth, /empleados, etc. del mismo gateway (mismo origen,
 * así la cookie `sid` funciona sin CORS).
 *
 * Montaje: gateway.use("/cuenta", createRouter())
 * El cliente calcula la ruta base de la API a partir de dónde se sirve (ver client/src/api.js),
 * así que funciona con cualquier BASE_PATH mientras se monte en `<base>/cuenta/`.
 */
export function createRouter({ dist = DIST_POR_DEFECTO } = {}) {
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    throw new Error(
      `cuenta: no existe ${path.join(dist, "index.html")}. Ejecuta "npm run build" y commitea client/dist.`
    );
  }
  const router = express.Router();
  router.use(
    express.static(dist, {
      index: "index.html",
      setHeaders(res, archivo) {
        // El HTML no se cachea; los archivos con hash en el nombre sí.
        if (archivo.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
        else res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    })
  );
  return router;
}
