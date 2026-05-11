# Las Gambusinas Launcher

[![Repo](https://img.shields.io/badge/GitHub-hgartemis3515%2Flas--gambusinas--launcher-181717?logo=github)](https://github.com/hgartemis3515/las-gambusinas-launcher)

Panel nativo Windows para arrancar, detener y supervisar **Backend**, **App Cocina** y **Expo (Mozos)**, con MongoDB, Git, datos y builds APK.

## Novedades v1.1.0

- **Splash screen animada** con anillo de progreso y transicion al dashboard.
- **Barra de progreso animada** en "Iniciar todo" con pasos individuales por servicio (esperando, iniciando, activo, error, omitido).
- **Status strip global** en Resumen: chips Backend/Cocina/Mozos con indicador en tiempo real.
- **Correccion de puertos**: cada servicio se lanza con `PORT` como variable de entorno, respetando la configuracion del launcher.
- **Panel Avanzado reorganizado** por servicio con puerto, script npm y enlace rapido.
- **Enlaces rapidos corregidos**: Cocina abre en su puerto configurado.
- **Diseno oscuro profesional** con variables CSS, scrollbar custom y animaciones GSAP.

## Instalacion

### Desde el instalador (.exe)

1. Descarga `Las-Gambusinas-Launcher-Setup-1.1.0.exe` desde [Releases](https://github.com/hgartemis3515/las-gambusinas-launcher/releases).
2. Ejecuta el instalador. Puedes cambiar la carpeta de instalacion.
3. Se crean accesos directos en Escritorio y Menu Inicio.
4. Abre "Las Gambusinas Launcher" desde el acceso directo.

### Portable (sin instalacion)

1. Descarga `Las-Gambusinas-Launcher-1.1.0-Portable.exe` desde [Releases](https://github.com/hgartemis3515/las-gambusinas-launcher/releases).
2. Ejecuta directamente. No requiere instalacion.

### Desde codigo fuente (desarrollo)

```bash
cd launcher
npm install
npm start
```

Requisitos: Node.js 18+, npm, Git en PATH, MongoDB accessible.

## Uso

### Primera vez

Al abrir el launcher aparece un asistente que te guia para:
1. Detectar o configurar las rutas de los 3 repos.
2. Clonar los repos si faltan.
3. Verificar que MongoDB este accesible.

### Iniciar servicios

- **"Iniciar todo"** arranca Backend, Cocina y (opcionalmente) Mozos en secuencia con barra de progreso animada.
- Checkbox para incluir/excluir Mozos (Expo).
- En la seccion Servicios, cada servicio tiene botones Iniciar/Detener individuales.
- En Avanzado, activa "Al abrir: iniciar backend y cocina" para auto-inicio.

### Configuracion por servicio (Avanzado)

Cada servicio tiene su propio bloque en Avanzado:
- **Backend**: puerto (default 3000), script npm, URL base.
- **Cocina**: puerto (default 3001), script npm, enlace directo.
- **Mozos (Expo)**: puerto Metro (default 8081), script npm.

Los puertos se pasan como variable de entorno `PORT` al iniciar cada servicio.

### Git y actualizaciones

En "Git y actualizaciones": `fetch` + comprobar si hay commits nuevos, y `pull` para actualizar. Clonar los 3 repos desde "Rutas e instalacion".

### Build APK (Mozos)

Requiere `eas login` previo. Botones "Build Android - preview" y "Build Android - production" en la seccion Mozos.

## Empaquetar .exe

```bash
npm run dist
```

Genera en `dist/`:
- **NSIS installer** (Setup .exe con carpeta personalizable)
- **Portable** (.exe unico, sin instalacion)
- **win-unpacked/** (carpeta descomprimida para debug)

El script `predist` cierra el launcher si esta abierto para evitar bloqueos de archivo.

## Rutas del monorepo

Por defecto, el launcher busca los 3 proyectos en `%USERPROFILE%\PROYECTOGAMBUSINAS\`.

Alternativas:
- Ajustar rutas en "Rutas e instalacion" del launcher.
- Definir la variable de entorno `LAUNCHER_MONOREPO_ROOT` con la ruta absoluta al monorepo.

## Configuracion

Se guarda en `%APPDATA%\LasGambusinas\launcher-config.json`. Campos principales:

| Campo | Default | Descripcion |
|-------|---------|-------------|
| `ports.backend` | `3000` | Puerto HTTP del backend |
| `ports.cocina` | `3001` | Puerto HTTP de cocina |
| `ports.expoMetro` | `8081` | Puerto Metro de Expo |
| `npmScripts.backend` | `start` | Script npm para backend |
| `npmScripts.cocina` | `start` | Script npm para cocina |
| `npmScripts.expo` | `start` | Script npm para Expo |
| `autoStartServicesOnLauncherOpen` | `false` | Auto-iniciar al abrir launcher |
| `autoStartExpoWithServices` | `false` | Incluir Expo en auto-inicio |
| `stopAllOnQuit` | `true` | Detener servicios al cerrar launcher |
| `mongodb.checkBeforeBackendStart` | `true` | Comprobar Mongo antes de backend |

## Notas

- Borrar `data/data.json` (manifiesto) **no vacia MongoDB**.
- MongoDB se comprueba con **mongoose** (no requiere `mongosh`).
- Los puertos se respetan al iniciar: el launcher pasa `PORT` como variable de entorno a cada servicio.
- Auto-inicio con Windows crea un `.lnk` en la carpeta Startup del Menu Inicio.

## Licencia

Proyecto privado. Todos los derechos reservados.