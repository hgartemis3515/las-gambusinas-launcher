const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SHORTCUT_NAME = 'LasGambusinasLauncher.lnk';

function startupFolder() {
  return path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function shortcutPath() {
  return path.join(startupFolder(), SHORTCUT_NAME);
}

/**
 * @param {{ enabled: boolean, isPackaged: boolean, exePath: string, launcherDir: string, scriptPath?: string }} opts
 */
function setWindowsAutostart(opts) {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Solo Windows.' };
  }
  const sc = shortcutPath();
  if (!opts.enabled) {
    try {
      if (fs.existsSync(sc)) fs.unlinkSync(sc);
    } catch (e) {
      return { ok: false, message: e.message };
    }
    return { ok: true, enabled: false, shortcutPath: sc };
  }

  let targetPath;
  let arguments_;
  let workingDirectory;

  if (opts.isPackaged) {
    targetPath = opts.exePath;
    arguments_ = '';
    workingDirectory = path.dirname(opts.exePath);
  } else {
    targetPath = 'cmd.exe';
    arguments_ = `/c cd /d "${opts.launcherDir}" && npm start`;
    workingDirectory = opts.launcherDir;
  }

  const script =
    opts.scriptPath || path.join(__dirname, '..', '..', 'scripts', 'create-shortcut.ps1');
  if (!fs.existsSync(script)) {
    return { ok: false, message: 'No se encontró scripts/create-shortcut.ps1 en el launcher.' };
  }

  try {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-ShortcutPath',
        sc,
        '-TargetPath',
        targetPath,
        '-Arguments',
        arguments_,
        '-WorkingDirectory',
        workingDirectory,
      ],
      { stdio: 'pipe', windowsHide: true },
    );
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
  return { ok: true, enabled: true, shortcutPath: sc };
}

function isAutostartEnabled() {
  if (process.platform !== 'win32') return false;
  return fs.existsSync(shortcutPath());
}

module.exports = { setWindowsAutostart, isAutostartEnabled, shortcutPath };
