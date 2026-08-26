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
const { buildServiceUrls } = require('./lib/lan-ip');

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
let easLastBuildInfo = null;
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
ipcMain.handle('get-quick-links', () => {
  const cfg = loadConfig();
  return buildServiceUrls(cfg);
});
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

ipcMain.handle('mongo-detect', async () => {
  const { exec } = require('child_process');
  const platform = process.platform;
  const fs = require('fs');

  /** Search common install paths for mongod/mongosh */
  function findMongoPaths() {
    const candidates = [];
    if (platform === 'win32') {
      const pf = process.env.ProgramFiles || 'C:\\Program Files';
      const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      for (const base of [pf, pf86]) {
        try {
          const entries = fs.readdirSync(base, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory() && e.name.toLowerCase().startsWith('mongodb')) {
              const full = path.join(base, e.name);
              try {
                const subs = fs.readdirSync(full);
                // Look for Server subfolders
                const serverDir = path.join(full, 'Server');
                if (fs.existsSync(serverDir)) {
                  const versions = fs.readdirSync(serverDir).filter(s => /^\d/.test(s)).sort();
                  const latest = versions[versions.length - 1];
                  if (latest) candidates.push(path.join(serverDir, latest, 'bin'));
                }
                // Also check version dirs directly inside MongoDB folder
                const verDirs = subs.filter(s => /^\d/.test(s)).sort();
                const latest = verDirs[verDirs.length - 1];
                if (latest) candidates.push(path.join(full, latest, 'bin'));
              } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }
      }
    }
    return candidates;
  }

  function findMongodBinary() {
    if (platform !== 'win32') return null;
    const searchPaths = findMongoPaths();
    for (const dir of searchPaths) {
      const candidate = path.join(dir, 'mongod.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  function findMongoshBinary() {
    if (platform !== 'win32') return null;
    // mongosh installs in Program Files separately
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [
      path.join(pf, 'MongoDB Shell', 'bin', 'mongosh.exe'),
      path.join(pf, 'MongoDB', 'Tools', 'bin', 'mongosh.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  return new Promise((resolve) => {
    const mongodBin = platform === 'win32' ? (findMongodBinary() || 'mongod.exe') : 'mongod';
    const envPaths = findMongoPaths();
    const envPath = platform === 'win32' ? (process.env.PATH || '') + ';' + envPaths.join(';') : (process.env.PATH || '');

    // Try mongod --version
    exec(`"${mongodBin}" --version`, { timeout: 6000, windowsHide: true, env: { ...process.env, PATH: envPath } }, (err, stdout) => {
      const fallbackMongosh = platform === 'win32' ? (findMongoshBinary() || 'mongosh.exe') : 'mongosh';
      if (err) {
        // Try mongosh as fallback
        exec(`"${fallbackMongosh}" --version`, { timeout: 6000, windowsHide: true, env: { ...process.env, PATH: envPath } }, (err2, stdout2) => {
          if (err2) {
            resolve({ installed: false, mongodFound: false, mongoshFound: false, path: null, version: null, message: 'MongoDB no encontrado en el sistema.' });
          } else {
            const ver = (stdout2 || '').trim().split('\n')[0] || '';
            resolve({ installed: true, mongodFound: false, mongoshFound: true, path: findMongoshBinary(), version: ver, message: 'mongosh encontrado.' });
          }
        });
        return;
      }
      const ver = (stdout || '').trim().split('\n')[0] || '';
      // Find path
      let foundPath = findMongodBinary();
      if (!foundPath) {
        const whereCmd = platform === 'win32' ? 'where' : 'which';
        const whereResult = require('child_process').execSync(`${whereCmd} mongod`, { timeout: 4000, encoding: 'utf8', windowsHide: true }).trim();
        foundPath = whereResult.split('\n')[0] || null;
      }
      resolve({ installed: true, mongodFound: true, mongoshFound: false, path: foundPath, version: ver, message: `MongoDB ${ver.split(' ').pop() || ''}` });
    });
  });
});

ipcMain.handle('mongo-open', async () => {
  // Open MongoDB connection URL — opens MongoDB Compass if installed, otherwise browser
  shell.openExternal('mongodb://127.0.0.1:27017');
  return { ok: true, opened: 'url' };
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
  const taskId = `git-pull-${repoKey}-${Date.now()}`;
  sendTaskProgress(taskId, { status: 'running', pct: 10, message: `git pull en ${repoKey}…` });
  const result = await runGit(dir, ['pull'], cfg.git?.executable || 'git');
  sendTaskProgress(taskId, { status: result.ok ? 'done' : 'error', pct: result.ok ? 100 : 50, message: result.ok ? `${repoKey}: pull completado.` : `${repoKey}: pull falló.` });
  return { ...result, taskId };
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

function sendTaskProgress(taskId, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task-progress', { taskId, ...data });
  }
}

ipcMain.handle('eas-build', (_e, profile) => {
  const cfg = loadConfig();
  if (easChild && easChild.pid) {
    return { ok: false, error: 'eas_already_running' };
  }
  const prof = profile === 'production' ? 'production' : 'preview';
  const cwd = cfg.paths.mozos;
  const taskId = `eas-${prof}-${Date.now()}`;
  const { spawn } = require('child_process');
  easLastBuildInfo = null;
  sendTaskProgress(taskId, { status: 'running', pct: 5, message: `Iniciando build Android perfil="${prof}"…` });
  easChild = spawn(
    'npx',
    ['--yes', '--package', 'eas-cli', 'eas', 'build', '-p', 'android', '--profile', prof, '--non-interactive'],
    { cwd, shell: true, env: { ...process.env, CI: '1' } },
  );
  const tag = { service: 'eas', ts: Date.now() };
  let lastPct = 5;
  let allOutput = '';
  const onData = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      if (line.trim()) {
        pushLog({ ...tag, line: `[eas] ${line}` });
        allOutput += line + '\n';
        // Try to detect build progress from EAS output
        const pctMatch = line.match(/(\d+)%/);
        if (pctMatch) {
          const parsed = parseInt(pctMatch[1], 10);
          if (parsed > lastPct && parsed <= 100) {
            lastPct = Math.min(parsed, 95);
            sendTaskProgress(taskId, { status: 'running', pct: lastPct, message: line.trim() });
          }
        }
      }
    }
  };
  easChild.stdout.on('data', onData);
  easChild.stderr.on('data', onData);
  easChild.on('close', (code) => {
    pushLog({ service: 'eas', line: `[eas] Proceso terminado (código ${code}).`, ts: Date.now() });
    // Parse build info from output
    let buildUrl = null;
    let buildId = null;
    // Check for common EAS CLI errors
    let errorMsg = null;
    const moduleNotFoundMatch = allOutput.match(/Error:\s*Cannot find module\s+'([^']+)'/);
    const lockCompromisedMatch = allOutput.match(/ECOMPROMISED|Lock compromised/i);
    if (code !== 0 && moduleNotFoundMatch) {
      errorMsg = `EAS CLI corrupto: falta módulo "${moduleNotFoundMatch[1]}". Use "Limpiar caché EAS" y reintente.`;
    } else if (code !== 0 && lockCompromisedMatch) {
      errorMsg = `Caché npm comprometida (lock). Use "Limpiar caché EAS" y reintente.`;
    }
    // Try to extract URL: look for expo.dev or exp.host or similar patterns
    const urlMatch = allOutput.match(/(https:\/\/[^\s"']*expo\.dev[^\s"']*)/i) ||
                     allOutput.match(/(https:\/\/[^\s"']*exp\.host[^\s"']*)/i) ||
                     allOutput.match(/(https:\/\/[^\s"']*\.apk[^\s"']*)/i);
    if (urlMatch) buildUrl = urlMatch[1];
    // Try JSON output: extract build ID
    try {
      const jsonBlocks = allOutput.match(/\[[\s\S]*?\]/g);
      if (jsonBlocks) {
        for (const block of jsonBlocks) {
          try {
            const parsed = JSON.parse(block);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
              buildId = parsed[0].id;
              if (!buildUrl && parsed[0].artifacts?.buildUrl) {
                buildUrl = parsed[0].artifacts.buildUrl;
              }
              break;
            }
          } catch { /* not valid JSON, skip */ }
        }
      }
      // Also try single object JSON
      const objMatch = allOutput.match(/\{[\s\S]*?"id"[\s\S]*?\}/g);
      if (!buildId && objMatch) {
        for (const obj of objMatch) {
          try {
            const parsed = JSON.parse(obj);
            if (parsed.id) {
              buildId = parsed.id;
              if (!buildUrl && parsed.artifacts?.buildUrl) buildUrl = parsed.artifacts.buildUrl;
              break;
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip JSON parsing */ }
    if (buildId || buildUrl) {
      easLastBuildInfo = { buildId, buildUrl, profile: prof, code, timestamp: Date.now() };
    }
    const doneMsg = code === 0
      ? (buildUrl ? `Build completado. Puede guardar el APK.` : 'Build completado.')
      : (errorMsg || `Build falló (código ${code}).`);
    sendTaskProgress(taskId, { status: code === 0 ? 'done' : 'error', pct: code === 0 ? 100 : lastPct, message: doneMsg, buildUrl, buildId });
    easChild = null;
  });
  easChild.on('error', (err) => {
    pushLog({ service: 'eas', line: `[eas] Error: ${err.message}`, ts: Date.now() });
    sendTaskProgress(taskId, { status: 'error', pct: lastPct, message: `Error: ${err.message}` });
    easChild = null;
  });
  pushLog({
    service: 'eas',
    line: `[eas] Iniciado build Android perfil="${prof}" en ${cwd}`,
    ts: Date.now(),
  });
  return { ok: true, profile: prof, taskId };
});

ipcMain.handle('eas-build-info', () => easLastBuildInfo);

ipcMain.handle('eas-clear-npx-cache', async () => {
  const fs = require('fs');
  const path = require('path');
  const appDataLocal = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const npmCache = path.join(appDataLocal, 'npm-cache');
  const dirsToClean = ['_npx', '_locks'];
  let cleaned = [];
  let errors = [];
  for (const sub of dirsToClean) {
    const dir = path.join(npmCache, sub);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        cleaned.push(sub);
      } catch (err) {
        errors.push(`${sub}: ${err.message}`);
      }
    }
  }
  if (errors.length > 0) {
    pushLog({ service: 'eas', line: `[eas] Error limpiando caché: ${errors.join('; ')}`, ts: Date.now() });
    return { ok: false, error: errors.join('; ') };
  }
  if (cleaned.length === 0) {
    pushLog({ service: 'eas', line: '[eas] Caché ya limpia.', ts: Date.now() });
    return { ok: true, message: 'Caché ya limpia.' };
  }
  pushLog({ service: 'eas', line: `[eas] Caché limpiada: ${cleaned.join(', ')}`, ts: Date.now() });
  return { ok: true, message: `Caché limpiada (${cleaned.join(', ')}). El próximo build descargará EAS CLI de nuevo.` };
});

ipcMain.handle('eas-save-apk', async (_e, { buildId, buildUrl }) => {
  const cfg = loadConfig();
  const cwd = cfg.paths.mozos;
  const fs = require('fs');
  const https = require('https');
  const http = require('http');

  // First try to download via URL directly
  if (!buildUrl && !buildId) {
    return { ok: false, error: 'No hay URL ni ID del build.' };
  }

  // If we have a buildId but no URL, try to get URL via eas build:view
  if (!buildUrl && buildId) {
    try {
      const { execSync } = require('child_process');
      const viewOutput = execSync(
        `npx --yes --package eas-cli eas build:view ${buildId} --json --non-interactive`,
        { cwd, shell: true, env: { ...process.env, CI: '1' }, timeout: 30000, encoding: 'utf8' },
      );
      const parsed = JSON.parse(viewOutput.trim());
      if (parsed && parsed.artifacts && parsed.artifacts.buildUrl) {
        buildUrl = parsed.artifacts.buildUrl;
      }
    } catch (e) {
      // Fallback: try to construct expo.dev URL
      buildUrl = `https://expo.dev/accounts/[project]/builds/${buildId}`;
    }
  }

  if (!buildUrl) {
    return { ok: false, error: 'No se pudo obtener la URL de descarga.' };
  }

  // Ask user where to save
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: 'Ventana principal no disponible.' };
  }
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar APK',
    defaultPath: `mozos-${buildId || 'build'}.apk`,
    filters: [{ name: 'APK', extensions: ['apk'] }],
  });
  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, error: 'cancelled' };
  }
  const destPath = saveResult.filePath;

  // Download the file
  const taskId = `eas-save-${Date.now()}`;
  sendTaskProgress(taskId, { status: 'running', pct: 10, message: 'Descargando APK…' });

  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    const downloadUrl = buildUrl.startsWith('http') ? buildUrl : `https://${buildUrl}`;
    const client = downloadUrl.startsWith('https') ? https : http;

    client.get(downloadUrl, { headers: { 'User-Agent': 'las-gambusinas-launcher' } }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        // Follow redirect
        const redirectUrl = response.headers.location;
        const redirectClient = redirectUrl.startsWith('https') ? https : http;
        const redirectFile = fs.createWriteStream(destPath);
        const totalLen = parseInt(response.headers['content-length'] || '0', 10);
        let downloaded = 0;
        redirectClient.get(redirectUrl, { headers: { 'User-Agent': 'las-gambusinas-launcher' } }, (redirRes) => {
          const redirTotal = parseInt(redirRes.headers['content-length'] || '0', 10);
          redirRes.on('data', (chunk) => {
            downloaded += chunk.length;
            if (redirTotal > 0) {
              sendTaskProgress(taskId, { status: 'running', pct: Math.min(Math.round((downloaded / redirTotal) * 80) + 10, 95), message: `Descargando APK… ${Math.round(downloaded / 1024)}KB` });
            }
          });
          redirRes.pipe(redirectFile);
          redirectFile.on('finish', () => {
            redirectFile.close();
            sendTaskProgress(taskId, { status: 'done', pct: 100, message: `APK guardado en: ${destPath}` });
            resolve({ ok: true, path: destPath });
          });
        }).on('error', (err) => {
          fs.unlinkSync(destPath);
          sendTaskProgress(taskId, { status: 'error', pct: 50, message: `Error descargando: ${err.message}` });
          resolve({ ok: false, error: err.message });
        });
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        sendTaskProgress(taskId, { status: 'error', pct: 50, message: `Error HTTP: ${response.statusCode}` });
        resolve({ ok: false, error: `HTTP ${response.statusCode}` });
        return;
      }

      const totalLen = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalLen > 0) {
          sendTaskProgress(taskId, { status: 'running', pct: Math.min(Math.round((downloaded / totalLen) * 80) + 10, 95), message: `Descargando APK… ${Math.round(downloaded / 1024)}KB` });
        }
      });
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        sendTaskProgress(taskId, { status: 'done', pct: 100, message: `APK guardado en: ${destPath}` });
        resolve({ ok: true, path: destPath });
      });
    }).on('error', (err) => {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      sendTaskProgress(taskId, { status: 'error', pct: 50, message: `Error descargando: ${err.message}` });
      resolve({ ok: false, error: err.message });
    });
  });
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
  const taskId = `git-clone-${repoKey}-${Date.now()}`;
  sendTaskProgress(taskId, { status: 'running', pct: 10, message: `Clonando ${repoKey}…` });
  const onLine = (line) =>
    pushLog({ service: 'git', line: `[clone ${repoKey}] ${line}`, ts: Date.now() });
  const r = await gitClone(url, parent, folder, onLine);
  sendTaskProgress(taskId, { status: r.ok ? 'done' : 'error', pct: r.ok ? 100 : 50, message: r.ok ? `${repoKey}: clonado en ${r.dest}.` : `${repoKey}: error al clonar.` });
  if (r.ok) {
    const next = {
      ...cfg,
      paths: { ...cfg.paths, [repoKey]: r.dest },
      cloneParentDir: parent,
    };
    saveConfig(next);
    syncAutostartShortcut(next);
  }
  return { ...r, taskId };
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
  const taskId = `git-clone-all-${Date.now()}`;
  const map = [
    { key: 'backend', folder: FOLDER_BACKEND },
    { key: 'cocina', folder: FOLDER_COCINA },
    { key: 'mozos', folder: FOLDER_MOZOS },
  ];
  const results = [];
  const total = map.length;
  for (let i = 0; i < map.length; i++) {
    const { key, folder } = map[i];
    const dest = path.join(parent, folder);
    if (fs.existsSync(path.join(dest, 'package.json'))) {
      results.push({ key, skipped: true, dest });
      sendTaskProgress(taskId, { status: 'running', pct: Math.round(((i + 1) / total) * 100), message: `${key}: ya existe, omitido.` });
      continue;
    }
    const url = (cfg.cloneUrls || {})[key];
    if (!url) {
      results.push({ key, ok: false, error: 'sin URL' });
      sendTaskProgress(taskId, { status: 'running', pct: Math.round(((i + 1) / total) * 100 * 0.8), message: `${key}: sin URL configurada.` });
      continue;
    }
    sendTaskProgress(taskId, { status: 'running', pct: Math.round(((i * 0.8 + 0.2) / total) * 100), message: `Clonando ${key}…` });
    const r = await gitClone(url, parent, folder, (line) =>
      pushLog({ service: 'git', line: `[clone ${key}] ${line}`, ts: Date.now() }),
    );
    results.push({ key, ...r });
    sendTaskProgress(taskId, { status: 'running', pct: Math.round(((i + 1) / total) * 90), message: `${key}: ${r.ok ? 'clonado.' : 'error.'}` });
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
  sendTaskProgress(taskId, { status: 'done', pct: 100, message: 'Clonación masiva completada.' });
  return { ok: true, results, paths: newPaths, taskId };
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
  const taskId = `npm-${serviceKey}-${Date.now()}`;
  const { spawn } = require('child_process');
  sendTaskProgress(taskId, { status: 'running', pct: 5, message: `Instalando dependencias de ${serviceKey}…` });
  return new Promise((resolve) => {
    const proc = spawn('npm', ['install'], { cwd: dir, shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let lastPct = 5;
    const onData = (d) => {
      const text = d.toString();
      if (text.includes('npm install') || text.includes('added') || text.includes('packages')) {
        lastPct = Math.min(lastPct + 8, 90);
        sendTaskProgress(taskId, { status: 'running', pct: lastPct, message: `Instalando ${serviceKey}…` });
      }
      pushLog({ service: serviceKey, line: `[npm install] ${text.trim()}`, ts: Date.now() });
    };
    proc.stdout.on('data', (d) => { stdout += d.toString(); onData(d); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); pushLog({ service: serviceKey, line: `[npm install] ${d.toString().trim()}`, ts: Date.now() }); });
    proc.on('close', (code) => {
      sendTaskProgress(taskId, { status: code === 0 ? 'done' : 'error', pct: code === 0 ? 100 : lastPct, message: code === 0 ? `${serviceKey}: dependencias instaladas.` : `Error instalando ${serviceKey} (código ${code}).` });
      resolve({ ok: code === 0, code, stdout, stderr, taskId });
    });
    proc.on('error', (err) => {
      sendTaskProgress(taskId, { status: 'error', pct: lastPct, message: `Error: ${err.message}` });
      resolve({ ok: false, error: err.message, taskId });
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

ipcMain.handle('get-launcher-info', () => {
  return {
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    root: getLauncherRoot(),
  };
});

ipcMain.handle('check-launcher-update', async () => {
  const currentVersion = app.getVersion();
  const owner = 'hgartemis3515';
  const repo = 'las-gambusinas-launcher';
  try {
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
      https.get(url, { headers: { 'User-Agent': 'las-gambusinas-launcher' } }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(body)); } catch { resolve(null); }
          } else {
            resolve(null);
          }
        });
      }).on('error', reject);
    });
    if (!data || !data.tag_name) {
      return { ok: false, message: 'No se pudo obtener información del repositorio.' };
    }
    const remoteVersion = data.tag_name.replace(/^v/, '');
    const hasUpdate = remoteVersion !== currentVersion;
    return {
      ok: true,
      currentVersion,
      remoteVersion,
      hasUpdate,
      message: hasUpdate
        ? `Nueva versión disponible: v${remoteVersion} (actual: v${currentVersion})`
        : `Estás en la última versión (v${currentVersion}).`,
      releaseUrl: data.html_url,
    };
  } catch (err) {
    return { ok: false, message: `Error al comprobar: ${err.message}` };
  }
});
