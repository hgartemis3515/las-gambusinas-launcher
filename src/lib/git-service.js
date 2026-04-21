const { spawn } = require('child_process');

function runGit(cwd, args, gitExe = 'git') {
  return new Promise((resolve) => {
    const proc = spawn(gitExe, args, { cwd, shell: process.platform === 'win32' });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => {
      out += d.toString();
    });
    proc.stderr.on('data', (d) => {
      err += d.toString();
    });
    proc.on('close', (code) => {
      resolve({ code, stdout: out.trim(), stderr: err.trim(), ok: code === 0 });
    });
    proc.on('error', (e) => {
      resolve({ code: -1, stdout: '', stderr: e.message, ok: false });
    });
  });
}

async function gitStatus(cwd, gitExe) {
  const head = await runGit(cwd, ['rev-parse', '--short', 'HEAD'], gitExe);
  const branch = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], gitExe);
  const st = await runGit(cwd, ['status', '-sb'], gitExe);
  const por = await runGit(cwd, ['status', '--porcelain'], gitExe);
  const dirty = por.ok && por.stdout.length > 0;
  return {
    head: head.ok ? head.stdout : '—',
    branch: branch.ok ? branch.stdout : '—',
    statusLine: st.ok ? (st.stdout.split('\n')[0] || st.stdout) : st.stderr,
    dirty,
    rawStatus: st.stdout,
    ok: st.ok || por.ok,
  };
}

module.exports = { runGit, gitStatus };
