const fs = require('fs');
const path = require('path');
const os = require('os');

const FOLDER_BACKEND = 'Backend-LasGambusinas';
const FOLDER_COCINA = 'appcocina';
const FOLDER_MOZOS = 'Las-Gambusinas';

function tripletExists(root) {
  if (!root || !fs.existsSync(root)) return false;
  const b = path.join(root, FOLDER_BACKEND);
  const c = path.join(root, FOLDER_COCINA);
  const m = path.join(root, FOLDER_MOZOS);
  return fs.existsSync(b) && fs.existsSync(c) && fs.existsSync(m);
}

function scoreRoot(root) {
  if (!tripletExists(root)) return 0;
  let n = 3;
  try {
    if (fs.existsSync(path.join(root, FOLDER_BACKEND, 'package.json'))) n += 2;
    if (fs.existsSync(path.join(root, FOLDER_COCINA, 'package.json'))) n += 2;
    if (fs.existsSync(path.join(root, FOLDER_MOZOS, 'package.json'))) n += 2;
  } catch {
    /* ignore */
  }
  return n;
}

/**
 * Busca carpeta que contiene las tres apps (hermanas).
 * @param {{ exeDir?: string }} opts
 */
function detectMonorepoRoot(opts = {}) {
  const candidates = [];
  const push = (p, source) => {
    if (!p) return;
    let norm;
    try {
      norm = path.resolve(p);
    } catch {
      return;
    }
    if (!candidates.some((c) => c.path === norm)) candidates.push({ path: norm, source });
  };

  if (process.env.LAUNCHER_MONOREPO_ROOT) {
    push(process.env.LAUNCHER_MONOREPO_ROOT, 'variable LAUNCHER_MONOREPO_ROOT');
  }

  push(path.join(os.homedir(), 'PROYECTOGAMBUSINAS'), '%USERPROFILE%\\PROYECTOGAMBUSINAS');
  push(path.join(os.homedir(), 'Documents', 'PROYECTOGAMBUSINAS'), 'Documentos\\PROYECTOGAMBUSINAS');
  push(path.join(os.homedir(), 'source', 'PROYECTOGAMBUSINAS'), 'source\\PROYECTOGAMBUSINAS');
  push(path.join(os.homedir(), 'repos', 'PROYECTOGAMBUSINAS'), 'repos\\PROYECTOGAMBUSINAS');

  const exeDir = opts.exeDir || (process.execPath ? path.dirname(process.execPath) : '');
  if (exeDir) {
    let cur = exeDir;
    for (let i = 0; i < 8; i += 1) {
      push(cur, `cerca del ejecutable (${i} niveles arriba)`);
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }

  try {
    const { app } = require('electron');
    if (app?.getAppPath) {
      let ap = app.getAppPath();
      if (ap.endsWith('.asar')) ap = path.dirname(ap);
      push(path.join(ap, '..'), 'carpeta padre del paquete launcher');
      let cur = ap;
      for (let i = 0; i < 6; i += 1) {
        push(cur, `desde ruta de la app (${i} niveles)`);
        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
      }
    }
  } catch {
    /* sin electron */
  }

  const cwd = process.cwd();
  if (cwd) {
    let cur = cwd;
    for (let i = 0; i < 5; i += 1) {
      push(cur, `desde cwd (${i} niveles)`);
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = scoreRoot(c.path);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  if (!best || bestScore < 3) {
    return {
      ok: false,
      root: null,
      source: null,
      paths: null,
      score: bestScore,
      tried: candidates.length,
    };
  }

  return {
    ok: true,
    root: best.path,
    source: best.source,
    paths: {
      backend: path.join(best.path, FOLDER_BACKEND),
      cocina: path.join(best.path, FOLDER_COCINA),
      mozos: path.join(best.path, FOLDER_MOZOS),
    },
    score: bestScore,
  };
}

function repoLocalStatus(dir) {
  if (!dir || typeof dir !== 'string') {
    return { exists: false, isGit: false, hasPackageJson: false, hasBackendIndex: false };
  }
  const exists = fs.existsSync(dir);
  if (!exists) {
    return { exists: false, isGit: false, hasPackageJson: false, hasBackendIndex: false };
  }
  const isGit = fs.existsSync(path.join(dir, '.git'));
  const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
  const hasBackendIndex = fs.existsSync(path.join(dir, 'index.js'));
  return { exists: true, isGit, hasPackageJson, hasBackendIndex };
}

module.exports = {
  detectMonorepoRoot,
  repoLocalStatus,
  FOLDER_BACKEND,
  FOLDER_COCINA,
  FOLDER_MOZOS,
};
