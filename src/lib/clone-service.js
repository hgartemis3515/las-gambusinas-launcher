const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveGitCommand } = require('./git-service');

function runSpawn(cmd, args, opts, onLine) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      ...opts,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...opts.env },
    });
    const drain = (buf) => {
      const t = buf.toString();
      for (const line of t.split(/\r?\n/)) {
        if (line.trim() && onLine) onLine(line);
      }
    };
    proc.stdout.on('data', drain);
    proc.stderr.on('data', drain);
    proc.on('close', (code) => resolve({ ok: code === 0, code }));
    proc.on('error', (e) => resolve({ ok: false, code: -1, error: e.message }));
  });
}

/**
 * Clona un repo en `parentDir/nombreCarpeta` (nombreCarpeta = último segmento de URL .git sin .git).
 */
async function gitClone(url, parentDir, folderName, onLine) {
  if (!url || !parentDir || !folderName) {
    return { ok: false, error: 'Faltan parámetros.' };
  }
  if (!fs.existsSync(parentDir)) {
    try {
      fs.mkdirSync(parentDir, { recursive: true });
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const dest = path.join(parentDir, folderName);
  if (fs.existsSync(dest)) {
    return { ok: false, error: `Ya existe la carpeta: ${dest}` };
  }
  const git = resolveGitCommand('git');
  const r = await runSpawn(
    git,
    ['clone', '--depth', '1', url, dest],
    { cwd: parentDir },
    onLine,
  );
  if (!r.ok) return { ok: false, error: `git clone falló (código ${r.code})`, dest };
  return { ok: true, dest };
}

module.exports = { gitClone };
