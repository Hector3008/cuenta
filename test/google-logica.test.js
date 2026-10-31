// Entrar con Google en el login de `cuenta` (5.69): lógica pura y cableado del Login. Sin navegador.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clientIdGoogle, mensajeDeErrorGoogle, URL_SCRIPT_GOOGLE } from "../client/src/google-logica.js";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

test("el script es el oficial de Google Identity Services", () => {
  assert.equal(URL_SCRIPT_GOOGLE, "https://accounts.google.com/gsi/client");
});

test("clientIdGoogle: solo se acepta un Client ID con su forma; cualquier otra cosa apaga el botón", () => {
  assert.equal(clientIdGoogle({ clientId: "1234567890-abc.apps.googleusercontent.com" }), "1234567890-abc.apps.googleusercontent.com");
  for (const malo of [{ clientId: null }, { clientId: "" }, {}, null, undefined, "x", { clientId: 5 }, { clientId: "evil.com/x.apps.googleusercontent.com" }, { clientId: "<script>.apps.googleusercontent.com" }, { clientId: "abc.apps.googleusercontent.com.evil.com" }, { clientId: "corto.apps.googleusercontent.com" }])
    assert.equal(clientIdGoogle(malo), null, JSON.stringify(malo));
});

test("mensajeDeErrorGoogle: el aviso de «sin cuenta» del servidor se muestra tal cual; el resto se traduce", () => {
  assert.equal(mensajeDeErrorGoogle({ status: 403, codigo: "GOOGLE_SIN_CUENTA", message: "No hay una cuenta activa. Pide acceso." }), "No hay una cuenta activa. Pide acceso.");
  assert.match(mensajeDeErrorGoogle({ status: 403, codigo: "GOOGLE_SIN_CUENTA" }), /Pide acceso a tu administrador/);
  assert.match(mensajeDeErrorGoogle({ status: 401, codigo: "GOOGLE_INVALIDO", message: "firma mala" }), /No se pudo comprobar tu cuenta de Google/);
  assert.doesNotMatch(mensajeDeErrorGoogle({ status: 401, codigo: "GOOGLE_INVALIDO" }), /contraseña incorrectos/);
  assert.match(mensajeDeErrorGoogle({ status: 503, codigo: "GOOGLE_NO_DISPONIBLE" }), /no está disponible/);
  assert.match(mensajeDeErrorGoogle({ status: 429, codigo: "DEMASIADOS_INTENTOS" }), /Demasiados intentos/);
  assert.match(mensajeDeErrorGoogle({ status: 500 }), /problema/);
  assert.match(mensajeDeErrorGoogle({ status: 0, message: "No se pudo conectar con el servidor." }), /conectar/);
  assert.match(mensajeDeErrorGoogle({ status: 400 }), /No se pudo entrar con Google/);
  assert.match(mensajeDeErrorGoogle(null), /inesperado/);
});

test("api.js pide la configuración por GET y manda el token por POST a /auth/google", () => {
  const src = leer("../client/src/api.js");
  assert.match(src, /googleConfig: \(\) => pedir\("GET", "auth\/google\/config"\)/);
  assert.match(src, /loginGoogle: \(credencial\) => pedir\("POST", "auth\/google", \{ credencial \}\)/);
});

test("Login.jsx: el botón solo sale si el servidor lo activa, usa su propio texto de error y luego entra como siempre", () => {
  const src = leer("../client/src/pantallas/Login.jsx");
  assert.match(src, /\{googleId && \(/, "sin Client ID no hay botón");
  assert.match(src, /clientIdGoogle\(r\)/);
  assert.match(src, /mensajeDeErrorGoogle\(err\)/, "no usa el «correo o contraseña incorrectos»");
  assert.match(src, /api\.loginGoogle\(credencial\)[\s\S]*await alEntrar\(\)/);
  assert.match(src, /deshabilitado=\{enviando\}/);
});

test("BotonGoogle.jsx: carga el script oficial una vez, pide el popup sin auto-selección y no guarda nada", () => {
  const src = leer("../client/src/pantallas/BotonGoogle.jsx");
  assert.match(src, /URL_SCRIPT_GOOGLE/);
  assert.match(src, /ux_mode: "popup"/);
  assert.match(src, /auto_select: false/);
  assert.doesNotMatch(src, /localStorage|sessionStorage|document\.cookie/);
});
