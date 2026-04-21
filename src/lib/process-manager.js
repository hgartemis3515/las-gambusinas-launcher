const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const treeKill = require('tree-kill');

const SERVICES = ['backend', 'cocina', 'expo'];

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Record<string, import('child_process').ChildProcess | null>} */
    this.procs = { backend: null, cocina: null, expo: null };
    this.lastError = { backend: null, cocina: null, expo: null };
  }

  /**
   * @param {'backend'|'cocina'|'expo'} service
   * @param {{ cwd: string, npmScript: string }} opts
   */
  start(service, opts) {
    if (this.procs[service]) {
      this.emit('log', { service, line: `[launcher] ${service} ya está en ejecución.`, ts: Date.now() });
      return { ok: false, error: 'already_running' };
    }
    const { cwd, npmScript } = opts;
    const resolved = cwd ? path.resolve(cwd) : '';
    if (!resolved || !fs.existsSync(resolved)) {
      const msg = `[launcher] ${service}: la carpeta no existe: ${cwd || '(vacía)'}`;
      this.emit('log', { service, line: msg, ts: Date.now() });
      return { ok: false, error: 'cwd_missing' };
    }
    const proc = spawn('npm', ['run', npmScript], {
      cwd: resolved,
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
      windowsHide: true,
    });
    this.procs[service] = proc;
    this.lastError[service] = null;

    const onChunk = (buf) => {
      const text = buf.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) this.emit('log', { service, line, ts: Date.now() });
      }
    };
    proc.stdout.on('data', onChunk);
    proc.stderr.on('data', onChunk);
    proc.on('error', (err) => {
      this.lastError[service] = err.message;
      this.emit('log', { service, line: `[launcher] error: ${err.message}`, ts: Date.now() });
    });
    proc.on('close', (code) => {
      this.procs[service] = null;
      this.emit('log', {
        service,
        line: `[launcher] proceso terminado (código ${code}).`,
        ts: Date.now(),
      });
      this.emit('exit', { service, code });
    });

    this.emit('log', { service, line: `[launcher] iniciado npm run ${npmScript} en ${resolved}`, ts: Date.now() });
    return { ok: true, pid: proc.pid };
  }

  /**
   * @param {'backend'|'cocina'|'expo'} service
   */
  stop(service) {
    const proc = this.procs[service];
    if (!proc || !proc.pid) return { ok: false, error: 'not_running' };
    return new Promise((resolve) => {
      treeKill(proc.pid, 'SIGTERM', (err) => {
        if (err) {
          this.emit('log', { service, line: `[launcher] tree-kill: ${err.message}`, ts: Date.now() });
        }
        this.procs[service] = null;
        resolve({ ok: !err, error: err ? err.message : null });
      });
    });
  }

  async stopAll() {
    for (const s of SERVICES) {
      if (this.procs[s]) await this.stop(s);
    }
  }

  status() {
    const out = {};
    for (const s of SERVICES) {
      const p = this.procs[s];
      out[s] = {
        running: !!p,
        pid: p && p.pid ? p.pid : null,
        lastError: this.lastError[s],
      };
    }
    return out;
  }
}

module.exports = { ProcessManager, SERVICES };
