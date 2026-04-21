const api = window.launcherAPI;
const $ = (id) => document.getElementById(id);

/** @type {Record<string, any>} */
let lastUpdates = { backend: null, cocina: null, mozos: null };

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appendLogLine(entry) {
  const ta = $('log-area');
  if (!ta) return;
  const line = `[${new Date(entry.ts).toLocaleTimeString()}] [${entry.service}] ${entry.line}`;
  ta.value = `${ta.value}${ta.value ? '\n' : ''}${line}`;
  const lines = ta.value.split('\n');
  if (lines.length > 500) ta.value = lines.slice(-400).join('\n');
  ta.scrollTop = ta.scrollHeight;
}

function showSection(id) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-section') === id);
  });
  document.querySelectorAll('.section').forEach((s) => {
    s.classList.toggle('hidden', s.id !== `section-${id}`);
  });
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
    cloneParentDir: $('clone-parent-dir').value.trim(),
    cloneUrls: {
      backend: $('clone-url-backend').value.trim(),
      cocina: $('clone-url-cocina').value.trim(),
      mozos: $('clone-url-mozos').value.trim(),
    },
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

async function fillForm(cfg) {
  $('path-backend').value = cfg.paths?.backend || '';
  $('path-cocina').value = cfg.paths?.cocina || '';
  $('path-mozos').value = cfg.paths?.mozos || '';
  $('port-backend').value = cfg.ports?.backend ?? 3000;
  $('port-cocina').value = cfg.ports?.cocina ?? 3001;
  $('port-expo').value = cfg.ports?.expoMetro ?? 8081;
  $('public-base-url').value = cfg.publicBaseUrl || '';
  $('data-manifest-path').value = cfg.dataManifestPath || 'data/data.json';
  $('clone-parent-dir').value = cfg.cloneParentDir || '';
  $('clone-url-backend').value = cfg.cloneUrls?.backend || '';
  $('clone-url-cocina').value = cfg.cloneUrls?.cocina || '';
  $('clone-url-mozos').value = cfg.cloneUrls?.mozos || '';
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
  const ml = $('manifest-label');
  if (ml) ml.textContent = cfg.dataManifestPath || 'data/data.json';
}

async function refreshMongoAndHttp() {
  const mongo = await api.mongoCheck();
  const http = await api.httpAppsStatus();
  const grid = $('status-grid');
  if (!grid) return;
  const cards = [
    {
      label: 'MongoDB (ping)',
      ok: mongo.ok,
      text: mongo.ok ? mongo.message : mongo.message,
      sub: mongo.uriMasked || '',
    },
    {
      label: http.backend.label,
      ok: http.backend.ok,
      text: http.backend.ok ? `HTTP ${http.backend.status}` : http.backend.error || 'sin respuesta',
    },
    {
      label: http.cocina.label,
      ok: http.cocina.ok,
      text: http.cocina.ok ? `HTTP ${http.cocina.status}` : http.cocina.error || 'sin respuesta',
    },
    {
      label: http.expo.label,
      ok: http.expo.ok,
      text: http.expo.ok ? `HTTP ${http.expo.status}` : http.expo.error || 'sin respuesta',
    },
  ];
  grid.innerHTML = cards
    .map(
      (c) => `
    <div class="stat-card ${c.ok ? 'stat-ok' : 'stat-bad'}">
      <div class="label">${escapeHtml(c.label)}</div>
      <div class="value">${escapeHtml(c.text)}</div>
      ${c.sub ? `<div class="hint" style="margin-top:6px">${escapeHtml(c.sub)}</div>` : ''}
    </div>`,
    )
    .join('');
}

