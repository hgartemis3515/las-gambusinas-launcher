# Las Gambusinas Launcher — Documentación del proyecto

## 1. Objetivo

El launcher es una **aplicación de escritorio nativa (Windows)** que centraliza el arranque, la supervisión y tareas operativas del **monorepo Las Gambusinas**:

- **Backend** (`Backend-LasGambusinas`): API/servidor Node, típicamente en el puerto configurado (por defecto 3000).
- **Cocina** (`appcocina`): aplicación web del front de cocina (puerto por defecto 3001).
- **Mozos** (`Las-Gambusinas`): proyecto **Expo/React Native**; el launcher ejecuta `npm run` del script Expo (Metro por defecto 8081).

**Metas de producto:**

1. Reducir fricción al iniciar o detener los tres servicios sin abrir tres terminales manualmente.
2. Ofrecer **visibilidad** del estado: MongoDB alcanzable, HTTP de cada app, procesos en curso, salida de logs unificada.
3. Facilitar **instalación y actualización**: detección de rutas del monorepo, clonación Git (`cloneUrls`), `git fetch` / comprobar detrás de remoto / `git pull`.
4. Gestionar **datos locales** del backend: listar JSON en `data/`, detectar manifiesto (`dataManifestPath`), abrir carpeta, eliminar solo el archivo manifiesto (sin tocar MongoDB).
5. Opcionalmente **autoinicio** del launcher con Windows y **autoinicio de servicios** al abrir el launcher.
6. Disparar **builds Android** vía **EAS CLI** (`npx eas build`) en modo no interactivo desde la UI.

No sustituye a un IDE ni a la documentación de cada repo; actúa como **panel de control operativo** para quien despliega o desarrolla en máquina Windows.

---

## 2. Stack y dependencias

| Pieza | Uso |
|-------|-----|
| **Electron** (`main`: `src/main.js`) | Ventana, IPC, `spawn`, diálogos, `shell.openExternal`, ciclo de vida de la app. |
| **Preload** (`src/preload.js`) | `contextBridge` expone `window.launcherAPI` hacia el renderer sin `nodeIntegration`. |
| **Renderer** (`renderer/index.html`, `renderer.js`, `styles.css`) | UI en español: secciones Resumen, Rutas, Servicios, Git, Datos, Mozos (APK), Avanzado, Registro. GSAP + Lucide (CDN en HTML si aplica). |
| **mongoose** | Solo para **ping** a MongoDB leyendo URI del `.env` del backend (`mongo-check.js`). |
| **tree-kill** | Terminar árbol de procesos al detener servicios o proceso EAS al salir. |
| **gsap**, **lucide** | Animaciones e iconos (alineado con Backend, appcocina y Expo). |
| **framer-motion** (`dom-mini`, import dinámico) | Animaciones ligeras WAAPI en vanilla, misma familia que **appcocina** (`framer-motion` en React). |
| **canvas-confetti** | Micro-celebraciones al guardar config / rutas / asistente inicial. |

**Empaquetado:** `electron-builder` — salida `dist/`, targets NSIS y portable x64, `extraResources` copia `scripts/` (p. ej. PowerShell para acceso directo de autostart).

---

## 3. Estructura de carpetas relevante

```
launcher/
├── package.json          # scripts start, pack, dist; build config
├── src/
│   ├── main.js           # proceso principal, IPC, auto-start, before-quit
│   ├── preload.js        # API expuesta al renderer
│   └── lib/
│       ├── config-store.js   # JSON usuario: launcher-config.json, launcher-state.json
│       ├── paths.js            # getMonorepoRoot (env + empaquetado vs dev)
│       ├── path-detector.js    # detectMonorepoRoot, nombres de carpetas fijas
│       ├── process-manager.js  # spawn npm run, logs, stop con tree-kill
│       ├── mongo-check.js      # conexión mongoose + ping
│       ├── http-status.js      # GET HTTP a backend, cocina, Expo Metro
│       ├── git-service.js      # git status, fetch, pull
│       ├── git-updates.js      # comprobar si hay commits detrás del remoto
│       ├── clone-service.js    # git clone --depth 1
│       ├── data-service.js     # listar JSON, borrar manifiesto
│       ├── autostart-win.js    # acceso directo en Startup de Windows
│       └── env-parse.js        # leer DBLOCAL / MONGODB_URI del .env del backend
├── renderer/             # UI estática servida con loadFile
├── scripts/              # recursos extra (create-shortcut.ps1) en build
├── tools/                # p. ej. kill-lockers antes de dist
└── doc/                  # esta documentación
```

---

## 4. Configuración persistente

### 4.1 Ubicación en disco

- **Windows:** `%APPDATA%\LasGambusinas\launcher-config.json` y `launcher-state.json`.
- **Otros:** `~/.config/las-gambusinas/` (el launcher está orientado a Windows).

