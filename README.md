# Las Gambusinas — Launcher (Electron)

[![Repo](https://img.shields.io/badge/GitHub-hgartemis3515%2Flas--gambusinas--launcher-181717?logo=github)](https://github.com/hgartemis3515/las-gambusinas-launcher)

Panel nativo Windows para arrancar/detener **backend**, **app cocina** y **Expo (mozos)**, comprobar **MongoDB**, ver estado HTTP, ejecutar **git fetch/pull** en los tres repos, gestionar el manifiesto **`data/data.json`**, disparar **EAS Build** (APK) y opciones de **inicio automático**.

## Publicar en GitHub (`hgartemis3515/las-gambusinas-launcher`)

Desde esta máquina no hay `gh` ni token disponible para crear el remoto automáticamente. Hazlo una vez en el navegador y luego empuja el código ya versionado en esta carpeta.

1. Crea el repositorio vacío (sin README ni .gitignore) en: [github.com/new](https://github.com/new) con nombre **`las-gambusinas-launcher`** y propietario **`hgartemis3515`**.
2. En PowerShell, dentro de `launcher/`:
   ```powershell
   git remote add origin https://github.com/hgartemis3515/las-gambusinas-launcher.git
   git branch -M main
   git push -u origin main
   ```
   Si usas SSH: `git remote add origin git@github.com:hgartemis3515/las-gambusinas-launcher.git`

Si el monorepo padre ya es un repo Git y `launcher` aparece como carpeta sin seguimiento, puedes ignorar `launcher/` en el padre o mantener solo este `.git` dentro de `launcher` para publicar el iniciador por separado.

## Requisitos

- Windows 10+ (inicio automático y accesos directos probados en Windows).
- Node.js LTS y npm en el `PATH`.
- Git en el `PATH` (para la sección de repositorios).
- MongoDB accesible según el `.env` del backend (`DBLOCAL` o `MONGODB_URI`).
- Para APK: cuenta Expo y `eas login` en la máquina; variable `EXPO_TOKEN` si se usa CI.

## Uso en desarrollo

Desde la carpeta `launcher/`:

```bash
npm install
npm start
```

La configuración se guarda en `%APPDATA%\LasGambusinas\launcher-config.json`. El estado del asistente inicial en `launcher-state.json` en la misma carpeta.

## Empaquetar `.exe`

```bash
npm run dist
```

Salida en `launcher/dist/`. El script `scripts/create-shortcut.ps1` se copia a recursos extra para crear el acceso directo de inicio de Windows.

## Notas

- Borrar **`data/data.json`** (manifiesto) no vacía **MongoDB**; el panel lo indica antes de eliminar.
- El comprobador de MongoDB usa **mongoose** en el proceso del launcher (no requiere `mongosh`).
- **Metro** suele usar el puerto **8081**; si Expo usa otro, ajuste `ports.expoMetro` en la config y guarde.
