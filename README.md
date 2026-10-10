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
npm test             # prueba del router
```

## Pantallas

La pantalla sale del estado de `/auth/yo`, sin enrutador:

sin sesión → `Login` · `debeCambiarPassword` → `CambiarPassword` · sin empresa activa → `ElegirEmpresa` · si no → `Perfil`.

`Perfil`: datos de la persona y empresa activa, cambio de empresa (si tiene varias), cambio de contraseña, PIN de tablet (solo si la empresa lo tiene habilitado) y cerrar sesión.

## Dónde está lo que depende del backend

Todo lo que supone la forma de las peticiones y respuestas de `/auth` está en `client/src/api.js` (`normalizarYo`, `extraerError`, `api`). Si algo difiere, se corrige solo ahí.

## Apariencia

`client/src/estilos.css` define las variables de diseño (`--color-principal`, `--fuente`, ...). Las pantallas no usan colores fijos: la apariencia por empresa (5.10) solo cambiará esos valores.
