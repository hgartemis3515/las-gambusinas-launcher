const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { loadConfig, saveConfig, loadState, saveState } = require('./lib/config-store');
const { ProcessManager } = require('./lib/process-manager');
const { checkMongo } = require('./lib/mongo-check');
const { appsStatus } = require('./lib/http-status');
const { gitStatus, runGit } = require('./lib/git-service');
const { listJsonFiles, deleteManifest } = require('./lib/data-service');
const { setWindowsAutostart, isAutostartEnabled } = require('./lib/autostart-win');
const { detectMonorepoRoot, repoLocalStatus, FOLDER_BACKEND, FOLDER_COCINA, FOLDER_MOZOS } = require('./lib/path-detector');
const { gitClone } = require('./lib/clone-service');
const { gitCheckUpdates } = require('./lib/git-updates');
const { getMonorepoRoot } = require('./lib/paths');

/** Carpeta del proyecto launcher (desarrollo) o carpeta del .exe instalado (producción). */
function getLauncherRoot() {
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '..');
}

let mainWindow = null;
const pm = new ProcessManager();
const logBuffer = [];
const MAX_LOG = 600;
/** @type {import('child_process').ChildProcess | null} */
let easChild = null;
let allowQuitAfterCleanup = false;

function pushLog(entry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG) logBuffer.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service-log', entry);
  }
}

pm.on('log', (entry) => pushLog(entry));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForBackendHttp(cfg, maxAttempts = 45) {
  const { checkUrl } = require('./lib/http-status');
  const url = `http://127.0.0.1:${cfg.ports.backend}/`;
  for (let i = 0; i < maxAttempts; i += 1) {
    const r = await checkUrl(url, 2000);
    if (r.ok) return true;
    await sleep(1000);
  }
  return false;
}

