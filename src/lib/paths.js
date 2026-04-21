const path = require('path');

/** Raíz del monorepo (PROYECTOGAMBUSINAS) desde launcher/src/lib */
function getMonorepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

module.exports = { getMonorepoRoot };
