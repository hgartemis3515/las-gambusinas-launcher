const fs = require('fs');
const path = require('path');

function dataDir(backendRoot) {
  return path.join(backendRoot, 'data');
}

function manifestPath(backendRoot, relativeManifest) {
  return path.join(backendRoot, ...relativeManifest.split(/[/\\]/));
}

function listJsonFiles(backendRoot, dataManifestPath) {
  const dir = dataDir(backendRoot);
  const man = manifestPath(backendRoot, dataManifestPath);
  if (!fs.existsSync(dir)) return { dir, files: [], manifestExists: fs.existsSync(man) };
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((name) => {
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      return { name, path: fp, size: st.size, mtime: st.mtimeMs };
    });
  return { dir, files, manifestExists: fs.existsSync(man) };
}

function manifestExists(backendRoot, dataManifestPath) {
  return fs.existsSync(manifestPath(backendRoot, dataManifestPath));
}

function deleteManifest(backendRoot, dataManifestPath) {
  const p = manifestPath(backendRoot, dataManifestPath);
  if (!fs.existsSync(p)) return { ok: true, message: 'El archivo no existía.' };
  fs.unlinkSync(p);
  return { ok: true, message: 'Eliminado: ' + p };
}

module.exports = {
  dataDir,
  manifestPath,
  listJsonFiles,
  manifestExists,
  deleteManifest,
};
