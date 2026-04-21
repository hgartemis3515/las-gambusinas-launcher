const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { loadConfig, saveConfig, loadState, saveState } = require('./lib/config-store');
const { ProcessManager } = require('./lib/process-manager');
const { checkMongo } = require('./lib/mongo-check');
const { appsStatus } = require('./lib/http-status');
const { gitStatus, runGit } = require('./lib/git-service');
const { listJsonFiles, deleteManifest } = require('./lib/data-service');
const { setWindowsAutostart, isAutostartEnabled } = require('./lib/autostart-win');

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
    npmScript: cfg.npmScripts?.backend || 'dev',
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
  });

  if (cfg.autoStartExpoWithServices) {
    await sleep(between);
    pm.start('expo', {
      cwd: cfg.paths.mozos,
      npmScript: cfg.npmScripts?.expo || 'start',
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Las Gambusinas — Launcher',
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
    return pm.start('backend', { cwd: cfg.paths.backend, npmScript: cfg.npmScripts?.backend || 'dev' });
  }
  if (service === 'cocina') {
    return pm.start('cocina', { cwd: cfg.paths.cocina, npmScript: cfg.npmScripts?.cocina || 'start' });
  }
  if (service === 'expo') {
    return pm.start('expo', { cwd: cfg.paths.mozos, npmScript: cfg.npmScripts?.expo || 'start' });
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
