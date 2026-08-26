const api = window.launcherAPI;
const $ = (id) => document.getElementById(id);

/** @type {Record<string, any>} */
let lastUpdates = { backend: null, cocina: null, mozos: null };

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

let miniAnimatePromise = null;
function loadMiniAnimate() {
  if (!miniAnimatePromise) {
    miniAnimatePromise = import('../node_modules/framer-motion/dist/es/dom-mini.mjs')
      .then((m) => m.animate)
      .catch(() => null);
  }
  return miniAnimatePromise;
}

function celebrateLite() {
  if (prefersReducedMotion() || typeof window.confetti !== 'function') return;
  window.confetti({
    particleCount: 55,
    spread: 70,
    startVelocity: 28,
    origin: { y: 0.65 },
    scalar: 0.85,
    colors: ['#22c55e', '#3b82f6', '#eaf0f8', '#f59e0b'],
  });
}

/* ════════════════════════════════════════════
   SPLASH SEQUENCE
   ════════════════════════════════════════════ */
async function runSplash() {
  const bar = $('splash-bar');
  const status = $('splash-status');
  const steps = [
    { pct: 10, text: 'Cargando configuración…' },
    { pct: 30, text: 'Detectando servicios…' },
    { pct: 55, text: 'Verificando estado HTTP…' },
    { pct: 75, text: 'Preparando interfaz…' },
    { pct: 100, text: 'Listo' },
  ];

  bar.style.width = '0%';
  for (const step of steps) {
    bar.style.width = step.pct + '%';
    status.textContent = step.text;
    await new Promise((r) => setTimeout(r, 280));
  }

  const splash = $('splash');
  const app = $('app');
  splash.classList.add('fade-out');
  app.classList.remove('hidden');

  const gs = window.gsap;
  if (gs && !prefersReducedMotion()) {
    gs.fromTo(app, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    gs.fromTo('.sidebar', { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
    gs.fromTo('.topbar', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
    entranceMainSection('resumen');
  }

  await new Promise((r) => setTimeout(r, 500));
  splash.style.display = 'none';
}

function entranceMainSection(sectionId) {
  if (prefersReducedMotion()) return;
  const sec = document.getElementById(`section-${sectionId}`);
  if (!sec) return;
  const panels = sec.querySelectorAll('.panel');
  const gs = window.gsap;
  if (gs && panels.length) {
    gs.killTweensOf(panels);
    panels.forEach((p) => {
      p.classList.add('panel-enter');
      gs.fromTo(p, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    });
  }
  loadMiniAnimate().then((anim) => {
    if (anim) anim(sec, { opacity: [0.85, 1] }, { duration: 0.25 });
  });
}

async function animateWizardModal() {
  if (prefersReducedMotion()) return;
  const modal = document.querySelector('#wizard .modal');
  if (!modal || $('wizard')?.classList.contains('hidden')) return;
  const anim = await loadMiniAnimate();
  if (anim) {
    anim(modal, { opacity: [0, 1], y: [20, 0] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return;
  }
  const gs = window.gsap;
  if (gs) gs.fromTo(modal, { opacity: 0, scale: 0.94, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power2.out' });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iconsReplace(root) {
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons({ root: root || document });
    }
  } catch (e) { /* ignore */ }
}

function pulseBtn(el) {
  if (prefersReducedMotion() || !el) return;
  const gs = window.gsap;
  if (gs) gs.fromTo(el, { scale: 0.93 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.55)' });
}

function flashBtnSuccess(el) {
  if (prefersReducedMotion() || !el) return;
  const gs = window.gsap;
  if (gs) {
    gs.fromTo(el, { boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' }, { boxShadow: '0 0 20px 4px rgba(34,197,94,0)', duration: 0.7, ease: 'power2.out' });
  }
}

function bindSvcCardMotion(container) {
  if (prefersReducedMotion()) return;
  const gs = window.gsap;
  if (!gs || !container) return;
  container.querySelectorAll('.svc-card').forEach((card) => {
    card.addEventListener('mouseenter', () => gs.to(card, { y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', duration: 0.25, ease: 'power2.out' }));
    card.addEventListener('mouseleave', () => gs.to(card, { y: 0, boxShadow: 'none', duration: 0.3, ease: 'power2.out' }));
  });
  container.querySelectorAll('.btn-svc').forEach((btn) => {
    btn.addEventListener('mouseenter', () => gs.to(btn, { scale: 1.05, duration: 0.18, ease: 'power2.out' }));
    btn.addEventListener('mouseleave', () => gs.to(btn, { scale: 1, duration: 0.18, ease: 'power2.out' }));
  });
}

function bindQuickLinkMotion() {
  if (prefersReducedMotion()) return;
  const gs = window.gsap;
  document.querySelectorAll('.link-quick').forEach((btn) => {
    if (!gs) return;
    btn.addEventListener('mouseenter', () => gs.to(btn, { scale: 1.04, y: -1, duration: 0.2, ease: 'power2.out' }));
    btn.addEventListener('mouseleave', () => gs.to(btn, { scale: 1, y: 0, duration: 0.2, ease: 'power2.out' }));
  });
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
    publicBaseUrl: $('public-base-url').value.trim() || '',
    dataManifestPath: $('data-manifest-path').value.trim() || 'data/data.json',
    cloneParentDir: $('clone-parent-dir').value.trim(),
    cloneUrls: {
      backend: $('clone-url-backend').value.trim(),
      cocina: $('clone-url-cocina').value.trim(),
      mozos: $('clone-url-mozos').value.trim(),
    },
    npmScripts: {
      backend: $('npm-backend').value.trim() || 'start',
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
    showCloneSection: $('cfg-show-clone-section').checked,
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
  void refreshQuickLinks();
  $('data-manifest-path').value = cfg.dataManifestPath || 'data/data.json';
  $('clone-parent-dir').value = cfg.cloneParentDir || '';
  $('clone-url-backend').value = cfg.cloneUrls?.backend || '';
  $('clone-url-cocina').value = cfg.cloneUrls?.cocina || '';
  $('clone-url-mozos').value = cfg.cloneUrls?.mozos || '';
  $('npm-backend').value = cfg.npmScripts?.backend || 'start';
  $('npm-cocina').value = cfg.npmScripts?.cocina || 'start';
  $('npm-expo').value = cfg.npmScripts?.expo || 'start';
  $('cfg-autostart-win').checked = !!cfg.autoStartLauncherWithWindows;
  $('cfg-autostart-svc').checked = !!cfg.autoStartServicesOnLauncherOpen;
  $('cfg-autostart-expo').checked = !!cfg.autoStartExpoWithServices;
  $('cfg-mongo-check').checked = cfg.mongodb?.checkBeforeBackendStart !== false;
  $('cfg-mongo-force').checked = !!cfg.mongodb?.forceBackendStartIfMongoFails;
  $('cfg-stop-quit').checked = cfg.stopAllOnQuit !== false;
  $('cfg-show-clone-section').checked = !!cfg.showCloneSection;
  $('delay-boot').value = cfg.delaysMs?.afterBoot ?? 3000;
  $('delay-between').value = cfg.delaysMs?.betweenServiceStarts ?? 2000;
  const ml = $('manifest-label');
  if (ml) ml.textContent = cfg.dataManifestPath || 'data/data.json';
}

async function refreshQuickLinks() {
  if (typeof api.getQuickLinks !== 'function') return;
  try {
    const info = await api.getQuickLinks();
    const urls = info?.urls || {};
    document.querySelectorAll('[data-link-url]').forEach((el) => {
      const key = el.getAttribute('data-link-url');
      el.textContent = urls[key] || '—';
    });
    const input = $('public-base-url');
    if (input) input.value = info.backendOrigin || '';
  } catch {
    /* noop */
  }
}

async function refreshMongoAndHttp() {
  const [mongo, http] = await Promise.all([api.mongoCheck(), api.httpAppsStatus()]);
  const grid = $('status-grid');
  if (grid) {
    const cards = [
      { label: 'MongoDB (ping)', ok: mongo.ok, text: mongo.ok ? mongo.message : mongo.message, sub: mongo.uriMasked || '' },
      { label: http.backend.label, ok: http.backend.ok, text: http.backend.ok ? `HTTP ${http.backend.status}` : http.backend.error || 'sin respuesta' },
      { label: http.cocina.label, ok: http.cocina.ok, text: http.cocina.ok ? `HTTP ${http.cocina.status}` : http.cocina.error || 'sin respuesta' },
      { label: http.expo.label, ok: http.expo.ok, text: http.expo.ok ? `HTTP ${http.expo.status}` : http.expo.error || 'sin respuesta' },
    ];
    grid.innerHTML = cards
      .map((c) => `
    <div class="stat-card ${c.ok ? 'stat-ok' : 'stat-bad'}">
      <div class="label">${escapeHtml(c.label)}</div>
      <div class="value">${escapeHtml(c.text)}</div>
      ${c.sub ? `<div class="hint" style="margin-top:6px">${escapeHtml(c.sub)}</div>` : ''}
    </div>`)
      .join('');
  }
  await refreshQuickLinks();
}

async function refreshMongoInfo() {
  const [mongoConn, mongoDet] = await Promise.all([api.mongoCheck(), api.mongoDetect()]);

  // If connection ping succeeded, MongoDB is definitely installed regardless of detect result
  if (mongoConn.ok && !mongoDet.installed) {
    mongoDet.installed = true;
    mongoDet.mongodFound = true;
    if (!mongoDet.version) mongoDet.version = 'detectado (conexión activa)';
    if (!mongoDet.path) mongoDet.path = '(en PATH del sistema)';
  }

  const connEl = $('mongo-connection-status');
  const instEl = $('mongo-installed-status');
  const pathEl = $('mongo-path-value');
  const instCard = $('mongo-installed-card');
  const openBtn = $('btn-mongo-open');
  const downloadLink = $('btn-mongo-download');

  if (connEl) {
    if (mongoConn.ok) {
      connEl.textContent = 'Conectado ✓';
      connEl.className = 'mongo-info-value mongo-ok';
    } else {
      connEl.textContent = mongoConn.message || 'Sin conexión';
      connEl.className = 'mongo-info-value mongo-bad';
    }
  }

  if (instEl) {
    if (mongoDet.installed) {
      instEl.textContent = mongoDet.mongodFound ? 'Sí (mongod)' : (mongoDet.mongoshFound ? 'Sí (mongosh)' : 'Sí');
      instEl.className = 'mongo-info-value mongo-ok';
    } else {
      instEl.textContent = 'No instalado';
      instEl.className = 'mongo-info-value mongo-bad';
    }
  }

  if (pathEl) {
    if (mongoDet.path) {
      pathEl.textContent = mongoDet.path;
      pathEl.title = mongoDet.path;
    } else if (mongoDet.installed) {
      pathEl.textContent = mongoDet.version || 'detectado';
    } else {
      pathEl.textContent = '—';
    }
  }

  if (instCard) instCard.className = 'mongo-info-card' + (mongoDet.installed ? ' mongo-card-ok' : ' mongo-card-bad');

  if (openBtn) {
    openBtn.disabled = !mongoDet.installed;
  }

  if (downloadLink) {
    if (mongoDet.installed) {
      downloadLink.classList.add('btn-disabled');
      downloadLink.style.opacity = '0.5';
      downloadLink.style.pointerEvents = 'none';
      downloadLink.title = 'MongoDB ya está instalado';
    } else {
      downloadLink.classList.remove('btn-disabled');
      downloadLink.style.opacity = '';
      downloadLink.style.pointerEvents = '';
      downloadLink.title = '';
    }
  }
}

async function refreshNpmInstallGrid() {
  const checks = await api.checkNodeModules();
  const grid = $('npm-install-grid');
  if (!grid) return;
  const labels = { backend: 'Backend', cocina: 'Cocina', expo: 'Mozos (Expo)' };
  grid.innerHTML = '';
  for (const [key, info] of Object.entries(checks)) {
    const exists = info.hasPackageJson;
    const installed = info.hasModules;
    const card = document.createElement('div');
    card.className = 'npm-install-card' + (installed ? ' npm-installed' : '');
    card.innerHTML = `
      <h3>${labels[key]}</h3>
      <div class="npm-install-status">
        ${!info.path ? '<span class="stat-bad">Ruta no configurada</span>' : ''}
        ${info.path && !exists ? '<span class="stat-bad">Carpeta no encontrada</span>' : ''}
        ${exists && !installed ? '<span class="stat-warn">package.json sí · node_modules: no</span>' : ''}
        ${installed ? '<span class="stat-ok">node_modules instalado ✓</span>' : ''}
      </div>
      <div class="npm-install-path">${escapeHtml(info.path || '—')}</div>
      <button type="button" class="btn btn-primary npm-install-btn" data-install="${key}" ${installed || !exists ? 'disabled' : ''}>
        ${installed ? 'Ya instalado' : 'Instalar dependencias'}
      </button>
    `;
    grid.appendChild(card);
  }
  grid.querySelectorAll('[data-install]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      ev.currentTarget.textContent = 'Instalando…';
      const key = ev.currentTarget.getAttribute('data-install');
      const progEl = $('npm-install-progress');
      if (progEl) progEl.classList.remove('hidden');
      const bar = $('npm-install-progress-bar');
      if (bar) { bar.style.width = '5%'; bar.classList.remove('complete', 'error'); }
      const status = $('npm-install-progress-status');
      if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = `Instalando ${key}…`; }
      const result = await api.npmInstall(key);
      if (result.ok) {
        appendLogLine({ service: key, line: `npm install completado para ${key}`, ts: Date.now() });
        flashBtnSuccess(ev.currentTarget);
      } else {
        appendLogLine({ service: key, line: `npm install falló: ${result.error || result.stderr || 'error'}`, ts: Date.now() });
        ev.currentTarget.disabled = false;
        ev.currentTarget.textContent = 'Reintentar';
      }
      await refreshNpmInstallGrid();
    });
  });
}

async function refreshCloneVisibility() {
  const cfg = await api.getConfig();
  const panel = $('panel-clone-section');
  if (panel) {
    panel.style.display = cfg.showCloneSection ? '' : 'none';
  }
}

async function refreshServices() {
  const st = await api.serviceStatus();
  cachedServiceStatus = st;
  const row = $('services-row');
  if (!row) return;
  const names = { backend: 'Backend', cocina: 'App cocina', expo: 'Expo (mozos)' };
  row.innerHTML = ['backend', 'cocina', 'expo']
    .map((id) => {
      const s = st[id];
      const dotCls = s.running ? 'running' : 'stopped';
      const statusLabel = s.running ? `En ejecución (PID ${s.pid})` : 'Detenido';
      const errorSuffix = s.lastError ? ` — ${escapeHtml(s.lastError)}` : '';
      return `<div class="svc-card${s.running ? ' svc-card-running' : ''}">
        <h3>${names[id]}</h3>
        <div class="svc-meta"><span class="svc-status-dot ${dotCls}"></span>${statusLabel}${errorSuffix}</div>
        <div class="svc-actions">
          <button type="button" class="btn-svc btn-svc-start" data-start="${id}">
            <i data-lucide="play" class="btn-svc-ico" aria-hidden="true"></i><span>Iniciar</span>
          </button>
          <button type="button" class="btn-svc btn-svc-stop" data-stop="${id}">
            <i data-lucide="square" class="btn-svc-ico" aria-hidden="true"></i><span>Detener</span>
          </button>
        </div>
      </div>`;
    })
    .join('');

  iconsReplace(row);
  bindSvcCardMotion(row);

  row.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      pulseBtn(ev.currentTarget);
      await api.serviceStart(btn.getAttribute('data-start'));
      flashBtnSuccess(ev.currentTarget);
      await refreshServices();
      await refreshMongoAndHttp();
      await refreshGlobalStatusStrip();
    });
  });
  row.querySelectorAll('[data-stop]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      pulseBtn(ev.currentTarget);
      await api.serviceStop(btn.getAttribute('data-stop'));
      await refreshServices();
      await refreshMongoAndHttp();
      await refreshGlobalStatusStrip();
    });
  });

  updateStartStopButtons();
}

async function refreshGlobalStatusStrip() {
  const [st, http] = await Promise.all([api.serviceStatus(), api.httpAppsStatus()]);
  cachedServiceStatus = st;
  cachedHttpOk = { backend: http.backend.ok, cocina: http.cocina.ok, expo: http.expo.ok };
  const strip = $('status-strip');
  if (!strip) return;

  const chips = [
    { id: 'backend', label: 'Backend', running: st.backend.running, httpOk: http.backend.ok },
    { id: 'cocina', label: 'Cocina', running: st.cocina.running, httpOk: http.cocina.ok },
    { id: 'expo', label: 'Mozos', running: st.expo.running, httpOk: http.expo.ok },
  ];

  strip.innerHTML = chips.map((c) => {
    let cls = '';
    let text = 'Detenido';
    if (c.running && c.httpOk) { cls = 'online'; text = 'Activo'; }
    else if (c.running) { cls = 'starting'; text = 'Iniciando…'; }
    else { cls = 'offline'; text = 'Detenido'; }
    return `<div class="status-chip ${cls}">
      <span class="status-chip-dot"></span>
      <span>${c.label}</span>
      <span style="color:var(--text-muted);font-size:0.72rem">${text}</span>
    </div>`;
  }).join('');

  updateStartStopButtons();
}

function pillHtml(title, st) {
  const ok = st.exists && st.hasPackageJson;
  const cls = ok ? 'ok' : 'bad';
  const lines = [st.exists ? 'Carpeta: sí' : 'Carpeta: no', st.isGit ? 'Git: sí' : 'Git: no', st.hasPackageJson ? 'package.json: sí' : 'package.json: no'];
  return `<div class="repo-pill ${cls}"><strong>${title}</strong>${lines.join(' · ')}</div>`;
}

async function refreshRepoStrip(targetId) {
  const st = await api.reposLocalStatus();
  const html = pillHtml('Backend', st.backend) + pillHtml('Cocina', st.cocina) + pillHtml('Mozos', st.mozos);
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
        <button type="button" class="btn btn-ghost" data-check="${r.key}">Comprobar actualizaciones</button>
        <button type="button" class="btn btn-primary" data-pull="${r.key}">git pull</button>
      </div>
    `;
    card.querySelector(`[data-check="${r.key}"]`).addEventListener('click', async () => {
      lastUpdates[r.key] = await api.gitCheckUpdates(r.key);
      refreshGitGrid();
    });
    card.querySelector(`[data-pull="${r.key}"]`).addEventListener('click', async () => {
      if (g.dirty && !window.confirm(`${r.title}: hay cambios locales. ¿Hacer git pull?`)) return;
      const progEl = $('git-progress');
      if (progEl) progEl.classList.remove('hidden');
      const bar = $('git-progress-bar');
      if (bar) { bar.style.width = '10%'; bar.classList.remove('complete', 'error'); }
      const status = $('git-progress-status');
      if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = `git pull en ${r.key}…`; }
      const out = await api.gitPull(r.key);
      appendLogLine({ service: 'git', line: `${r.key} pull: ${out.ok ? 'ok' : 'falló'} ${out.stderr || out.stdout}`, ts: Date.now() });
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
    bm.textContent = 'Manifiesto detectado. Para instalación limpia evalúe backup y eliminación del manifiesto; no vacía MongoDB.';
  } else if (hasOther) {
    bj.classList.remove('hidden');
    bj.textContent = `Hay ${data.files.length} JSON en data/ (semilla). Sin manifiesto configurado.`;
  } else {
    bc.classList.remove('hidden');
    bc.textContent = 'Sin manifiesto y sin JSON listados: semillas locales vacías según esta carpeta.';
  }
  const ul = $('data-file-list');
  if (ul) {
    ul.innerHTML = (data.files || []).map((f) => `<li>${escapeHtml(f.name)} — ${f.size} bytes</li>`).join('') || '<li>(vacío)</li>';
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

/* ════════════════════════════════════════════
   START ALL / STOP ALL with progress UI
   ════════════════════════════════════════════ */
let startingAll = false;

function setLaunchStep(stepId, state, statusText) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.className = 'launch-step ' + state; // starting | running | error | skipped | ''
  const statusEl = el.querySelector('.launch-step-status');
  if (statusEl) statusEl.textContent = statusText;
}

function showLaunchProgress(progressId, stepsId) {
  const progress = document.getElementById(progressId);
  const steps = document.getElementById(stepsId);
  if (progress) { progress.classList.remove('hidden'); }
  if (steps) { steps.classList.remove('hidden'); }
}

function hideLaunchProgress(progressId, stepsId) {
  const progress = document.getElementById(progressId);
  const steps = document.getElementById(stepsId);
  if (progress) { progress.classList.add('hidden'); }
  if (steps) { steps.classList.add('hidden'); }
}

function setProgressBar(progressBarId, pct, extraClass) {
  const bar = document.getElementById(progressBarId);
  if (!bar) return;
  bar.style.width = pct + '%';
  bar.className = 'launch-progress-bar';
  if (extraClass) bar.classList.add(extraClass);
}

async function startAllServices() {
  if (startingAll) return;
  startingAll = true;

  const includeExpo = $('start-all-include-expo')?.checked
    ?? $('start-all-include-expo-svc')?.checked
    ?? true;
  const cfg = await api.getConfig();
  const delay = cfg.delaysMs?.betweenServiceStarts ?? 2000;

  // Determine which progress UI set is visible
  const resumenProgress = 'launch-progress';
  const resumenSteps = 'launch-steps';
  const svcProgress = 'launch-progress-svc';
  const svcSteps = 'launch-steps-svc';

  // Show both progress UIs
  showLaunchProgress(resumenProgress, resumenSteps);
  showLaunchProgress(svcProgress, svcSteps);

  // Reset steps
  const serviceIds = ['backend', 'cocina', ...(includeExpo ? ['expo'] : [])];
  const allStepIds = [
    { key: 'backend', ids: ['step-backend', 'step-svc-backend'] },
    { key: 'cocina', ids: ['step-cocina', 'step-svc-cocina'] },
    { key: 'expo', ids: ['step-expo', 'step-svc-expo'] },
  ];

  for (const s of allStepIds) {
    const skip = s.key === 'expo' && !includeExpo;
    for (const id of s.ids) setLaunchStep(id, skip ? 'skipped' : '', skip ? 'Omitido' : 'Esperando…');
  }
  if (!includeExpo) {
    setLaunchStep('step-expo', 'skipped', 'Omitido');
    setLaunchStep('step-svc-expo', 'skipped', 'Omitido');
  }

  setProgressBar('launch-progress-bar', 0);
  setProgressBar('launch-progress-bar-svc', 0);

  pulseBtn($('btn-start-all') || $('btn-start-all-svc'));
  disableStartButtons(true);
  updateStartStopButtons();
  appendLogLine({ service: 'launcher', line: 'Iniciando todos los servicios…', ts: Date.now() });

  const total = serviceIds.length;
  const pctPerStep = Math.floor(100 / total);
  let completed = 0;

  for (const key of serviceIds) {
    // Mark as starting
    const stepIds = allStepIds.find(s => s.key === key).ids;
    for (const id of stepIds) setLaunchStep(id, 'starting', 'Iniciando…');

    const animateBar = key; // reference
    setProgressBar('launch-progress-bar', Math.min(completed * pctPerStep + pctPerStep / 2, 90), 'indeterminate');
    setProgressBar('launch-progress-bar-svc', Math.min(completed * pctPerStep + pctPerStep / 2, 90), 'indeterminate');

    const result = await api.serviceStart(key);
    const statusText = result.ok ? 'En ejecución' : (result.error === 'already_running' ? 'Ya estaba activo' : (result.error || 'Error'));

    appendLogLine({ service: 'launcher', line: `${key}: ${statusText}`, ts: Date.now() });

    if (result.ok || result.error === 'already_running') {
      for (const id of stepIds) setLaunchStep(id, 'running', result.error === 'already_running' ? 'Ya activo' : 'En ejecución ✓');
      completed++;
      setProgressBar('launch-progress-bar', Math.min(Math.round(completed / total * 100), 95));
      setProgressBar('launch-progress-bar-svc', Math.min(Math.round(completed / total * 100), 95));
    } else {
      for (const id of stepIds) setLaunchStep(id, 'error', result.error || 'Error');
      completed++;
      setProgressBar('launch-progress-bar', Math.min(Math.round(completed / total * 100), 95));
      setProgressBar('launch-progress-bar-svc', Math.min(Math.round(completed / total * 100), 95));
    }

    // Wait between services (except after last)
    if (key !== serviceIds[serviceIds.length - 1]) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // Now verify HTTP availability for backend
  setProgressBar('launch-progress-bar', 97);
  setProgressBar('launch-progress-bar-svc', 97);

  await refreshServices();
  await refreshMongoAndHttp();
  await refreshGlobalStatusStrip();

  // Complete
  setProgressBar('launch-progress-bar', 100, 'complete');
  setProgressBar('launch-progress-bar-svc', 100, 'complete');

  celebrateLite();
  disableStartButtons(false);
  startingAll = false;
  updateStartStopButtons();

  // Hide progress after a moment
  setTimeout(() => {
    hideLaunchProgress(resumenProgress, resumenSteps);
    hideLaunchProgress(svcProgress, svcSteps);
  }, 2500);
}

function disableStartButtons(disabled) {
  const btns = [$('btn-start-all'), $('btn-start-all-svc')];
  btns.forEach((b) => { if (b) b.disabled = disabled; });
}

/** Cached service running state for button enable/disable logic. */
let cachedServiceStatus = { backend: { running: false }, cocina: { running: false }, expo: { running: false } };
let cachedHttpOk = { backend: false, cocina: false, expo: false };

function updateStartStopButtons() {
  const st = cachedServiceStatus;
  const includeExpo = $('start-all-include-expo')?.checked
    ?? $('start-all-include-expo-svc')?.checked
    ?? true;
  const serviceKeys = includeExpo ? ['backend', 'cocina', 'expo'] : ['backend', 'cocina'];
  const anyRunning = serviceKeys.some((k) => st[k]?.running);
  const allRunning = serviceKeys.every((k) => st[k]?.running);

  // Start buttons: disabled during startAll process OR when all services already running
  [$('btn-start-all'), $('btn-start-all-svc')].forEach((b) => {
    if (!b) return;
    b.disabled = startingAll || allRunning;
  });

  // Stop buttons: disabled when nothing is running (and not in startAll process)
  [$('btn-stop-all'), $('btn-stop-all-svc')].forEach((b) => {
    if (!b) return;
    b.disabled = !anyRunning && !startingAll;
  });
}

async function stopAllServices() {
  pulseBtn($('btn-stop-all') || $('btn-stop-all-svc'));
  appendLogLine({ service: 'launcher', line: 'Deteniendo todos los servicios…', ts: Date.now() });

  for (const s of ['backend', 'cocina', 'expo']) {
    await api.serviceStop(s);
  }

  await refreshServices();
  await refreshMongoAndHttp();
  await refreshGlobalStatusStrip();
  updateStartStopButtons();
  appendLogLine({ service: 'launcher', line: 'Todos los servicios detenidos.', ts: Date.now() });
}

/* ════════════════════════════════════════════
   TASK PROGRESS (generic progress bar handler)
   ════════════════════════════════════════════ */
const taskProgressBars = {
  eas: { progressEl: () => $('eas-progress'), barEl: () => $('eas-progress-bar'), statusEl: () => $('eas-progress-status') },
  'npm-install': { progressEl: () => $('npm-install-progress'), barEl: () => $('npm-install-progress-bar'), statusEl: () => $('npm-install-progress-status') },
  'git-pull': { progressEl: () => $('git-progress'), barEl: () => $('git-progress-bar'), statusEl: () => $('git-progress-status') },
  'git-clone': { progressEl: () => $('clone-progress'), barEl: () => $('clone-progress-bar'), statusEl: () => $('clone-progress-status') },
};

function updateTaskProgressUI(taskId, data) {
  // Determine which progress bar to use based on taskId prefix
  let key = null;
  if (taskId.startsWith('eas-')) key = 'eas';
  else if (taskId.startsWith('npm-')) key = 'npm-install';
  else if (taskId.startsWith('git-pull-')) key = 'git-pull';
  else if (taskId.startsWith('git-clone-') || taskId.startsWith('git-clone-all-')) key = 'git-clone';
  if (!key || !taskProgressBars[key]) return;

  const { barEl, statusEl, progressEl } = taskProgressBars[key];
  const bar = barEl();
  const status = statusEl();
  const progress = progressEl();
  if (!progress) return;

  progress.classList.remove('hidden');

  if (bar) {
    bar.style.width = (data.pct || 0) + '%';
    bar.classList.remove('indeterminate', 'complete', 'error');
    if (data.pct < 15 && data.status === 'running') {
      bar.classList.add('indeterminate');
    }
    if (data.status === 'done') bar.classList.add('complete');
    if (data.status === 'error') bar.classList.add('error');
  }

  if (status) {
    status.classList.remove('done', 'error');
    const textEl = status.querySelector('.status-text');
    if (textEl) textEl.textContent = data.message || '';
    if (data.status === 'done') status.classList.add('done');
    if (data.status === 'error') status.classList.add('error');
  }

  // EAS build completed: show save actions
  if (key === 'eas' && (data.status === 'done' || data.status === 'error')) {
    const saveActions = document.getElementById('eas-save-actions');
    const saveInfo = document.getElementById('eas-save-info');
    if (data.status === 'done' && saveActions && saveInfo) {
      saveActions.classList.remove('hidden');
      saveInfo.textContent = data.message || 'Build completado. Puede guardar el APK.';
      // Show Expo link if buildUrl present
      const openUrl = document.getElementById('eas-open-url');
      if (openUrl && data.buildUrl) {
        openUrl.href = data.buildUrl;
        openUrl.style.display = '';
      }
    } else if (data.status === 'error' && saveActions) {
      saveActions.classList.add('hidden');
    }
  }

  // Auto-hide on completion after a delay (except for EAS which has save button)
  if (data.status === 'done' || data.status === 'error') {
    if (key !== 'eas') {
      setTimeout(() => {
        if (progress) progress.classList.add('hidden');
        if (bar) {
          bar.style.width = '0%';
          bar.classList.remove('complete', 'error');
        }
      }, 4000);
    }
  }
}

/* ════════════════════════════════════════════
   SECTION TITLES
   ════════════════════════════════════════════ */
const sectionTitles = {
  resumen: 'Panel de control',
  servicios: 'Servicios',
  rutas: 'Rutas e instalación',
  git: 'Git y actualizaciones',
  datos: 'Base de datos',
  mozos: 'Mozos (APK)',
  avanzado: 'Configuración avanzada',
  registro: 'Registro',
};

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
async function init() {
  await runSplash();

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sid = btn.getAttribute('data-section');
      showSection(sid);
      $('topbar-title').textContent = sectionTitles[sid] || 'Panel de control';
      entranceMainSection(sid);
    });
  });

  const cfg = await api.getConfig();
  await fillForm(cfg);
  const state = await api.getState();
  const hint = await api.getPathsHint();
  appendLogLine({ service: 'launcher', line: `Launcher: ${hint.launcherRoot}`, ts: Date.now() });

  if (!state.firstLaunchCompletedAt && cfg.showFirstRunWizard !== false) {
    $('wizard').classList.remove('hidden');
    requestAnimationFrame(() => animateWizardModal());
  }

  $('wiz-done').addEventListener('click', async () => {
    const hide = $('wiz-hide').checked;
    $('wizard').classList.add('hidden');
    setTimeout(celebrateLite, 60);
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
    celebrateLite();
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
    pulseBtn($('btn-refresh'));
  });

  // Start / Stop ALL
  $('btn-start-all')?.addEventListener('click', startAllServices);
  $('btn-stop-all')?.addEventListener('click', stopAllServices);
  $('btn-start-all-svc')?.addEventListener('click', startAllServices);
  $('btn-stop-all-svc')?.addEventListener('click', stopAllServices);

  // Sync include-expo checkboxes
  $('start-all-include-expo')?.addEventListener('change', (e) => {
    if ($('start-all-include-expo-svc')) $('start-all-include-expo-svc').checked = e.target.checked;
    updateStartStopButtons();
  });
  $('start-all-include-expo-svc')?.addEventListener('change', (e) => {
    if ($('start-all-include-expo')) $('start-all-include-expo').checked = e.target.checked;
    updateStartStopButtons();
  });

  $('btn-detect-only').addEventListener('click', async () => {
    const d = await api.pathsAutoDetect();
    const box = $('detect-preview');
    box.classList.remove('hidden');
    if (d.ok) {
      box.textContent = JSON.stringify({ root: d.root, source: d.source, score: d.score, paths: d.paths }, null, 2);
      setDetectHint(d.source || 'encontrado');
    } else {
      box.textContent = `No se encontró el trío de carpetas. Candidatos analizados: ${d.tried ?? 0}. Defina rutas o use clonar.`;
      setDetectHint('no encontrado');
    }
  });

  $('btn-detect-apply').addEventListener('click', async () => {
    const r = await api.pathsApplyDetect();
    if (r.ok) {
      celebrateLite();
      appendLogLine({ service: 'launcher', line: `Rutas guardadas desde: ${r.source} → ${r.root}`, ts: Date.now() });
      setDetectHint(r.source || 'guardado');
      await fillForm(await api.getConfig());
      $('detect-preview').classList.add('hidden');
    } else {
      appendLogLine({ service: 'launcher', line: 'Detección automática: sin resultado. Revise rutas o clone los repos.', ts: Date.now() });
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
    const progEl = $('clone-progress');
    if (progEl) progEl.classList.remove('hidden');
    const bar = $('clone-progress-bar');
    if (bar) { bar.style.width = '5%'; bar.classList.remove('complete', 'error'); }
    const status = $('clone-progress-status');
    if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = 'Clonando repositorios…'; }
    const r = await api.reposCloneAll(cloneParent());
    appendLogLine({ service: 'git', line: `Clonación masiva: ${JSON.stringify(r.results || r)}`, ts: Date.now() });
    await fillForm(await api.getConfig());
    await refreshRepoStrip('repo-strip-summary');
  });

  document.querySelectorAll('[data-clone]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-clone');
      if (!window.confirm(`¿Clonar ${key} con la URL configurada?`)) return;
      const progEl = $('clone-progress');
      if (progEl) progEl.classList.remove('hidden');
      const bar = $('clone-progress-bar');
      if (bar) { bar.style.width = '10%'; bar.classList.remove('complete', 'error'); }
      const status = $('clone-progress-status');
      if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = `Clonando ${key}…`; }
      const res = await api.gitCloneRepo({ repoKey: key, parentDir: cloneParent() });
      appendLogLine({ service: 'git', line: JSON.stringify(res), ts: Date.now() });
      await fillForm(await api.getConfig());
      await refreshRepoStrip('repo-strip-summary');
    });
  });

  $('btn-check-updates-all').addEventListener('click', () => checkUpdatesAll());

  async function openQuickLink(target) {
    const info = typeof api.getQuickLinks === 'function' ? await api.getQuickLinks() : null;
    const url = info?.urls?.[target];
    if (url) {
      await api.openExternal(url);
      return;
    }
    const cfg = await api.getConfig();
    const backendPort = cfg.ports?.backend ?? 3000;
    const cocinaPort = cfg.ports?.cocina ?? 3001;
    const base = (cfg.publicBaseUrl || `http://127.0.0.1:${backendPort}`).replace(/\/$/, '');
    let fallback = base;
    if (target === 'cocina') fallback = `http://127.0.0.1:${cocinaPort}/`;
    else if (target === 'login') fallback = `${base}/login`;
    else if (target === 'root') fallback = `${base}/`;
    await api.openExternal(fallback);
  }

  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openQuickLink(btn.getAttribute('data-open')));
  });

  $('btn-open-data')?.addEventListener('click', () => api.openDataFolder());
  $('btn-delete-manifest')?.addEventListener('click', async () => {
    if (!window.confirm('¿Eliminar el manifiesto? No borra MongoDB.')) return;
    const r = await api.dataDeleteManifest();
    appendLogLine({ service: 'data', line: r.message, ts: Date.now() });
    refreshDataBanners();
  });

  $('btn-mongo-refresh')?.addEventListener('click', async () => {
    pulseBtn($('btn-mongo-refresh'));
    await refreshMongoInfo();
    await refreshMongoAndHttp();
  });
  $('btn-mongo-open')?.addEventListener('click', async () => {
    const r = await api.mongoOpen();
    appendLogLine({ service: 'launcher', line: `Abrir MongoDB: ${r.opened || 'url'}`, ts: Date.now() });
  });

  $('eas-preview').addEventListener('click', async () => {
    const saveActions = $('eas-save-actions');
    if (saveActions) saveActions.classList.add('hidden');
    const openUrl = $('eas-open-url');
    if (openUrl) openUrl.style.display = 'none';
    const progEl = $('eas-progress');
    if (progEl) progEl.classList.remove('hidden');
    const bar = $('eas-progress-bar');
    if (bar) { bar.style.width = '5%'; bar.classList.remove('complete', 'error'); bar.classList.add('indeterminate'); }
    const status = $('eas-progress-status');
    if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = 'Iniciando build preview…'; }
    const result = await api.easBuild('preview');
    if (!result.ok && result.error === 'eas_already_running') {
      if (status) { status.classList.add('error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = 'Ya hay un build en ejecución.'; }
      if (bar) { bar.classList.remove('indeterminate'); bar.style.width = '100%'; bar.classList.add('error'); }
    }
  });
  $('eas-prod').addEventListener('click', async () => {
    if (!window.confirm('¿Build production?')) return;
    const saveActions = $('eas-save-actions');
    if (saveActions) saveActions.classList.add('hidden');
    const openUrl = $('eas-open-url');
    if (openUrl) openUrl.style.display = 'none';
    const progEl = $('eas-progress');
    if (progEl) progEl.classList.remove('hidden');
    const bar = $('eas-progress-bar');
    if (bar) { bar.style.width = '5%'; bar.classList.remove('complete', 'error'); bar.classList.add('indeterminate'); }
    const status = $('eas-progress-status');
    if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = 'Iniciando build production…'; }
    const result = await api.easBuild('production');
    if (!result.ok && result.error === 'eas_already_running') {
      if (status) { status.classList.add('error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = 'Ya hay un build en ejecución.'; }
      if (bar) { bar.classList.remove('indeterminate'); bar.style.width = '100%'; bar.classList.add('error'); }
    }
  });

  $('eas-save-apk')?.addEventListener('click', async () => {
    const info = await api.easBuildInfo();
    if (!info || (!info.buildId && !info.buildUrl)) {
      appendLogLine({ service: 'eas', line: 'No hay información del build para descargar.', ts: Date.now() });
      return;
    }
    const progEl = $('eas-progress');
    if (progEl) progEl.classList.remove('hidden');
    const bar = $('eas-progress-bar');
    if (bar) { bar.style.width = '5%'; bar.classList.remove('complete', 'error', 'indeterminate'); }
    const status = $('eas-progress-status');
    if (status) { status.classList.remove('done', 'error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = 'Descargando APK…'; }
    const result = await api.easSaveApk({ buildId: info.buildId, buildUrl: info.buildUrl });
    if (result.ok) {
      if (status) { status.classList.add('done'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = `APK guardado: ${result.path}`; }
      if (bar) { bar.style.width = '100%'; bar.classList.add('complete'); }
      appendLogLine({ service: 'eas', line: `APK guardado en: ${result.path}`, ts: Date.now() });
      flashBtnSuccess($('eas-save-apk'));
    } else if (result.error !== 'cancelled') {
      if (status) { status.classList.add('error'); const txt = status.querySelector('.status-text'); if (txt) txt.textContent = `Error: ${result.error}`; }
      if (bar) { bar.classList.add('error'); }
      appendLogLine({ service: 'eas', line: `Error al guardar APK: ${result.error}`, ts: Date.now() });
    } else {
      // User cancelled, reset progress
      if (progEl) progEl.classList.add('hidden');
    }
  });

  $('eas-clear-cache')?.addEventListener('click', async () => {
    if (!window.confirm('¿Limpiar la caché de EAS CLI (npx)? Esto forzará una descarga limpia en el próximo build.')) return;
    const btn = $('eas-clear-cache');
    if (btn) { btn.disabled = true; btn.textContent = 'Limpiando…'; }
    const r = await api.easClearNpxCache();
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="trash-2" class="btn-icon"></i> Limpiar caché EAS'; iconsReplace(btn.parentElement); }
    if (r.ok) {
      appendLogLine({ service: 'eas', line: r.message, ts: Date.now() });
    } else {
      appendLogLine({ service: 'eas', line: `Error limpiando caché: ${r.error}`, ts: Date.now() });
    }
  });

  const unsub = api.onServiceLog(appendLogLine);
  const unsubProgress = api.onTaskProgress((data) => {
    if (data && data.taskId) updateTaskProgressUI(data.taskId, data);
  });
  window.addEventListener('beforeunload', () => {
    if (typeof unsub === 'function') unsub();
    if (typeof unsubProgress === 'function') unsubProgress();
  });

  (await api.getLogs()).forEach(appendLogLine);

  await refreshMongoAndHttp();
  await refreshServices();
  await refreshGitGrid();
  await refreshDataBanners();
  await refreshRepoStrip('repo-strip-summary');
  await refreshGlobalStatusStrip();
  await refreshMongoInfo();
  updateStartStopButtons();

  const d0 = await api.pathsAutoDetect();
  if (d0.ok) setDetectHint(d0.source || 'OK');
  else setDetectHint('configure rutas o clone');

  $('cfg-show-clone-section').addEventListener('change', async () => {
    const cfg = await api.getConfig();
    cfg.showCloneSection = $('cfg-show-clone-section').checked;
    await api.saveConfig(cfg);
    await refreshCloneVisibility();
  });

  await refreshCloneVisibility();
  await refreshNpmInstallGrid();

  // Populate launcher info
  (async () => {
    const info = await api.getLauncherInfo();
    const verEl = $('about-version');
    const elecEl = $('about-electron');
    const rootEl = $('about-root');
    if (verEl) verEl.textContent = 'v' + (info.version || '—');
    if (elecEl) elecEl.textContent = info.electronVersion || '—';
    if (rootEl) rootEl.textContent = info.root || '—';
    const brandVer = $('brand-version');
    if (brandVer && info.version) brandVer.textContent = 'Launcher v' + info.version;
  })();

  $('btn-check-launcher-update')?.addEventListener('click', async () => {
    const btn = $('btn-check-launcher-update');
    const resultEl = $('launcher-update-result');
    if (!btn || !resultEl) return;
    btn.disabled = true;
    btn.textContent = 'Comprobando…';
    resultEl.className = 'launcher-update-result';
    resultEl.textContent = '';
    const result = await api.checkLauncherUpdate();
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="btn-icon"></i> Comprobar actualizaciones del launcher';
    iconsReplace(btn.parentElement);
    if (result.ok) {
      const cls = result.hasUpdate ? 'launcher-update-result warn' : 'launcher-update-result ok';
      resultEl.className = cls;
      resultEl.textContent = result.message;
      if (result.hasUpdate && result.releaseUrl) {
        const link = document.createElement('a');
        link.href = result.releaseUrl;
        link.textContent = ' Ver release →';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'about-link';
        resultEl.appendChild(link);
      }
    } else {
      resultEl.className = 'launcher-update-result bad';
      resultEl.textContent = result.message;
    }
  });

  showSection('resumen');
  $('topbar-title').textContent = sectionTitles.resumen;

  const mainCol = document.querySelector('.main-col');
  if (mainCol) iconsReplace(mainCol);
  bindQuickLinkMotion();

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => loadMiniAnimate(), { timeout: 4000 });
  } else {
    setTimeout(() => loadMiniAnimate(), 800);
  }

  setInterval(async () => {
    await refreshMongoAndHttp();
    await refreshServices();
    await refreshGlobalStatusStrip();
  }, 5000);
  setInterval(() => refreshGitGrid(), 25000);
}

init().catch((e) => {
  const ta = $('log-area');
  if (ta) ta.value = `Error UI: ${e.message}`;
});