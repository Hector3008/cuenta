# cuenta

Cuenta de la persona: **login con contraseña**, selección de empresa y **perfil** (cambiar contraseña y PIN propios). React + Vite. El gateway lo sirve en el mismo origen, así que la cookie `sid` funciona sin CORS. No incluye las pantallas de ningún servicio: cada servicio trae su propio front.

## Montaje en el gateway

```js
import { createRouter as cuenta } from "cuenta";
gateway.use("/cuenta", cuenta());   // dentro del router `gateway`, para respetar BASE_PATH
```

Instalación: `npm install github:Hector3008/cuenta`. `client/dist` va commiteado (como en `microservicio-prueba-`).

Debe montarse en `<base>/cuenta/`: el cliente calcula la ruta de la API con `new URL("../", document.baseURI)`, sin conocer el BASE_PATH.

## Desarrollo

```
npm run dev          # Vite en :5173, con proxy a http://localhost:3000 (GATEWAY_URL para cambiarlo)
npm run build        # compila a client/dist (commitearlo)
npm test             # router, registro de destinos y página principal
```

## Pantallas

La pantalla sale del estado de `/auth/yo`, sin enrutador:

sin sesión → `Login` · `debeCambiarPassword` → `CambiarPassword` · sin empresa activa → `ElegirEmpresa` · si no → `Inicio` (o la página principal de la persona, una vez por entrada). `Perfil` se abre desde Inicio.

`Inicio`: saludo, empresa y rol, y un acceso por cada destino que la persona puede ver. Es un **lanzador**: cada servicio trae su propio front y aquí solo se enlaza a él.

`Administracion` (`client/src/admin/`): vista con pestañas **Equipo**, **Catálogo** y **Empresa**, con CRUD según permisos (`usuario:gestionar`, `catalogo:leer|crear|editar|gestionar`, `rol:gestionar`). Se abre desde los destinos `empresa.equipo`, `empresa.catalogo` y `empresa.datos` de Inicio. Usa `pedir` de `api.js` y `permite` de `destinos.js`; lo que supone de las respuestas de `/empleados` y `/catalogo` (listas, contraseña temporal) está en `admin/Equipo.jsx` y `admin/http.js`. La empresa es solo de lectura: el núcleo no tiene ruta para editarla.

`Perfil`: datos de la persona y empresa activa, página principal, cambio de empresa (si tiene varias), cambio de contraseña, PIN de tablet (solo si la empresa lo tiene habilitado) y cerrar sesión.

## Destinos y página principal

`client/src/destinos.js` es el **registro único** de destinos. Un acceso se muestra si está `disponible`, la empresa tiene el servicio contratado y activo (`yo.servicios`) y la persona tiene el permiso (`yo.permisos`, misma regla que `permite` del núcleo). Mostrar u ocultar aquí **no es seguridad**: la seguridad vive en el backend.

Para sumar el front de un servicio: activar su línea en `DESTINOS` (`disponible: true` y `abre: { enlace: "tobt/" }`, ruta relativa al gateway). Los destinos previstos sin pantalla se quedan con `disponible: false` y no aparecen.

`paginaPrincipal` (preferencia global de la persona, `PUT /auth/preferencias`) guarda el **id** de un destino, nunca una URL. Al entrar se abre una sola vez por persona y empresa y por pestaña (marca en `sessionStorage`), nunca antes del cambio obligatorio de contraseña y se reevalúa al cambiar de empresa. Si el destino ya no aplica (otra empresa, rol cambiado, retirado), se queda en Inicio sin error. Cerrar sesión olvida las marcas.

## Dónde está lo que depende del backend

Todo lo que supone la forma de las peticiones y respuestas de `/auth` está en `client/src/api.js` (`normalizarYo`, `extraerError`, `api`). Si algo difiere, se corrige solo ahí.

## Apariencia

`client/src/estilos.css` define las variables de diseño (`--color-principal`, `--fuente`, ...). Las pantallas no usan colores fijos: la apariencia por empresa (5.10) solo cambiará esos valores.
