const api = window.launcherAPI;

const $ = (id) => document.getElementById(id);

function appendLogLine(entry) {
  const ta = $('log-area');
  const line = `[${new Date(entry.ts).toLocaleTimeString()}] [${entry.service}] ${entry.line}`;
  ta.value = `${ta.value}${ta.value ? '\n' : ''}${line}`;
  const lines = ta.value.split('\n');
  if (lines.length > 500) ta.value = lines.slice(-400).join('\n');
  ta.scrollTop = ta.scrollHeight;
}

function readConfigFromForm() {
  return {
    paths: {
      backend: $('path-backend').value.trim(),
      cocina: $('path-cocina').value.trim(),
      mozos: $('path-mozos').value.trim(),
    },
    ports: {
      backend: Number($('port-backend').value) || 3000,
      cocina: Number($('port-cocina').value) || 3001,
      expoMetro: Number($('port-expo').value) || 8081,
    },
    publicBaseUrl: $('public-base-url').value.trim() || 'http://127.0.0.1:3000',
    dataManifestPath: $('data-manifest-path').value.trim() || 'data/data.json',
    npmScripts: {
      backend: $('npm-backend').value.trim() || 'dev',
      cocina: $('npm-cocina').value.trim() || 'start',
      expo: $('npm-expo').value.trim() || 'start',
    },
    autoStartLauncherWithWindows: $('cfg-autostart-win').checked,
    autoStartServicesOnLauncherOpen: $('cfg-autostart-svc').checked,
    autoStartExpoWithServices: $('cfg-autostart-expo').checked,
    delaysMs: {
      afterBoot: Number($('delay-boot').value) || 3000,
      betweenServiceStarts: Number($('delay-between').value) || 2000,
    },
    mongodb: {
      checkBeforeBackendStart: $('cfg-mongo-check').checked,
      forceBackendStartIfMongoFails: $('cfg-mongo-force').checked,
      mongoshPath: 'mongosh',
    },
    git: { executable: 'git' },
    stopAllOnQuit: $('cfg-stop-quit').checked,
  };
}

function fillForm(cfg) {
  $('path-backend').value = cfg.paths?.backend || '';
  $('path-cocina').value = cfg.paths?.cocina || '';
  $('path-mozos').value = cfg.paths?.mozos || '';
  $('port-backend').value = cfg.ports?.backend ?? 3000;
  $('port-cocina').value = cfg.ports?.cocina ?? 3001;
  $('port-expo').value = cfg.ports?.expoMetro ?? 8081;
  $('public-base-url').value = cfg.publicBaseUrl || '';
  $('data-manifest-path').value = cfg.dataManifestPath || 'data/data.json';
  $('npm-backend').value = cfg.npmScripts?.backend || 'dev';
  $('npm-cocina').value = cfg.npmScripts?.cocina || 'start';
  $('npm-expo').value = cfg.npmScripts?.expo || 'start';
  $('cfg-autostart-win').checked = !!cfg.autoStartLauncherWithWindows;
  $('cfg-autostart-svc').checked = !!cfg.autoStartServicesOnLauncherOpen;
  $('cfg-autostart-expo').checked = !!cfg.autoStartExpoWithServices;
  $('cfg-mongo-check').checked = cfg.mongodb?.checkBeforeBackendStart !== false;
  $('cfg-mongo-force').checked = !!cfg.mongodb?.forceBackendStartIfMongoFails;
  $('cfg-stop-quit').checked = cfg.stopAllOnQuit !== false;
  $('delay-boot').value = cfg.delaysMs?.afterBoot ?? 3000;
  $('delay-between').value = cfg.delaysMs?.betweenServiceStarts ?? 2000;
  $('manifest-label').textContent = cfg.dataManifestPath || 'data/data.json';
}