`config-store.js` fusiona el archivo guardado con **`defaultConfig()`** para que nuevas claves tengan valor por defecto sin romper instalaciones antiguas.

### 4.2 Campos principales de `launcher-config.json`

| Clave | Rol |
|-------|-----|
| `paths.backend`, `paths.cocina`, `paths.mozos` | Directorios raíz de cada proyecto (deben existir para `npm run`). |
| `ports.backend`, `ports.cocina`, `expoMetro` | Usados en comprobaciones HTTP y enlaces. |
| `publicBaseUrl` | Base para abrir login / raíz del backend en el navegador. |
| `npmScripts.*` | Nombre del script npm (por defecto `start` para los tres). |
| `autoStartLauncherWithWindows` | Crea/elimina `.lnk` en el menú Inicio → Programas → Inicio. |
| `autoStartServicesOnLauncherOpen` | Tras cargar la ventana, ejecuta secuencia automática (ver §6). |
| `autoStartExpoWithServices` | Si el auto-start está activo, también arranca Expo tras cocina. |
| `delaysMs.afterBoot`, `delaysMs.betweenServiceStarts` | Esperas entre pasos del auto-start. |
| `mongodb.checkBeforeBackendStart` | Antes del backend en auto-start, ejecuta `checkMongo`. |
| `mongodb.forceBackendStartIfMongoFails` | Si es `false` y Mongo falla, no arranca el backend en auto-start. |
| `stopAllOnQuit` | En `before-quit`, detiene servicios (y EAS si aplica) antes de salir. |
| `cloneParentDir`, `cloneUrls` | Carpeta padre y URLs para clonar repos. |
| `dataManifestPath` | Ruta relativa al manifiesto dentro del backend (p. ej. `data/data.json`). |
| `showFirstRunWizard` | Controla si se muestra el overlay de primera ejecución. |
| `git.executable` | Comando Git (por defecto `git`). |

### 4.3 Estado (`launcher-state.json`)

Ejemplo: `firstLaunchCompletedAt` para no mostrar el asistente inicial hasta que el usuario lo marque.

### 4.4 Raíz del monorepo por defecto (`paths.js`)

- Variable de entorno **`LAUNCHER_MONOREPO_ROOT`**: si está definida, es la raíz preferida.
- **App empaquetada:** si no hay env, por defecto `%USERPROFILE%\PROYECTOGAMBUSINAS`.
- **Desarrollo (no empaquetado):** tres niveles arriba desde `src/lib` (típicamente la raíz del repo que contiene `launcher/`).

Los nombres de carpetas esperadas en detección y defaults son:

- `Backend-LasGambusinas`
- `appcocina`
- `Las-Gambusinas`

---

## 5. Arquitectura de seguridad y proceso

- **`contextIsolation: true`**, **`nodeIntegration: false`** en `BrowserWindow`.
- El renderer solo habla con Node vía **`ipcRenderer.invoke`** encapsulado en `launcherAPI`.
- **CSP** en `index.html`: `default-src 'self'`, `script-src 'self'` (ajustar si se cargan scripts externos).

---

## 6. Gestión de procesos (ProcessManager)

- Cada servicio es un hijo **`npm run <script>`** con `shell: true`, `windowsHide: true`, `cwd` resuelto.
- **Stdout/stderr** se reenvían como eventos `log` con `{ service, line, ts }`.
- **Inicio:** rechaza si ya hay proceso o si `cwd` no existe (`cwd_missing`, `already_running`).
- **Parada:** `tree-kill` con `SIGTERM` sobre el PID del `npm`.
- **`stopAll`:** backend, cocina, expo en secuencia.

**Proceso EAS** es independiente (`easChild` en `main.js`): también se mata con `tree-kill` en `before-quit` si sigue vivo.

---

## 7. Auto-arranque de servicios (`runAutoStartServices`)

Si `autoStartServicesOnLauncherOpen` es verdadero, tras `did-finish-load`:

1. Espera `afterBoot` ms.
2. Opcionalmente comprueba MongoDB; según flags puede **abortar** antes del backend.
3. Arranca **backend**; espera hasta ~45 s a que `http://127.0.0.1:<puerto>/` responda.
4. Tras `betweenServiceStarts`, arranca **cocina**.
5. Si `autoStartExpoWithServices`, tras otro intervalo arranca **expo**.

Los logs van al buffer y al renderer por `service-log`.

---

## 8. IPC — Referencia rápida

