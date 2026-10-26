const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { gitCheckUpdates } = require('./git-updates');
const { gitStatus, runGit } = require('./git-service');

const RELEASE_API = 'https://api.github.com/repos/hgartemis3515/las-gambusinas-launcher/releases/latest';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'las-gambusinas-launcher', Accept: 'application/vnd.github+json' } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Demasiadas redirecciones'));
      return;
    }
    const lib = url.startsWith('http:') ? http : https;
    const file = fs.createWriteStream(dest);
    lib.get(url, { headers: { 'User-Agent': 'las-gambusinas-launcher' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(res.headers.location, dest, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * @returns {Promise<{ updated: boolean, skipped?: string, behind?: number }>}
 */
async function pullIfBehind(cwd, gitExe) {
  const check = await gitCheckUpdates(cwd, gitExe);
  if (!check.ok || !(check.behind > 0)) return { updated: false, behind: check.behind || 0 };
  if (check.ahead > 0) return { updated: false, skipped: 'ahead', behind: check.behind };
  const st = await gitStatus(cwd, gitExe);
  if (st.dirty) return { updated: false, skipped: 'dirty', behind: check.behind };
  const pull = await runGit(cwd, ['pull', '--ff-only'], gitExe);
  return { updated: !!pull.ok, behind: check.behind, error: pull.ok ? null : (pull.stderr || pull.stdout) };
}

/**
 * .exe instalado: baja el Setup de la última release y lo abre.
 * Código fuente: git pull del repo del launcher.
 * @returns {Promise<boolean>} true si hay que reiniciar ya
 */
async function actualizarLauncher({ packaged, version, launcherRoot, gitExe, log }) {
  if (!packaged) {
    const r = await pullIfBehind(launcherRoot, gitExe);
    if (r.skipped === 'dirty') {
      log('Hay commits nuevos del launcher, pero esta carpeta tiene cambios locales. No se actualiza sola.');
    }
    if (r.updated) log('Launcher actualizado desde Git. Reiniciando…');
    return r.updated;
  }
  const data = await fetchJson(RELEASE_API);
  if (!data?.tag_name) return false;
  const remote = String(data.tag_name).replace(/^v/, '');
  if (remote === version) return false;
  const asset = (data.assets || []).find((a) => /setup.*\.exe$/i.test(a.name))
    || (data.assets || []).find((a) => /\.exe$/i.test(a.name));
  if (!asset?.browser_download_url) {
    log(`Hay launcher v${remote} pero la release no trae un .exe.`);
    return false;
  }
  const dest = path.join(os.tmpdir(), asset.name);
  log(`Descargando launcher v${remote}…`);
  await downloadFile(asset.browser_download_url, dest);
  log('Instalador listo. Se abre y este launcher se cierra.');
  spawn(dest, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  return true;
}

module.exports = { pullIfBehind, actualizarLauncher };