async function runAutoStartServices() {
  const cfg = loadConfig();
  if (!cfg.autoStartServicesOnLauncherOpen) return;

  const delay = cfg.delaysMs?.afterBoot ?? 3000;
  const between = cfg.delaysMs?.betweenServiceStarts ?? 2000;
  pushLog({ service: 'launcher', line: `[auto] Esperando ${delay} ms antes de servicios…`, ts: Date.now() });
  await sleep(delay);

  if (cfg.mongodb?.checkBeforeBackendStart) {
    pushLog({ service: 'launcher', line: '[auto] Comprobando MongoDB…', ts: Date.now() });
    const m = await checkMongo(cfg.paths.backend);
    if (!m.ok) {
      pushLog({
        service: 'launcher',
        line: `[auto] MongoDB: ${m.message} (${m.uriMasked || ''})`,
        ts: Date.now(),
      });
      if (!cfg.mongodb?.forceBackendStartIfMongoFails) {
        pushLog({
          service: 'launcher',
          line: '[auto] No se inicia el backend (config: forceBackendStartIfMongoFails=false).',
          ts: Date.now(),
        });
        return;
      }
    }
  }

  const b = pm.start('backend', {
    cwd: cfg.paths.backend,
    npmScript: cfg.npmScripts?.backend || 'start',
    env: { PORT: String(cfg.ports?.backend ?? 3000) },
  });
  if (!b.ok) return;

  const up = await waitForBackendHttp(cfg);
  if (!up) {
    pushLog({ service: 'launcher', line: '[auto] Backend no respondió HTTP a tiempo.', ts: Date.now() });
  }

  await sleep(between);
  pm.start('cocina', {
    cwd: cfg.paths.cocina,
    npmScript: cfg.npmScripts?.cocina || 'start',
    env: { PORT: String(cfg.ports?.cocina ?? 3001) },
  });

  if (cfg.autoStartExpoWithServices) {
    await sleep(between);
    pm.start('expo', {
      cwd: cfg.paths.mozos,
      npmScript: cfg.npmScripts?.expo || 'start',
      env: { PORT: String(cfg.ports?.expoMetro ?? 8081) },
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 800,
    minWidth: 880,
    minHeight: 640,
    show: false,
    backgroundColor: '#06090f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Las Gambusinas — Launcher',
    frame: true,
    autoHideMenuBar: true,
  });

  const rendererIndex = path.join(app.getAppPath(), 'renderer', 'index.html');
  mainWindow.loadFile(rendererIndex);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.once('did-finish-load', () => {
    const cfg = loadConfig();
    if (cfg.autoStartServicesOnLauncherOpen) {
      runAutoStartServices().catch((e) =>
        pushLog({ service: 'launcher', line: `[auto] Error: ${e.message}`, ts: Date.now() }),
      );
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function syncAutostartShortcut(cfg) {
  if (process.platform !== 'win32') return;
  const launcherDir = getLauncherRoot();
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', 'create-shortcut.ps1')
    : path.join(launcherDir, 'scripts', 'create-shortcut.ps1');
  setWindowsAutostart({
    enabled: !!cfg.autoStartLauncherWithWindows,
    isPackaged: app.isPackaged,
    exePath: process.execPath,
    launcherDir,
    scriptPath,
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async (e) => {
  const cfg = loadConfig();
  if (!cfg.stopAllOnQuit) return;
  if (allowQuitAfterCleanup) return;
  e.preventDefault();
  pushLog({ service: 'launcher', line: '[launcher] Deteniendo servicios…', ts: Date.now() });
  if (easChild && easChild.pid) {
    const treeKill = require('tree-kill');
    await new Promise((res) => treeKill(easChild.pid, 'SIGTERM', () => res()));
    easChild = null;
  }
  await pm.stopAll();
  allowQuitAfterCleanup = true;
  app.quit();
});

ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (_e, cfg) => {
  saveConfig(cfg);
  syncAutostartShortcut(cfg);
  return { ok: true };
});

ipcMain.handle('get-state', () => loadState());
ipcMain.handle('save-state', (_e, partial) => {
  saveState(partial);
  return { ok: true };
});

ipcMain.handle('autostart-get', () => ({
  windowsShortcutPresent: process.platform === 'win32' ? isAutostartEnabled() : false,
}));

ipcMain.handle('service-start', (_e, service) => {
  const cfg = loadConfig();
  if (service === 'backend') {
    return pm.start('backend', { cwd: cfg.paths.backend, npmScript: cfg.npmScripts?.backend || 'start', env: { PORT: String(cfg.ports?.backend ?? 3000) } });
  }
  if (service === 'cocina') {
    return pm.start('cocina', { cwd: cfg.paths.cocina, npmScript: cfg.npmScripts?.cocina || 'start', env: { PORT: String(cfg.ports?.cocina ?? 3001) } });
  }
  if (service === 'expo') {
    return pm.start('expo', { cwd: cfg.paths.mozos, npmScript: cfg.npmScripts?.expo || 'start', env: { PORT: String(cfg.ports?.expoMetro ?? 8081) } });
  }
  return { ok: false, error: 'unknown_service' };
});

ipcMain.handle('service-stop', async (_e, service) => {
  if (service === 'backend' || service === 'cocina' || service === 'expo') {
    return pm.stop(service);
  }
  return { ok: false, error: 'unknown_service' };
});

ipcMain.handle('service-status', () => pm.status());

ipcMain.handle('mongo-check', async () => {
  const cfg = loadConfig();
  return checkMongo(cfg.paths.backend);
});

ipcMain.handle('http-apps-status', async () => {
  const cfg = loadConfig();
  return appsStatus(cfg);
});

ipcMain.handle('git-status', async (_e, repoKey) => {
  const cfg = loadConfig();
  const dir = cfg.paths[repoKey];
  if (!dir) return { error: 'bad_repo' };
  return gitStatus(dir, cfg.git?.executable || 'git');
});

ipcMain.handle('git-fetch', async (_e, repoKey) => {
  const cfg = loadConfig();
  const dir = cfg.paths[repoKey];
  if (!dir) return { ok: false, error: 'bad_repo' };
  return runGit(dir, ['fetch', '--all'], cfg.git?.executable || 'git');
});

ipcMain.handle('git-pull', async (_e, repoKey) => {
  const cfg = loadConfig();
  const dir = cfg.paths[repoKey];
  if (!dir) return { ok: false, error: 'bad_repo' };
  return runGit(dir, ['pull'], cfg.git?.executable || 'git');
});

ipcMain.handle('data-list', () => {
  const cfg = loadConfig();
  return listJsonFiles(cfg.paths.backend, cfg.dataManifestPath || 'data/data.json');
});

ipcMain.handle('data-delete-manifest', () => {
  const cfg = loadConfig();
  return deleteManifest(cfg.paths.backend, cfg.dataManifestPath || 'data/data.json');
});

ipcMain.handle('open-data-folder', () => {
  const cfg = loadConfig();
  const fs = require('fs');
  const p = path.join(cfg.paths.backend, 'data');
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  shell.openPath(p);
  return { ok: true };
});

ipcMain.handle('open-external', (_e, url) => {
  shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle('get-logs', () => logBuffer.slice(-200));

ipcMain.handle('eas-build', (_e, profile) => {
  const cfg = loadConfig();
  if (easChild && easChild.pid) {
    return { ok: false, error: 'eas_already_running' };
  }
  const prof = profile === 'production' ? 'production' : 'preview';
  const cwd = cfg.paths.mozos;
  const { spawn } = require('child_process');
  easChild = spawn(
    'npx',
    ['--yes', '--package', 'eas-cli', 'eas', 'build', '-p', 'android', '--profile', prof, '--non-interactive'],
    { cwd, shell: true, env: { ...process.env, CI: '1' } },
  );
  const tag = { service: 'eas', ts: Date.now() };
  const onData = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      if (line.trim()) pushLog({ ...tag, line: `[eas] ${line}` });
    }
  };
  easChild.stdout.on('data', onData);
  easChild.stderr.on('data', onData);
  easChild.on('close', (code) => {
    pushLog({ service: 'eas', line: `[eas] Proceso terminado (código ${code}).`, ts: Date.now() });
    easChild = null;
  });
  easChild.on('error', (err) => {
    pushLog({ service: 'eas', line: `[eas] Error: ${err.message}`, ts: Date.now() });
    easChild = null;
  });
  pushLog({
    service: 'eas',
    line: `[eas] Iniciado build Android perfil="${prof}" en ${cwd}`,
    ts: Date.now(),
  });
  return { ok: true, profile: prof };
});

ipcMain.handle('get-paths-hint', () => ({
  launcherRoot: getLauncherRoot(),
}));

ipcMain.handle('paths-auto-detect', () => {
  return detectMonorepoRoot({ exeDir: path.dirname(process.execPath) });
});

ipcMain.handle('paths-apply-detect', () => {
  const d = detectMonorepoRoot({ exeDir: path.dirname(process.execPath) });
  if (!d.ok) return { ok: false, ...d };
  const cfg = loadConfig();
  const next = {
    ...cfg,
    paths: { ...cfg.paths, ...d.paths },
    cloneParentDir: d.root,
  };
  saveConfig(next);
  syncAutostartShortcut(next);
  return { ok: true, ...d };
});

ipcMain.handle('repos-local-status', () => {
  const cfg = loadConfig();
  return {
    backend: repoLocalStatus(cfg.paths?.backend),
    cocina: repoLocalStatus(cfg.paths?.cocina),
    mozos: repoLocalStatus(cfg.paths?.mozos),
  };
});

ipcMain.handle('pick-directory', async () => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths?.length) return null;
  return r.filePaths[0];
});

ipcMain.handle('git-clone-repo', async (_e, { repoKey, parentDir }) => {
  const cfg = loadConfig();
  const fs = require('fs');
  const urls = cfg.cloneUrls || {};
  const url = urls[repoKey];
  if (!url) return { ok: false, error: 'Sin URL en cloneUrls para ' + repoKey };
  const folderMap = { backend: FOLDER_BACKEND, cocina: FOLDER_COCINA, mozos: FOLDER_MOZOS };
  const folder = folderMap[repoKey];
  if (!folder) return { ok: false, error: 'repoKey inválido' };
  let parent = parentDir || cfg.cloneParentDir;
  if (!parent) parent = getMonorepoRoot();
  try {
    fs.mkdirSync(parent, { recursive: true });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const onLine = (line) =>
    pushLog({ service: 'git', line: `[clone ${repoKey}] ${line}`, ts: Date.now() });
  const r = await gitClone(url, parent, folder, onLine);
  if (r.ok) {
    const next = {
      ...cfg,
      paths: { ...cfg.paths, [repoKey]: r.dest },
      cloneParentDir: parent,
    };
    saveConfig(next);
    syncAutostartShortcut(next);
  }
  return r;
});

ipcMain.handle('repos-clone-all', async (_e, explicitParent) => {
  const cfg = loadConfig();
  const fs = require('fs');
  let parent = explicitParent || cfg.cloneParentDir;
  if (!parent) parent = getMonorepoRoot();
  try {
    fs.mkdirSync(parent, { recursive: true });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const map = [
    { key: 'backend', folder: FOLDER_BACKEND },
    { key: 'cocina', folder: FOLDER_COCINA },
    { key: 'mozos', folder: FOLDER_MOZOS },
  ];
  const results = [];
  for (const { key, folder } of map) {
    const dest = path.join(parent, folder);
    if (fs.existsSync(path.join(dest, 'package.json'))) {
      results.push({ key, skipped: true, dest });
      continue;
    }
    const url = (cfg.cloneUrls || {})[key];
    if (!url) {
      results.push({ key, ok: false, error: 'sin URL' });
      continue;
    }
    const r = await gitClone(url, parent, folder, (line) =>
      pushLog({ service: 'git', line: `[clone ${key}] ${line}`, ts: Date.now() }),
    );
    results.push({ key, ...r });
  }
  const newPaths = { ...cfg.paths };
  for (const { key, folder } of map) {
    const dest = path.join(parent, folder);
    if (fs.existsSync(path.join(dest, 'package.json'))) {
      newPaths[key] = dest;
    }
  }
  const next = { ...cfg, paths: newPaths, cloneParentDir: parent };
  saveConfig(next);
  syncAutostartShortcut(next);
  return { ok: true, results, paths: newPaths };
});

ipcMain.handle('git-check-updates', async (_e, repoKey) => {
  const cfg = loadConfig();
  const dir = cfg.paths[repoKey];
  return gitCheckUpdates(dir, cfg.git?.executable || 'git');
});

ipcMain.handle('npm-install', async (_e, serviceKey) => {
  const cfg = loadConfig();
  const keyMap = { backend: 'backend', cocina: 'cocina', expo: 'mozos' };
  const dir = cfg.paths[keyMap[serviceKey]];
  if (!dir) return { ok: false, error: 'Ruta no configurada para ' + serviceKey };
  const fs = require('fs');
  if (!fs.existsSync(dir)) return { ok: false, error: 'Carpeta no existe: ' + dir };
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    const proc = spawn('npm', ['install'], { cwd: dir, shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); pushLog({ service: serviceKey, line: `[npm install] ${d.toString().trim()}`, ts: Date.now() }); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); pushLog({ service: serviceKey, line: `[npm install] ${d.toString().trim()}`, ts: Date.now() }); });
    proc.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    proc.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
});

ipcMain.handle('check-node-modules', async (_e) => {
  const cfg = loadConfig();
  const fs = require('fs');
  const checks = {
    backend: { path: cfg.paths.backend, hasModules: false, hasPackageJson: false },
    cocina: { path: cfg.paths.cocina, hasModules: false, hasPackageJson: false },
    expo: { path: cfg.paths.mozos, hasModules: false, hasPackageJson: false },
  };
  for (const [key, info] of Object.entries(checks)) {
    if (info.path) {
      info.hasPackageJson = fs.existsSync(path.join(info.path, 'package.json'));
      info.hasModules = fs.existsSync(path.join(info.path, 'node_modules'));
    }
  }
  return checks;
});
