/**
 * Windows: electron-builder cannot replace app.asar if the packaged app still runs.
 * Safe no-op on other platforms or if the process is not running.
 */
const { execFileSync } = require('child_process');

if (process.platform !== 'win32') process.exit(0);

function tryKill(im) {
  try {
    execFileSync('taskkill', ['/F', '/IM', im], { stdio: 'ignore', windowsHide: true });
  } catch {
    /* ENOENT or no matching process */
  }
}

tryKill('Las Gambusinas Launcher.exe');
