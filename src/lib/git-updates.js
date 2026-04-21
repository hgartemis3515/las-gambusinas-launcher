const fs = require('fs');
const { runGit } = require('./git-service');

/**
 * @param {string} cwd
 * @param {string} gitExe
 * @returns {Promise<{ ok: boolean, behind?: number, ahead?: number, branch?: string, upstream?: string, message?: string }>}
 */
async function gitCheckUpdates(cwd, gitExe = 'git') {
  if (!cwd || !fs.existsSync(cwd)) {
    return { ok: false, message: 'La carpeta del repositorio no existe.' };
  }
  if (!fs.existsSync(require('path').join(cwd, '.git'))) {
    return { ok: false, message: 'No es un repositorio Git (.git ausente).' };
  }

  const fetch = await runGit(cwd, ['fetch', 'origin'], gitExe);
  if (!fetch.ok) {
    return { ok: false, message: fetch.stderr || fetch.stdout || 'git fetch falló' };
  }

  const branchR = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], gitExe);
  const branch = branchR.ok ? branchR.stdout.trim() : 'HEAD';

  const upR = await runGit(cwd, ['rev-parse', '--abbrev-ref', '@{u}'], gitExe);
  if (!upR.ok) {
    return {
      ok: true,
      behind: null,
      ahead: null,
      branch,
      upstream: null,
      message: 'Rama sin upstream remoto configurado.',
    };
  }
  const upstream = upR.stdout.trim();

  const behindR = await runGit(cwd, ['rev-list', '--count', 'HEAD..@{upstream}'], gitExe);
  const aheadR = await runGit(cwd, ['rev-list', '--count', '@{upstream}..HEAD'], gitExe);
  const behind = behindR.ok ? parseInt(behindR.stdout, 10) || 0 : 0;
  const ahead = aheadR.ok ? parseInt(aheadR.stdout, 10) || 0 : 0;
  let message = 'Sin novedades en el remoto.';
  if (behind > 0 && ahead > 0) message = `Desincronizado: ${behind} atrás, ${ahead} adelante (rebase/merge).`;
  else if (behind > 0) message = `Hay ${behind} commit(s) para traer (git pull).`;
  else if (ahead > 0) message = `Tu rama va ${ahead} commit(s) por delante del remoto.`;
  return {
    ok: true,
    behind,
    ahead,
    branch,
    upstream,
    message,
  };
}

module.exports = { gitCheckUpdates };