async function refreshMongoAndHttp() {
  const mongo = await api.mongoCheck();
  const http = await api.httpAppsStatus();
  const grid = $('status-grid');
  const cards = [
    {
      key: 'mongo',
      label: 'MongoDB (ping)',
      ok: mongo.ok,
      text: mongo.ok ? mongo.message : mongo.message,
      sub: mongo.uriMasked || '',
    },
    {
      key: 'be',
      label: http.backend.label,
      ok: http.backend.ok,
      text: http.backend.ok ? `HTTP ${http.backend.status}` : http.backend.error || 'sin respuesta',
    },
    {
      key: 'coc',
      label: http.cocina.label,
      ok: http.cocina.ok,
      text: http.cocina.ok ? `HTTP ${http.cocina.status}` : http.cocina.error || 'sin respuesta',
    },
    {
      key: 'exp',
      label: http.expo.label,
      ok: http.expo.ok,
      text: http.expo.ok ? `HTTP ${http.expo.status}` : http.expo.error || 'sin respuesta',
    },
  ];
  grid.innerHTML = cards
    .map(
      (c) => `
    <div class="stat-card ${c.ok ? 'stat-ok' : 'stat-bad'}">
      <div class="label">${c.label}</div>
      <div class="value">${escapeHtml(c.text)}</div>
      ${c.sub ? `<div class="hint" style="margin-top:6px">${escapeHtml(c.sub)}</div>` : ''}
    </div>`,
    )
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refreshServices() {
  const st = await api.serviceStatus();
  const names = { backend: 'Backend', cocina: 'App cocina', expo: 'Expo (mozos)' };
  const row = $('services-row');
  row.innerHTML = ['backend', 'cocina', 'expo']
    .map((id) => {
      const s = st[id];
      return `<div class="svc-card">
        <h3>${names[id]}</h3>
        <div class="svc-meta">${s.running ? `En ejecución (PID ${s.pid})` : 'Detenido'}${s.lastError ? ` — ${escapeHtml(s.lastError)}` : ''}</div>
        <div class="svc-actions">
          <button type="button" data-start="${id}">Iniciar</button>
          <button type="button" data-stop="${id}">Detener</button>
        </div>
      </div>`;
    })
    .join('');

  row.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await api.serviceStart(btn.getAttribute('data-start'));
      if (!r.ok && r.error === 'already_running') appendLogLine({ service: 'launcher', line: 'Ya en ejecución.', ts: Date.now() });
      refreshServices();
    });
  });
  row.querySelectorAll('[data-stop]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.serviceStop(btn.getAttribute('data-stop'));
      refreshServices();
    });
  });
}

async function refreshGit() {
  const repos = [
    { key: 'backend', title: 'Backend-LasGambusinas' },
    { key: 'cocina', title: 'appcocina' },
    { key: 'mozos', title: 'Las-Gambusinas (mozos)' },
  ];
  const host = $('git-grid');
  host.innerHTML = '';
  for (const r of repos) {
    const g = await api.gitStatus(r.key);
    const card = document.createElement('div');
    card.className = 'git-card';
    card.innerHTML = `
      <h3>${r.title}</h3>
      <div><strong>Rama:</strong> ${escapeHtml(g.branch)} · <strong>HEAD:</strong> ${escapeHtml(g.head)}</div>
      <div>${g.dirty ? '⚠ Hay cambios locales sin commit.' : '✓ Working tree limpio (porcelain).'}</div>
      <div class="git-out">${escapeHtml(g.statusLine || '')}</div>
      <div class="git-actions">
        <button type="button" data-fetch="${r.key}">git fetch</button>
        <button type="button" data-pull="${r.key}">git pull</button>
      </div>
    `;
    card.querySelector(`[data-fetch="${r.key}"]`).addEventListener('click', async () => {
      const out = await api.gitFetch(r.key);
      appendLogLine({
        service: 'git',
        line: `${r.key} fetch: ${out.ok ? 'ok' : 'falló'} ${out.stderr || out.stdout}`,
        ts: Date.now(),
      });
      refreshGit();
    });
    card.querySelector(`[data-pull="${r.key}"]`).addEventListener('click', async () => {
      if (g.dirty && !window.confirm(`${r.title}: hay cambios locales. ¿Continuar con git pull?`)) return;
      const out = await api.gitPull(r.key);
      appendLogLine({
        service: 'git',
        line: `${r.key} pull: ${out.ok ? 'ok' : 'falló'} ${out.stderr || out.stdout}`,
        ts: Date.now(),
      });
      refreshGit();
    });
    host.appendChild(card);
  }
}

