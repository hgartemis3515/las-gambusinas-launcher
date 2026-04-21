const fs = require('fs');
const path = require('path');
const { getMonorepoRoot } = require('./paths');

function getAppDataDir() {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    return path.join(base, 'LasGambusinas');
  }
  return path.join(process.env.HOME || '', '.config', 'las-gambusinas');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function configPath() {
  return path.join(getAppDataDir(), 'launcher-config.json');
}

function statePath() {
  return path.join(getAppDataDir(), 'launcher-state.json');
}

function defaultConfig() {
  const root = getMonorepoRoot();
  return {
    paths: {
      backend: path.join(root, 'Backend-LasGambusinas'),
      cocina: path.join(root, 'appcocina'),
      mozos: path.join(root, 'Las-Gambusinas'),
    },
    ports: { backend: 3000, cocina: 3001, expoMetro: 8081 },
    publicBaseUrl: 'http://127.0.0.1:3000',
    autoStartLauncherWithWindows: false,
    autoStartServicesOnLauncherOpen: false,
    autoStartExpoWithServices: false,
    delaysMs: { afterBoot: 3000, betweenServiceStarts: 2000 },
    mongodb: {
      checkBeforeBackendStart: true,
      forceBackendStartIfMongoFails: false,
      mongoshPath: 'mongosh',
    },
    git: { executable: 'git' },
    /** Carpeta padre donde se clonan las tres carpetas (si está vacío, se usa la raíz del monorepo detectada). */
    cloneParentDir: '',
    /** URLs Git públicas (editar si tus repos tienen otro nombre o son privados). */
    cloneUrls: {
      backend: 'https://github.com/hgartemis3515/Backend-LasGambusinas.git',
      cocina: 'https://github.com/hgartemis3515/appcocina.git',
      mozos: 'https://github.com/hgartemis3515/Las-Gambusinas.git',
    },
    dataManifestPath: 'data/data.json',
    showFirstRunWizard: true,
    npmScripts: {
      /** `start` = node sin reinicios por archivos en data/. Use `dev` (nodemon) solo para desarrollo activo. */
      backend: 'start',
      cocina: 'start',
      expo: 'start',
    },
    stopAllOnQuit: true,
  };
}

function loadConfig() {
  ensureDir(getAppDataDir());
  const p = configPath();
  if (!fs.existsSync(p)) {
    const d = defaultConfig();
    fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
    return d;
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    const def = defaultConfig();
    return {
      ...def,
      ...parsed,
      paths: { ...def.paths, ...(parsed.paths || {}) },
      ports: { ...def.ports, ...(parsed.ports || {}) },
      delaysMs: { ...def.delaysMs, ...(parsed.delaysMs || {}) },
      mongodb: { ...def.mongodb, ...(parsed.mongodb || {}) },
      npmScripts: { ...def.npmScripts, ...(parsed.npmScripts || {}) },
      git: { ...def.git, ...(parsed.git || {}) },
      cloneUrls: { ...def.cloneUrls, ...(parsed.cloneUrls || {}) },
      cloneParentDir:
        parsed.cloneParentDir !== undefined && parsed.cloneParentDir !== null
          ? parsed.cloneParentDir
          : def.cloneParentDir,
    };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(cfg) {
  ensureDir(getAppDataDir());
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

function loadState() {
  ensureDir(getAppDataDir());
  const p = statePath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  ensureDir(getAppDataDir());
  const cur = loadState();
  fs.writeFileSync(statePath(), JSON.stringify({ ...cur, ...state }, null, 2), 'utf8');
}

module.exports = {
  getAppDataDir,
  configPath,
  statePath,
  defaultConfig,
  loadConfig,
  saveConfig,
  loadState,
  saveState,
};
