const { gitCheckUpdates } = require('./git-updates');
const { gitStatus, runGit } = require('./git-service');

/**
 * Trae commits publicados si la carpeta está detrás y no tiene cambios locales.
 * @returns {Promise<{ updated: boolean, skipped?: string, behind?: number, error?: string | null }>}
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

module.exports = { pullIfBehind };