async function refreshServices() {
  const st = await api.serviceStatus();
  const row = $('services-row');
  if (!row) return;
  const names = { backend: 'Backend', cocina: 'App cocina', expo: 'Expo (mozos)' };
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
      await api.serviceStart(btn.getAttribute('data-start'));
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

function pillHtml(title, st) {
  const ok = st.exists && st.hasPackageJson;
  const cls = ok ? 'ok' : 'bad';
  const lines = [
    st.exists ? 'Carpeta: sí' : 'Carpeta: no',
    st.isGit ? 'Git: sí' : 'Git: no',
    st.hasPackageJson ? 'package.json: sí' : 'package.json: no',
  ];
  return `<div class="repo-pill ${cls}"><strong>${title}</strong>${lines.join(' · ')}</div>`;
}

async function refreshRepoStrip(targetId) {
  const st = await api.reposLocalStatus();
  const html =
    pillHtml('Backend', st.backend) + pillHtml('Cocina', st.cocina) + pillHtml('Mozos', st.mozos);
  const el = $(targetId);
  if (el) el.innerHTML = html;
}

async function refreshGitGrid() {
  const repos = [
    { key: 'backend', title: 'Backend-LasGambusinas' },
    { key: 'cocina', title: 'appcocina' },
    { key: 'mozos', title: 'Las-Gambusinas (mozos)' },
  ];
  const host = $('git-grid');
  if (!host) return;
  host.innerHTML = '';
  for (const r of repos) {
    const g = await api.gitStatus(r.key);
    const u = lastUpdates[r.key];
    let updateHtml = '<div class="git-update">Pulse «Comprobar actualizaciones».</div>';
    if (u) {
      if (!u.ok) {
        updateHtml = `<div class="git-update warn">${escapeHtml(u.message || 'Error')}</div>`;
      } else if (u.behind != null) {
        const cls = u.behind > 0 ? 'warn' : 'ok';
        updateHtml = `<div class="git-update ${cls}">${escapeHtml(u.message)}</div>`;
      } else {
        updateHtml = `<div class="git-update">${escapeHtml(u.message || '')}</div>`;
      }
    }
    const card = document.createElement('div');
    card.className = 'git-card';
    card.innerHTML = `
      <h3>${r.title}</h3>
      ${updateHtml}
      <div><strong>Rama:</strong> ${escapeHtml(g.branch)} · <strong>HEAD:</strong> ${escapeHtml(g.head)}</div>
      <div>${g.dirty ? '⚠ Cambios locales sin commit.' : '✓ Working tree limpio.'}</div>
      <div class="git-out">${escapeHtml(g.statusLine || g.error || '')}</div>
      <div class="git-actions">
        <button type="button" class="ghost" data-fetch="${r.key}">git fetch</button>
        <button type="button" class="ghost" data-check="${r.key}">Comprobar actualizaciones</button>
        <button type="button" class="primary" data-pull="${r.key}">git pull</button>
      </div>
    `;
    card.querySelector(`[data-fetch="${r.key}"]`).addEventListener('click', async () => {
      const out = await api.gitFetch(r.key);
      appendLogLine({
        service: 'git',
        line: `${r.key} fetch: ${out.ok ? 'ok' : 'falló'} ${out.stderr || out.stdout}`,
        ts: Date.now(),
      });
      refreshGitGrid();
    });
    card.querySelector(`[data-check="${r.key}"]`).addEventListener('click', async () => {
      lastUpdates[r.key] = await api.gitCheckUpdates(r.key);
      refreshGitGrid();
    });
    card.querySelector(`[data-pull="${r.key}"]`).addEventListener('click', async () => {
      if (g.dirty && !window.confirm(`${r.title}: hay cambios locales. ¿Hacer git pull?`)) return;
      const out = await api.gitPull(r.key);
      appendLogLine({
        service: 'git',
        line: `${r.key} pull: ${out.ok ? 'ok' : 'falló'} ${out.stderr || out.stdout}`,
        ts: Date.now(),
      });
      lastUpdates[r.key] = await api.gitCheckUpdates(r.key);
      refreshGitGrid();
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
  [bm, bj, bc].forEach((b) => b && b.classList.add('hidden'));
  if (!bm) return;
  if (man) {
    bm.classList.remove('hidden');
    bm.textContent =
      'Manifiesto detectado. Para instalación limpia evalúe backup y eliminación del manifiesto; no vacía MongoDB.';
  } else if (hasOther) {
    bj.classList.remove('hidden');
    bj.textContent = `Hay ${data.files.length} JSON en data/ (semilla). Sin manifiesto configurado.`;
  } else {
    bc.classList.remove('hidden');
    bc.textContent = 'Sin manifiesto y sin JSON listados: semillas locales vacías según esta carpeta.';
  }
  const ul = $('data-file-list');
  if (ul) {
    ul.innerHTML = (data.files || [])
      .map((f) => `<li>${escapeHtml(f.name)} — ${f.size} bytes</li>`)
      .join('') || '<li>(vacío)</li>';
  }
}

async function checkUpdatesAll() {
  for (const k of ['backend', 'cocina', 'mozos']) {
    lastUpdates[k] = await api.gitCheckUpdates(k);
  }
  await refreshGitGrid();
}

function setDetectHint(text) {
  const el = $('detect-id-hint');
  if (el) el.textContent = `Identificador: ${text}`;
}

async function init() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => showSection(btn.getAttribute('data-section')));
  });

  const cfg = await api.getConfig();
  await fillForm(cfg);
  const state = await api.getState();
  const hint = await api.getPathsHint();
  appendLogLine({ service: 'launcher', line: `Launcher: ${hint.launcherRoot}`, ts: Date.now() });

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
      await fillForm(c);
    }
  });

  $('btn-save-config').addEventListener('click', async () => {
    const next = readConfigFromForm();
    const cur = await api.getConfig();
    await api.saveConfig({ ...cur, ...next });
    appendLogLine({ service: 'launcher', line: 'Configuración guardada.', ts: Date.now() });
    await fillForm(await api.getConfig());
    await refreshDataBanners();
  });

  $('btn-refresh').addEventListener('click', async () => {
    await refreshMongoAndHttp();
    await refreshServices();
    await refreshGitGrid();
    await refreshDataBanners();
    await refreshRepoStrip('repo-strip-summary');
  });

  $('btn-detect-only').addEventListener('click', async () => {
    const d = await api.pathsAutoDetect();
    const box = $('detect-preview');
    box.classList.remove('hidden');
    if (d.ok) {
      box.textContent = JSON.stringify(
        { root: d.root, source: d.source, score: d.score, paths: d.paths },
        null,
        2,
      );
      setDetectHint(d.source || 'encontrado');
    } else {
      box.textContent = `No se encontró el trío de carpetas. Candidatos analizados: ${d.tried ?? 0}. Defina rutas o use clonar.`;
      setDetectHint('no encontrado');
    }
  });

  $('btn-detect-apply').addEventListener('click', async () => {
    const r = await api.pathsApplyDetect();
    if (r.ok) {
      appendLogLine({
        service: 'launcher',
        line: `Rutas guardadas desde: ${r.source} → ${r.root}`,
        ts: Date.now(),
      });
      setDetectHint(r.source || 'guardado');
      await fillForm(await api.getConfig());
      $('detect-preview').classList.add('hidden');
    } else {
      appendLogLine({
        service: 'launcher',
        line: 'Detección automática: sin resultado. Revise rutas o clone los repos.',
        ts: Date.now(),
      });
      $('detect-preview').classList.remove('hidden');
      $('detect-preview').textContent = JSON.stringify(r, null, 2);
      setDetectHint('sin resultado');
    }
    await refreshRepoStrip('repo-strip-summary');
  });

  $('btn-pick-clone-parent').addEventListener('click', async () => {
    const p = await api.pickDirectory();
    if (p) $('clone-parent-dir').value = p;
  });

  document.querySelectorAll('.btn-pick-path').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-target');
      const p = await api.pickDirectory();
      if (p && id) $(id).value = p;
    });
  });

  const cloneParent = () => $('clone-parent-dir').value.trim() || null;

  $('btn-clone-all').addEventListener('click', async () => {
    if (!window.confirm('¿Clonar los repositorios que falten en la carpeta padre indicada?')) return;
    const r = await api.reposCloneAll(cloneParent());
    appendLogLine({
      service: 'git',
      line: `Clonación masiva: ${JSON.stringify(r.results || r)}`,
      ts: Date.now(),
    });
    await fillForm(await api.getConfig());
    await refreshRepoStrip('repo-strip-summary');
  });

  document.querySelectorAll('[data-clone]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-clone');
      if (!window.confirm(`¿Clonar ${key} con la URL configurada?`)) return;
      const res = await api.gitCloneRepo({ repoKey: key, parentDir: cloneParent() });
      appendLogLine({ service: 'git', line: JSON.stringify(res), ts: Date.now() });
      await fillForm(await api.getConfig());
      await refreshRepoStrip('repo-strip-summary');
    });
  });

  $('btn-check-updates-all').addEventListener('click', () => checkUpdatesAll());
  $('btn-fetch-all').addEventListener('click', async () => {
    for (const k of ['backend', 'cocina', 'mozos']) {
      const out = await api.gitFetch(k);
      appendLogLine({ service: 'git', line: `${k} fetch: ${out.ok ? 'ok' : out.stderr}`, ts: Date.now() });
    }
    await checkUpdatesAll();
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

  $('btn-open-data')?.addEventListener('click', () => api.openDataFolder());
  $('btn-delete-manifest')?.addEventListener('click', async () => {
    if (!window.confirm('¿Eliminar el manifiesto? No borra MongoDB.')) return;
    const r = await api.dataDeleteManifest();
    appendLogLine({ service: 'data', line: r.message, ts: Date.now() });
    refreshDataBanners();
  });

  $('eas-preview').addEventListener('click', () => api.easBuild('preview'));
  $('eas-prod').addEventListener('click', () => {
    if (window.confirm('¿Build production?')) api.easBuild('production');
  });

  const unsub = api.onServiceLog(appendLogLine);
  window.addEventListener('beforeunload', () => {
    if (typeof unsub === 'function') unsub();
  });

  (await api.getLogs()).forEach(appendLogLine);

  await refreshMongoAndHttp();
  await refreshServices();
  await refreshGitGrid();
  await refreshDataBanners();
  await refreshRepoStrip('repo-strip-summary');

  const d0 = await api.pathsAutoDetect();
  if (d0.ok) setDetectHint(d0.source || 'OK');
  else setDetectHint('configure rutas o clone');

  setInterval(async () => {
    await refreshMongoAndHttp();
    await refreshServices();
  }, 5000);
  setInterval(() => refreshGitGrid(), 25000);
}

init().catch((e) => {
  const ta = $('log-area');
  if (ta) ta.value = `Error UI: ${e.message}`;
});