async function refreshDataBanners() {
  const data = await api.dataList();
  const man = data.manifestExists;
  const hasOther = data.files && data.files.length > 0;
  const bm = $('banner-manifest');
  const bj = $('banner-json');
  const bc = $('banner-clean');

  bm.classList.add('hidden');
  bj.classList.add('hidden');
  bc.classList.add('hidden');

  if (man) {
    bm.classList.remove('hidden');
    bm.textContent =
      'Se detectó el manifiesto data.json (o ruta configurada). Si busca instalación limpia, elimine el manifiesto tras backup; esto no vacía MongoDB.';
  } else if (hasOther) {
    bj.classList.remove('hidden');
    bj.textContent = `Hay ${data.files.length} archivo(s) JSON en data/ (semilla/import). Sin manifiesto: criterio “limpio” respecto a data.json cumplido.`;
  } else {
    bc.classList.remove('hidden');
    bc.textContent = 'Sin manifiesto y sin JSON listados en data/: estado coherente con instalación vacía de semillas locales.';
  }

  const ul = $('data-file-list');
  ul.innerHTML = (data.files || [])
    .map((f) => `<li>${escapeHtml(f.name)} — ${f.size} bytes</li>`)
    .join('') || '<li>(vacío)</li>';
}

async function init() {
  const cfg = await api.getConfig();
  fillForm(cfg);
  const state = await api.getState();
  const hint = await api.getPathsHint();
  appendLogLine({
    service: 'launcher',
    line: `Launcher raíz: ${hint.launcherRoot}`,
    ts: Date.now(),
  });

  if (!state.firstLaunchCompletedAt && cfg.showFirstRunWizard !== false) {
    $('wizard').classList.remove('hidden');
  }

  $('wiz-done').addEventListener('click', async () => {
    const hide = $('wiz-hide').checked;
    $('wizard').classList.add('hidden');
    await api.saveState({ firstLaunchCompletedAt: Date.now() });
    if (hide) {
      const c = await api.getConfig();
      c.showFirstRunWizard = false;
      await api.saveConfig(c);
      fillForm(c);
    }
  });

  $('toggle-config').addEventListener('click', () => {
    const b = $('config-body');
    b.classList.toggle('hidden');
  });

  $('btn-save-config').addEventListener('click', async () => {
    const next = readConfigFromForm();
    const cur = await api.getConfig();
    await api.saveConfig({ ...cur, ...next });
    appendLogLine({ service: 'launcher', line: 'Configuración guardada.', ts: Date.now() });
    const c2 = await api.getConfig();
    fillForm(c2);
    refreshDataBanners();
  });

  $('btn-refresh').addEventListener('click', async () => {
    await refreshMongoAndHttp();
    await refreshServices();
    await refreshGit();
    await refreshDataBanners();
  });

  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const base = $('public-base-url').value.trim() || 'http://127.0.0.1:3000';
      const u = btn.getAttribute('data-open');
      let url = base.replace(/\/$/, '');
      if (u === 'cocina') url = `http://127.0.0.1:${$('port-cocina').value || 3001}/`;
      else if (u === 'admin') url = `${url}/admin`;
      else if (u === 'root') url = `${url}/`;
      await api.openExternal(url);
    });
  });

  $('btn-open-data').addEventListener('click', () => api.openDataFolder());
  $('btn-delete-manifest').addEventListener('click', async () => {
    if (!window.confirm('¿Eliminar el archivo manifiesto (p. ej. data/data.json)? No borra MongoDB.')) return;
    const r = await api.dataDeleteManifest();
    appendLogLine({ service: 'data', line: r.message, ts: Date.now() });
    refreshDataBanners();
  });

  $('eas-preview').addEventListener('click', () => api.easBuild('preview'));
  $('eas-prod').addEventListener('click', () => {
    if (window.confirm('¿Iniciar build production?')) api.easBuild('production');
  });

  const unsub = api.onServiceLog(appendLogLine);
  window.addEventListener('beforeunload', () => {
    if (typeof unsub === 'function') unsub();
  });

  const logs = await api.getLogs();
  logs.forEach(appendLogLine);

  await refreshMongoAndHttp();
  await refreshServices();
  await refreshGit();
  await refreshDataBanners();

  setInterval(() => {
    refreshMongoAndHttp();
    refreshServices();
  }, 5000);
  setInterval(refreshGit, 20000);
}

init().catch((e) => {
  $('log-area').value = `Error al iniciar UI: ${e.message}`;
});