Canal (handler) | Función resumida |
|----------------|------------------|
| `get-config` / `save-config` | Leer/escribir JSON de configuración; al guardar sincroniza autostart Windows. |
| `get-state` / `save-state` | Estado persistente ligero. |
| `autostart-get` | Indica si existe el acceso directo de autostart (Windows). |
| `service-start` / `service-stop` / `service-status` | backend \| cocina \| expo. |
| `mongo-check` | Ping Mongo con URI desde `.env` del backend. |
| `http-apps-status` | GET concurrente a los tres URLs locales. |
| `git-status`, `git-fetch`, `git-pull` | `repoKey` → `cfg.paths[repoKey]`. |
| `git-check-updates` | Detrás/ahead respecto al remoto tras fetch lógico. |
| `data-list`, `data-delete-manifest`, `open-data-folder` | Carpeta `data/` del backend y manifiesto. |
| `open-external` | Abre URL en el navegador predeterminado. |
| `get-logs` | Últimas líneas del buffer de log del proceso principal. |
| `eas-build` | `preview` o `production` → `npx ... eas build -p android --non-interactive`. |
| `get-paths-hint` | Raíz del launcher (dev vs instalado). |
| `paths-auto-detect` / `paths-apply-detect` | Heurística de monorepo + guardar `paths` y `cloneParentDir`. |
| `repos-local-status` | Existe carpeta, git, `package.json` por repo. |
| `pick-directory` | Diálogo nativo de carpeta. |
| `git-clone-repo` | Clona un repo por clave y actualiza paths si OK. |
| `repos-clone-all` | Clona los que falten bajo `cloneParentDir` y actualiza config. |

**Push desde main:** `service-log` (suscripción en preload `onServiceLog`).

---

## 9. MongoDB

`readMongoUri` busca en el `.env` del backend las claves **`DBLOCAL`** o **`MONGODB_URI`**. `checkMongo` conecta con **mongoose**, ejecuta `ping` en admin y desconecta. Los errores y la URI enmascarada se muestran en la UI.

---

## 10. Datos JSON (`data-service`)

- Lista archivos `.json` en `<backend>/data/`.
- Comprueba existencia del archivo de **manifiesto** según `dataManifestPath`.
- **Eliminar manifiesto** solo borra ese archivo; la documentación en UI recalca que **no vacía MongoDB**.

---

## 11. Git y clonación

- **Estado:** rama, HEAD corto, dirty, línea de `git status`.
- **Actualizaciones:** `gitCheckUpdates` tras conocer el remoto (según implementación en `git-updates.js`).
- **Clonación:** `git clone --depth 1`; URLs por defecto en `defaultConfig` apuntan a repos públicos GitHub del autor; pueden sustituirse en config para repos privados (credenciales deben estar ya en el sistema Git).

---

## 12. UI (renderer)

Secciones de navegación lateral:

1. **Resumen** — tarjetas Mongo + HTTP, franja de estado local de repos, banners de datos, enlaces rápidos.
2. **Rutas e instalación** — detectar/guardar rutas, clonar, rutas manuales, URLs de clone.
3. **Servicios** — tarjetas iniciar/detener por servicio.
4. **Git y actualizaciones** — por repo: fetch, comprobar, pull con confirmación si dirty.
5. **Datos JSON** — listado, abrir carpeta, borrar manifiesto.
6. **Mozos (APK)** — botones EAS preview/production.
7. **Avanzado** — autostart Windows, autostart servicios, delays, Mongo flags, scripts npm, parar todo al cerrar.
8. **Registro** — área de texto con logs en tiempo real (polling 5 s de estado HTTP/servicios; Git cada 25 s).

**Asistente primera vez:** overlay hasta `firstLaunchCompletedAt` en state (y opción de no volver a mostrar escribiendo `showFirstRunWizard: false`).

---

## 13. Scripts npm del paquete launcher

| Script | Descripción |
|--------|-------------|
| `npm start` | Ejecuta Electron en desarrollo (`electron .`). |
| `npm run pack` | `electron-builder --dir` (empaquetado sin instalador completo). |
| `npm run dist` | Tras `predist` (mata lockers), genera instalador NSIS y portable en `dist/`. |

---

## 14. Limitaciones y notas operativas

- Requiere **Node/npm** instalados y accesibles en PATH para los `npm run` de los proyectos hijos.
- **EAS** depende de `npx`, proyecto Expo configurado y cuenta/credenciales EAS en el entorno del usuario.
- La detección de monorepo es **heurística**; si falla, las rutas se configuran a mano o vía clonación.
- El tamaño del buffer de log en memoria está acotado (p. ej. 600 entradas; la UI pide slice de logs recientes).

---

## 15. Repositorio y nombre del producto

- **Nombre npm:** `las-gambusinas-launcher`.
- **productName (build):** `Las Gambusinas Launcher`.
- **appId:** `com.lasgambusinas.launcher`.

Enlaces en `package.json`: repositorio, issues y homepage en GitHub del mantenedor.

---

*Documento generado para el código bajo `launcher/` en el monorepo del proyecto. Actualizar este archivo si cambian handlers IPC, rutas por defecto o flujos de auto-start.*
