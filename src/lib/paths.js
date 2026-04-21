const path = require('path');
const os = require('os');

/**
 * Raíz del monorepo donde viven Backend-LasGambusinas, appcocina y Las-Gambusinas.
 * - Desarrollo: carpeta padre de `launcher/`.
 * - Instalado (.exe): `LAUNCHER_MONOREPO_ROOT` si existe; si no `%USERPROFILE%\PROYECTOGAMBUSINAS` (editable en el panel).
 */
function getMonorepoRoot() {
  if (process.env.LAUNCHER_MONOREPO_ROOT) {
    return path.resolve(process.env.LAUNCHER_MONOREPO_ROOT);
  }
  try {
    const { app } = require('electron');
    if (app && app.isPackaged) {
      return path.join(os.homedir(), 'PROYECTOGAMBUSINAS');
    }
  } catch {
    /* sin electron en tests */
  }
  return path.resolve(__dirname, '..', '..', '..');
}

module.exports = { getMonorepoRoot };
